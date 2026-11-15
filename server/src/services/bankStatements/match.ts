/**
 * Scoring a statement line against a customer's deposit or withdrawal
 * request. Pure functions — the service loads the facts and stores results.
 *
 * Evidence, strongest first: our reference in the payment description, the
 * paying account already confirmed for this customer, the exact amount, the
 * payer's name against the customer's names (Arabic or Latin script), and
 * timing. Some evidence is a warning rather than a match signal — another
 * customer's account, a different name, a different amount — and those
 * become flags that keep a line out of one-click confirmation and, for
 * third-party money, put it in front of compliance.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { jaroWinkler, nameScore, normalizeName } from '../compliance/screening.service';
import { accountsMatch, westernDigits } from './parse';

export type Flag =
  | 'AMOUNT_DIFFERS'
  | 'ACCOUNT_OF_OTHER_CUSTOMER'
  | 'ACCOUNT_DIFFERS'
  | 'NAME_MISMATCH'
  | 'THIRD_PARTY_PAYOUT'
  | 'PAID_BEFORE_REQUEST'
  | 'PAID_NOT_MARKED'
  | 'SANCTIONS_HIT';

/** Flags that mean money may belong to, or go to, someone other than the customer. */
export const AML_FLAGS: Flag[] = ['ACCOUNT_OF_OTHER_CUSTOMER', 'NAME_MISMATCH', 'THIRD_PARTY_PAYOUT', 'SANCTIONS_HIT'];

export interface LineFacts {
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: string;
  valueDate: Date;
  railRef: string | null;
  narration: string | null;
  counterpartyName: string | null;
  accountKey: string | null;
}

export interface CustomerFacts {
  userId: string;
  /** Profile name, business legal name, names on saved bank accounts, confirmed payer names. */
  names: string[];
  /** Saved bank accounts and the deposit's typed account. */
  accountKeys: string[];
  /** Accounts staff or a bank confirmed for this customer. */
  confirmedAccountKeys: string[];
  phoneKey: string | null;
}

export interface DepositFacts {
  id: string;
  userId: string;
  reference: string;
  amount: string;
  currency: string;
  createdAt: Date;
  senderName: string | null;
  accountKey: string | null;
}

export interface WithdrawalFacts {
  id: string;
  userId: string;
  reference: string;
  amount: string;
  netAmount: string;
  currency: string;
  createdAt: Date;
  status: string;
  accountName: string | null;
  accountKey: string | null;
}

export interface Scored {
  score: number;
  /** One-click confirmation is allowed only for strong, unflagged matches. */
  strong: boolean;
  flags: Flag[];
  signals: Record<string, string | number | boolean>;
}

// ── Names across scripts ─────────────────────────────────────────────

const AR_SKELETON: Record<string, string> = {
  ب: 'b', ت: 't', ث: 't', ج: 'g', ح: 'h', خ: 'k', د: 'd', ذ: 'd', ر: 'r', ز: 'z', س: 's', ش: 's', ص: 's', ض: 'd',
  ط: 't', ظ: 'z', غ: 'g', ف: 'f', ق: 'g', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: '', و: '', ي: '', ى: '',
  ا: '', أ: '', إ: '', آ: '', ء: '', ئ: '', ؤ: '', ع: '',
};
const JOIN_NEXT = new Set(['عبد', 'abd', 'abdul', 'abdel', 'abdal', 'abdu']);
const DROP = new Set(['بن', 'ابن', 'bin', 'ben', 'ibn']);

function skeletonToken(t: string): string {
  let s = t;
  if (/[؀-ۿ]/.test(s)) {
    if (s.length > 3 && s.startsWith('ال')) s = s.slice(2);
    s = s.replace(/ه$/, '');
    s = [...s].map((ch) => AR_SKELETON[ch] ?? '').join('');
  } else {
    if (s.length >= 6 && /^(al|el)/.test(s)) s = s.slice(2);
    s = s.replace(/h$/, '').replace(/kh/g, 'k').replace(/sh/g, 's').replace(/th/g, 't').replace(/dh/g, 'd').replace(/gh/g, 'g').replace(/ph/g, 'f')
      .replace(/[jq]/g, 'g').replace(/c/g, 'k').replace(/[aeiouwy]/g, '');
  }
  return s.replace(/(.)\1+/g, '$1');
}

function skeletons(raw: string): string[] {
  const tokens = normalizeName(raw).split(' ').filter((t) => t && !DROP.has(t));
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    if (JOIN_NEXT.has(t) && tokens[i + 1]) t += tokens[++i];
    const sk = skeletonToken(t);
    if (sk.length >= 2) out.push(sk);
  }
  return out;
}

/** 0–1 similarity of two names, in the same or different scripts. */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const direct = nameScore(a, b);
  const A = skeletons(a);
  const B = skeletons(b);
  if (!A.length || !B.length) return direct;
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  const used = new Set<number>();
  let matched = 0;
  for (const t of short) {
    let best = 0;
    let at = -1;
    long.forEach((u, i) => {
      if (used.has(i)) return;
      const sim = t === u ? 1 : jaroWinkler(t, u);
      if (sim > best) { best = sim; at = i; }
    });
    if (at >= 0 && best >= 0.85) { used.add(at); matched += best; }
  }
  const skeleton = short.length === 1 && long.length > 1 ? matched / long.length : 0.7 * (matched / short.length) + 0.3 * (matched / long.length);
  // Consonant skeletons lose information, so they never beat a direct match outright.
  return Math.min(1, Math.max(direct, skeleton * 0.95));
}

function bestName(lineName: string | null, names: string[]): number {
  return names.reduce((best, n) => Math.max(best, nameSimilarity(lineName, n)), 0);
}

// ── References and amounts ───────────────────────────────────────────

const alnum = (s: string) => westernDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** 'exact' when the whole reference appears, 'partial' for its random part (what customers usually manage to type). */
export function referenceSignal(reference: string, ...texts: Array<string | null>): 'exact' | 'partial' | null {
  const hay = texts.filter(Boolean).map((t) => alnum(t!)).join(' ');
  if (!hay) return null;
  if (hay.includes(alnum(reference))) return 'exact';
  const tail = alnum(reference.split('-').pop() ?? '');
  return tail.length >= 8 && hay.includes(tail) ? 'partial' : null;
}

const same = (a: string, b: string) => new Decimal(a).eq(new Decimal(b));

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function accountSignal(line: LineFacts, c: CustomerFacts, typed: string | null): 'confirmed' | 'saved' | 'phone' | null {
  if (!line.accountKey) return null;
  if (c.confirmedAccountKeys.some((k) => accountsMatch(k, line.accountKey))) return 'confirmed';
  if ([...c.accountKeys, typed].some((k) => accountsMatch(k, line.accountKey))) return 'saved';
  if (accountsMatch(c.phoneKey, line.accountKey)) return 'phone';
  return null;
}

// ── Money in: a CREDIT line against a deposit request ────────────────

export function scoreDeposit(line: LineFacts, dep: DepositFacts, cust: CustomerFacts, accountOwnedByOther: boolean): Scored {
  const flags: Flag[] = [];
  const signals: Scored['signals'] = {};
  let score = 0;

  const ref = referenceSignal(dep.reference, line.narration, line.railRef);
  if (ref) { signals.reference = ref; score += ref === 'exact' ? 55 : 45; }

  const amountExact = same(line.amount, dep.amount);
  signals.amount = amountExact ? 'exact' : `${line.amount} vs ${dep.amount}`;
  if (amountExact) score += 25; else { flags.push('AMOUNT_DIFFERS'); score -= 15; }

  const acct = accountSignal(line, cust, dep.accountKey);
  if (acct) { signals.account = acct; score += acct === 'confirmed' ? 30 : 20; }
  else if (accountOwnedByOther) { signals.account = 'other customer'; flags.push('ACCOUNT_OF_OTHER_CUSTOMER'); score -= 30; }

  const nameSim = bestName(line.counterpartyName, [...cust.names, ...(dep.senderName ? [dep.senderName] : [])]);
  if (line.counterpartyName) {
    signals.name = Math.round(nameSim * 100) / 100;
    if (nameSim >= 0.85) score += 20;
    else if (nameSim >= 0.7) score += 12;
    else if (nameSim >= 0.5) score += 5;
    else if (nameSim < 0.3 && acct !== 'confirmed') { flags.push('NAME_MISMATCH'); score -= 20; }
  }

  const lag = line.valueDate.getTime() - dep.createdAt.getTime();
  if (lag < -DAY) { flags.push('PAID_BEFORE_REQUEST'); score -= 10; signals.timing = 'paid before the request'; }
  else if (lag <= 3 * DAY) { score += 5; signals.timing = 'within 3 days'; }
  else if (lag > 14 * DAY) { score -= 5; signals.timing = 'over 14 days later'; }

  const nameOk = !line.counterpartyName || nameSim >= 0.7;
  const strong = flags.length === 0 && amountExact && (Boolean(ref) || (acct !== null && nameOk));
  return { score: clamp(score), strong, flags, signals };
}

// ── Money out: a DEBIT line against a withdrawal ─────────────────────

export function scoreWithdrawal(line: LineFacts, wd: WithdrawalFacts, cust: CustomerFacts): Scored {
  const flags: Flag[] = [];
  const signals: Scored['signals'] = {};
  let score = 0;

  const ref = referenceSignal(wd.reference, line.narration, line.railRef);
  if (ref) { signals.reference = ref; score += 50; }

  const net = same(line.amount, wd.netAmount);
  const gross = same(line.amount, wd.amount);
  signals.amount = net ? 'net amount' : gross ? 'gross amount' : `${line.amount} vs ${wd.netAmount}`;
  if (net) score += 30; else if (gross) score += 25; else { flags.push('AMOUNT_DIFFERS'); score -= 15; }

  if (line.accountKey && wd.accountKey) {
    if (accountsMatch(line.accountKey, wd.accountKey)) { signals.account = 'payout account'; score += 35; }
    else { signals.account = 'different account'; flags.push('ACCOUNT_DIFFERS'); score -= 30; }
  }

  if (line.counterpartyName && wd.accountName) {
    const sim = nameSimilarity(line.counterpartyName, wd.accountName);
    signals.name = Math.round(sim * 100) / 100;
    if (sim >= 0.85) score += 15; else if (sim >= 0.7) score += 8; else if (sim < 0.3) { flags.push('NAME_MISMATCH'); score -= 10; }
  }

  // Paying someone other than the customer is allowed by the app but is an AML question.
  const beneficiary = wd.accountName ?? line.counterpartyName;
  if (beneficiary && cust.names.length && bestName(beneficiary, cust.names) < 0.5) flags.push('THIRD_PARTY_PAYOUT');
  if (wd.status === 'PENDING') { flags.push('PAID_NOT_MARKED'); signals.status = 'still pending in the app'; }

  const lag = line.valueDate.getTime() - wd.createdAt.getTime();
  if (lag < -HOUR) { flags.push('PAID_BEFORE_REQUEST'); score -= 20; } else score += 5;

  const blocking = flags.filter((f) => f !== 'THIRD_PARTY_PAYOUT');
  const strong = blocking.length === 0 && (net || gross) && (Boolean(ref) || signals.account === 'payout account');
  return { score: clamp(score), strong, flags, signals };
}

/**
 * Whether the best candidate can be confirmed in one click: strong, and
 * clearly ahead of the next one (two requests for the same amount from the
 * same customer stay with a person).
 */
export function clearWinner<T extends { scored: Scored }>(ranked: T[]): T | null {
  const [top, next] = ranked;
  if (!top || !top.scored.strong) return null;
  if (next && next.scored.score > top.scored.score - 15) return null;
  return top;
}
