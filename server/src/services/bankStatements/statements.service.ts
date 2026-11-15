/**
 * Bank statement matching: LyPay, OnePay and bank statements against
 * customers' deposit and withdrawal requests.
 *
 *   import (file or signed feed) → lines, de-duplicated across overlapping
 *   statements → counterparty sanctions screening → candidates scored by
 *   reference, confirmed account, amount, name and timing → staff accept.
 *
 * Accepting money in credits the deposit through confirmBankDeposit, so
 * segregation of duties, dual control above the threshold and exactly-once
 * crediting all still apply; nothing is credited by the matcher on its own.
 * Accepting money out links the bank debit to a completed withdrawal (proof
 * the payout left the bank). An accepted paying account is remembered for
 * the customer, so their next payment from it matches on the account.
 *
 * Money that may belong to someone else (another customer's account, a
 * different name, a payout to a third party, a sanctions hit) is flagged,
 * needs a written reason to accept, and opens an AML case.
 */
import { createHash } from 'crypto';
import { Currency, Prisma, type BankMatchCandidate, type BankStatementLine } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { generateReference } from '../../utils/helpers';
import { writeAudit } from '../platform/audit';
import type { Permission } from '../platform/rbac';
import { confirmBankDeposit } from '../wallet/bankDeposits.service';
import { openCase } from '../compliance/cases.service';
import { screenSubject } from '../compliance/screening.service';
import { accountKey, accountsMatch, dedupeKey, parseStatementFile, westernDigits, type Direction, type ParseOptions, type ParsedLine } from './parse';
import {
  AML_FLAGS, clearWinner, scoreDeposit, scoreWithdrawal,
  type CustomerFacts, type Flag, type LineFacts, type Scored,
} from './match';

export const SOURCES = ['LYPAY', 'ONEPAY', 'BANK', 'OTHER'] as const;
export type Source = (typeof SOURCES)[number];
type Req = { ip?: string; headers?: Record<string, any>; originalUrl?: string };
type Line = BankStatementLine;

const AWAITING = ['WAITING_CONFIRMATION', 'PENDING'] as const;
const OPEN_LINE = ['UNMATCHED', 'SUGGESTED', 'HELD'];
const DAY = 86_400_000;
const CURRENCIES = new Set<string>(Object.values(Currency));
const MAX_CANDIDATES = 5;
const MIN_SCORE = 20;

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

// ── Import ───────────────────────────────────────────────────────────

/** Parse without saving: shows which columns were found, so a new export format can be checked first. */
export function previewStatement(content: Buffer, options: ParseOptions) {
  const r = parseStatementFile(content, options);
  return {
    format: r.format, headerRow: r.headerRow, headers: r.headers, columns: r.columns,
    total: r.lines.length, skippedCount: r.skipped.length, skipped: r.skipped.slice(0, 50),
    sample: r.lines.slice(0, 20).map(({ raw: _raw, ...l }) => l),
    totals: totals(r.lines),
  };
}

function totals(lines: ParsedLine[]) {
  const sum = (d: Direction) => lines.filter((l) => l.direction === d).reduce((n, l) => n.add(l.amount), new Decimal(0)).toString();
  return { credits: lines.filter((l) => l.direction === 'CREDIT').length, debits: lines.filter((l) => l.direction === 'DEBIT').length, creditTotal: sum('CREDIT'), debitTotal: sum('DEBIT') };
}

export interface ImportInput {
  source: Source;
  platformBankAccountId?: string | null;
  fileName?: string | null;
  /** File bytes (CSV/XLSX), or the raw feed body. */
  content: Buffer;
  /** Feed lines already structured (bank or rail API); file content is parsed otherwise. */
  feedLines?: ParsedLine[];
  options?: ParseOptions;
  actorId?: string | null;
  req?: Req;
}

export async function importStatement(input: ImportInput) {
  const contentSha256 = sha256(input.content);
  const seen = await prisma.bankStatementImport.findUnique({ where: { contentSha256 } });
  if (seen) throw new AppError(`This ${seen.format === 'FEED' ? 'batch' : 'file'} was already imported on ${seen.createdAt.toISOString().slice(0, 10)}`, 409, 'DUPLICATE_REQUEST', { importId: seen.id });

  let lines: ParsedLine[];
  let format: string;
  let skipped: Array<{ row: number; reason: string }> = [];
  if (input.feedLines) { lines = input.feedLines; format = 'FEED'; }
  else {
    const parsed = parseStatementFile(input.content, input.options ?? {});
    lines = parsed.lines; format = parsed.format; skipped = parsed.skipped;
  }
  if (!lines.length) throw new AppError(`No money movements found in the ${format === 'FEED' ? 'batch' : 'file'}${skipped.length ? ` (${skipped.length} rows skipped: ${skipped[0].reason})` : ''}`, 400);

  // Identical rows in one file are kept apart by their position among equals.
  const occurrences = new Map<string, number>();
  const rows = lines.map((l) => {
    const base = dedupeKey(input.source, l, 0);
    const n = occurrences.get(base) ?? 0;
    occurrences.set(base, n + 1);
    return { line: l, key: l.railRef ? base : dedupeKey(input.source, l, n) };
  });
  const existing = new Set((await prisma.bankStatementLine.findMany({ where: { dedupeKey: { in: rows.map((r) => r.key) } }, select: { dedupeKey: true } })).map((r) => r.dedupeKey));
  const fresh = rows.filter((r) => !existing.has(r.key));
  const dates = lines.map((l) => l.valueDate.getTime());

  const imp = await prisma.$transaction(async (tx) => {
    const created = await tx.bankStatementImport.create({
      data: {
        source: input.source, platformBankAccountId: input.platformBankAccountId ?? null, fileName: input.fileName?.slice(0, 200) ?? null,
        contentSha256, format, lineCount: lines.length, newLines: fresh.length, duplicateLines: lines.length - fresh.length, skippedRows: skipped.length,
        periodStart: new Date(Math.min(...dates)), periodEnd: new Date(Math.max(...dates)), importedById: input.actorId ?? null,
      },
    });
    if (fresh.length) {
      await tx.bankStatementLine.createMany({
        skipDuplicates: true,
        data: fresh.map(({ line: l, key }) => ({
          importId: created.id, source: input.source, platformBankAccountId: input.platformBankAccountId ?? null,
          direction: l.direction, amount: l.amount, currency: l.currency, valueDate: l.valueDate,
          railRef: l.railRef?.slice(0, 120) ?? null, narration: l.narration?.slice(0, 500) ?? null,
          counterpartyName: l.counterpartyName?.slice(0, 200) ?? null, counterpartyAccount: l.counterpartyAccount?.slice(0, 64) ?? null,
          counterpartyBank: l.counterpartyBank?.slice(0, 120) ?? null, accountKey: accountKey(l.counterpartyAccount),
          dedupeKey: key, raw: l.raw as Prisma.InputJsonValue,
        })),
      });
    }
    if (input.actorId) {
      await writeAudit(tx, { actorId: input.actorId, action: 'BANK_STATEMENT_IMPORT', entity: 'BankStatementImport', entityId: created.id, after: { source: input.source, format, lines: lines.length, new: fresh.length, skipped: skipped.length }, req: input.req });
    }
    return created;
  });

  const newLines = await prisma.bankStatementLine.findMany({ where: { importId: imp.id } });
  const sanctionsHits = await screenCounterparties(newLines);
  const matching = await matchLines(newLines.map((l) => l.id));
  return { importId: imp.id, format, lines: lines.length, newLines: fresh.length, duplicates: lines.length - fresh.length, skipped: skipped.slice(0, 50), skippedCount: skipped.length, sanctionsHits, ...matching };
}

/** Screens each new counterparty name against the loaded sanctions lists; a hit holds the line and opens a case. */
async function screenCounterparties(lines: Line[]): Promise<number> {
  let hits = 0;
  const byName = new Map<string, Line[]>();
  for (const l of lines) if (l.counterpartyName) byName.set(l.counterpartyName, [...(byName.get(l.counterpartyName) ?? []), l]);
  for (const [name, group] of byName) {
    let outcome;
    try { outcome = await screenSubject({ name }); } catch (e) { logger.warn('[bank-statements] screening failed', { error: (e as Error).message }); continue; }
    if (outcome.status !== 'POTENTIAL_MATCH') continue;
    hits += group.length;
    for (const l of group) {
      await prisma.bankStatementLine.update({ where: { id: l.id }, data: { status: 'HELD', flags: { set: [...new Set([...l.flags, 'SANCTIONS_HIT'])] }, note: 'Held: counterparty matches a sanctions list' } });
    }
    // One case per counterparty, with every held line as evidence.
    await openCase({
      type: 'SANCTIONS', priority: 'CRITICAL', title: `Sanctions list match on ${group.length === 1 ? 'a statement line' : `${group.length} statement lines`}: ${name}`,
      summary: group.map((l) => `${l.source} ${l.direction === 'CREDIT' ? 'in' : 'out'} ${l.amount} ${l.currency} on ${l.valueDate.toISOString().slice(0, 10)}`).join('; ').slice(0, 2000),
      subjectType: 'BANK_STATEMENT_LINE', subjectId: group[0].id, evidence: { matches: outcome.matches, lines: group.map(lineEvidence) },
    });
  }
  return hits;
}

// ── Matching ─────────────────────────────────────────────────────────

const lineFacts = (l: Line): LineFacts => ({
  direction: l.direction as Direction, amount: l.amount.toString(), currency: l.currency, valueDate: l.valueDate,
  railRef: l.railRef, narration: l.narration, counterpartyName: l.counterpartyName, accountKey: l.accountKey,
});

/** Tokens in the payment text that could be the random part of one of our references. */
function referenceTails(...texts: Array<string | null>): string[] {
  const tails = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const tok of westernDigits(t).toUpperCase().split(/[^A-Z0-9]+/)) {
      if (tok.length >= 8) tails.add(tok.slice(-8));
    }
  }
  return [...tails].slice(0, 12);
}

/** Customers tied to a bank account or wallet number, and how. */
async function accountOwners(key: string | null): Promise<Map<string, 'confirmed' | 'saved' | 'phone'>> {
  const owners = new Map<string, 'confirmed' | 'saved' | 'phone'>();
  if (!key) return owners;
  const tail = key.slice(-6);
  const [links, saved, phones] = await Promise.all([
    prisma.bankPayerLink.findMany({ where: { accountKey: { endsWith: tail } }, select: { userId: true, accountKey: true } }),
    prisma.bankAccount.findMany({ where: { OR: [{ accountNumber: { contains: tail } }, { iban: { contains: tail } }] }, select: { userId: true, accountNumber: true, iban: true } }),
    prisma.user.findMany({ where: { phone: { contains: tail } }, select: { id: true, phone: true } }),
  ]);
  for (const p of phones) if (accountsMatch(accountKey(p.phone), key)) owners.set(p.id, 'phone');
  for (const s of saved) if (accountsMatch(accountKey(s.accountNumber), key) || accountsMatch(accountKey(s.iban), key)) owners.set(s.userId, 'saved');
  for (const l of links) if (accountsMatch(l.accountKey, key)) owners.set(l.userId, 'confirmed');
  return owners;
}

async function loadCustomers(userIds: string[]): Promise<Map<string, CustomerFacts>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const [users, businesses, accounts, links] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, phone: true } }),
    prisma.businessProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, legalName: true } }),
    prisma.bankAccount.findMany({ where: { userId: { in: ids } }, select: { userId: true, accountName: true, accountNumber: true, iban: true } }),
    prisma.bankPayerLink.findMany({ where: { userId: { in: ids } }, select: { userId: true, accountKey: true, name: true } }),
  ]);
  const out = new Map<string, CustomerFacts>();
  for (const u of users) {
    out.set(u.id, { userId: u.id, names: [`${u.firstName} ${u.lastName}`.trim()].filter(Boolean), accountKeys: [], confirmedAccountKeys: [], phoneKey: accountKey(u.phone) });
  }
  for (const b of businesses) if (b.legalName) out.get(b.userId)?.names.push(b.legalName);
  for (const a of accounts) {
    const c = out.get(a.userId);
    if (!c) continue;
    if (a.accountName) c.names.push(a.accountName);
    for (const k of [accountKey(a.accountNumber), accountKey(a.iban)]) if (k) c.accountKeys.push(k);
  }
  for (const l of links) {
    const c = out.get(l.userId);
    if (!c) continue;
    c.confirmedAccountKeys.push(l.accountKey);
    if (l.name) c.names.push(l.name);
  }
  return out;
}

async function linkedTargets(type: 'DEPOSIT' | 'WITHDRAWAL', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await prisma.bankStatementLine.findMany({ where: { matchedType: type, matchedId: { in: ids } }, select: { matchedId: true } });
  return new Set(rows.map((r) => r.matchedId!));
}

type Ranked = { targetType: 'DEPOSIT' | 'WITHDRAWAL'; targetId: string; userId: string; scored: Scored };

async function rankCredit(line: Line): Promise<Ranked[]> {
  if (!CURRENCIES.has(line.currency)) return [];
  const owners = await accountOwners(line.accountKey);
  const or: Prisma.DepositWhereInput[] = [{ amount: line.amount }];
  for (const tail of referenceTails(line.narration, line.railRef)) or.push({ reference: { endsWith: tail } });
  if (owners.size) or.push({ userId: { in: [...owners.keys()] } });
  const deposits = await prisma.deposit.findMany({
    where: {
      status: { in: [...AWAITING] }, currency: line.currency as Currency,
      createdAt: { gte: new Date(line.valueDate.getTime() - 30 * DAY), lte: new Date(line.valueDate.getTime() + DAY) }, OR: or,
    },
    take: 60,
  });
  const taken = await linkedTargets('DEPOSIT', deposits.map((d) => d.id));
  const open = deposits.filter((d) => !taken.has(d.id));
  const customers = await loadCustomers(open.map((d) => d.userId));
  const facts = lineFacts(line);
  return open.flatMap((d) => {
    const cust = customers.get(d.userId);
    if (!cust) return [];
    const ownedByOther = [...owners.keys()].some((u) => u !== d.userId);
    const scored = scoreDeposit(facts, {
      id: d.id, userId: d.userId, reference: d.reference, amount: d.amount.toString(), currency: d.currency, createdAt: d.createdAt,
      senderName: d.senderName, accountKey: accountKey(d.accountNumber),
    }, cust, ownedByOther);
    return [{ targetType: 'DEPOSIT' as const, targetId: d.id, userId: d.userId, scored }];
  });
}

async function rankDebit(line: Line): Promise<Ranked[]> {
  if (!CURRENCIES.has(line.currency)) return [];
  const or: Prisma.WithdrawalWhereInput[] = [{ netAmount: line.amount }, { amount: line.amount }];
  for (const tail of referenceTails(line.narration, line.railRef)) or.push({ reference: { endsWith: tail } });
  if (line.accountKey) or.push({ accountNumber: { contains: line.accountKey.slice(-6) } });
  const withdrawals = await prisma.withdrawal.findMany({
    where: {
      status: { in: ['PENDING', 'COMPLETED'] }, currency: line.currency as Currency, walletAddress: null,
      createdAt: { gte: new Date(line.valueDate.getTime() - 30 * DAY), lte: new Date(line.valueDate.getTime() + DAY) }, OR: or,
    },
    take: 60,
  });
  const taken = await linkedTargets('WITHDRAWAL', withdrawals.map((w) => w.id));
  const open = withdrawals.filter((w) => !taken.has(w.id));
  const customers = await loadCustomers(open.map((w) => w.userId));
  const facts = lineFacts(line);
  return open.flatMap((w) => {
    const cust = customers.get(w.userId);
    if (!cust) return [];
    const scored = scoreWithdrawal(facts, {
      id: w.id, userId: w.userId, reference: w.reference, amount: w.amount.toString(), netAmount: w.netAmount.toString(),
      currency: w.currency, createdAt: w.createdAt, status: w.status, accountName: w.accountName, accountKey: accountKey(w.accountNumber),
    }, cust);
    return [{ targetType: 'WITHDRAWAL' as const, targetId: w.id, userId: w.userId, scored }];
  });
}

export async function matchLine(line: Line): Promise<{ suggested: boolean; strong: boolean }> {
  const ranked = (line.direction === 'CREDIT' ? await rankCredit(line) : await rankDebit(line))
    .filter((r) => r.scored.score >= MIN_SCORE)
    .sort((a, b) => b.scored.score - a.scored.score)
    .slice(0, MAX_CANDIDATES);
  const winner = clearWinner(ranked);
  const lineFlags = line.flags.filter((f) => f === 'SANCTIONS_HIT');
  await prisma.$transaction(async (tx) => {
    await tx.bankMatchCandidate.deleteMany({ where: { lineId: line.id, status: 'OPEN' } });
    if (ranked.length) {
      await tx.bankMatchCandidate.createMany({
        skipDuplicates: true,
        data: ranked.map((r) => ({
          lineId: line.id, targetType: r.targetType, targetId: r.targetId, userId: r.userId, score: r.scored.score,
          flags: r.scored.flags, signals: { ...r.scored.signals, strong: r.scored.strong, clearWinner: winner === r } as Prisma.InputJsonValue,
        })),
      });
    }
    await tx.bankStatementLine.updateMany({
      where: { id: line.id, status: { in: ['UNMATCHED', 'SUGGESTED'] } },
      data: {
        status: ranked.length ? 'SUGGESTED' : 'UNMATCHED', bestScore: ranked[0]?.scored.score ?? null,
        flags: { set: [...new Set([...lineFlags, ...(ranked[0]?.scored.flags ?? [])])] },
      },
    });
  });
  return { suggested: ranked.length > 0, strong: Boolean(winner) };
}

/** Re-scores open lines (all, or the given ones) — run after new requests arrive or customers save accounts. */
export async function matchLines(lineIds?: string[]) {
  const lines = await prisma.bankStatementLine.findMany({
    where: { status: { in: ['UNMATCHED', 'SUGGESTED'] }, ...(lineIds ? { id: { in: lineIds } } : {}) },
    orderBy: { valueDate: 'asc' }, take: 2000,
  });
  let suggested = 0;
  let strong = 0;
  for (const l of lines) {
    try {
      const r = await matchLine(l);
      if (r.suggested) suggested++;
      if (r.strong) strong++;
    } catch (e) {
      logger.error('[bank-statements] matching failed for a line', { lineId: l.id, error: (e as Error).message });
    }
  }
  return { checked: lines.length, suggested, strong };
}

// ── Staff decisions ──────────────────────────────────────────────────

function lineEvidence(l: Line) {
  return {
    lineId: l.id, source: l.source, direction: l.direction, amount: l.amount.toString(), currency: l.currency, valueDate: l.valueDate,
    railRef: l.railRef, narration: l.narration, counterpartyName: l.counterpartyName, counterpartyAccount: l.counterpartyAccount, counterpartyBank: l.counterpartyBank,
  };
}

function needPermission(perms: Set<Permission> | undefined, p: Permission) {
  if (!perms?.has(p)) throw new AppError(`Missing permission: ${p}`, 403, 'AUTHORIZATION');
}

async function rememberAccount(userId: string, line: Line, staffId: string) {
  if (!line.accountKey) return;
  await prisma.bankPayerLink.upsert({
    where: { userId_accountKey: { userId, accountKey: line.accountKey } },
    update: { timesSeen: { increment: 1 }, lastSeenAt: new Date(), name: line.counterpartyName ?? undefined },
    create: { userId, accountKey: line.accountKey, name: line.counterpartyName, source: 'CONFIRMED_MATCH', confirmedById: staffId },
  });
}

async function amlCaseFor(line: Line, userId: string, flags: string[], staffId: string, reason: string) {
  const aml = flags.filter((f) => (AML_FLAGS as string[]).includes(f));
  if (!aml.length) return null;
  const words: Record<string, string> = {
    ACCOUNT_OF_OTHER_CUSTOMER: 'paid from an account linked to another customer',
    NAME_MISMATCH: 'payer name differs from the customer',
    THIRD_PARTY_PAYOUT: 'payout to an account in another name',
    SANCTIONS_HIT: 'counterparty matches a sanctions list',
  };
  return openCase({
    type: 'AML', priority: aml.includes('SANCTIONS_HIT') || aml.includes('ACCOUNT_OF_OTHER_CUSTOMER') ? 'HIGH' : 'MEDIUM',
    title: `Third-party money: ${aml.map((f) => words[f] ?? f).join('; ')}`,
    summary: `${line.source} ${line.direction === 'CREDIT' ? 'payment in' : 'payment out'} of ${line.amount} ${line.currency} accepted by staff. Reason: ${reason}`,
    subjectUserId: userId, subjectType: 'BANK_STATEMENT_LINE', subjectId: line.id, openedById: staffId,
    evidence: { line: lineEvidence(line), flags: aml },
  });
}

export async function acceptMatch(input: {
  lineId: string;
  candidateId: string;
  reason?: string | null;
  staffId: string;
  permissions?: Set<Permission>;
  req?: Req;
}) {
  const line = await prisma.bankStatementLine.findUnique({ where: { id: input.lineId } });
  if (!line) throw new AppError('Statement line not found', 404);
  if (!OPEN_LINE.includes(line.status)) throw new AppError(`This line is already ${line.status.toLowerCase()}`, 409);
  const cand = await prisma.bankMatchCandidate.findUnique({ where: { id: input.candidateId } });
  if (!cand || cand.lineId !== line.id) throw new AppError('Candidate not found for this line', 404);
  const flags = [...new Set([...cand.flags, ...line.flags])];
  const reason = input.reason?.trim() ?? '';
  if (flags.length && reason.length < 10) throw new AppError(`This match is flagged (${flags.join(', ').toLowerCase().replace(/_/g, ' ')}). Write a reason of at least 10 characters to accept it.`, 400, 'VALIDATION', { flags, reasonRequired: true });
  if (line.flags.includes('SANCTIONS_HIT')) needPermission(input.permissions, 'compliance.decide');

  if (cand.targetType === 'DEPOSIT') {
    needPermission(input.permissions, 'deposits.confirm');
    return acceptDeposit(line, cand, flags, reason, input);
  }
  needPermission(input.permissions, 'withdrawals.approve');
  return acceptWithdrawal(line, cand, flags, reason, input);
}

type Cand = BankMatchCandidate;

async function claimLine(line: Line, cand: Cand, staffId: string) {
  try {
    const moved = await prisma.bankStatementLine.updateMany({
      where: { id: line.id, status: { in: OPEN_LINE } },
      data: { status: 'MATCHED', matchedType: cand.targetType, matchedId: cand.targetId, matchedById: staffId, matchedAt: new Date() },
    });
    if (moved.count !== 1) throw new AppError('This line was just matched by someone else', 409);
  } catch (e) {
    if ((e as any)?.code === 'P2002') throw new AppError(`That ${cand.targetType.toLowerCase()} is already matched to another statement line`, 409);
    throw e;
  }
}

async function releaseLine(line: Line) {
  await prisma.bankStatementLine.update({ where: { id: line.id }, data: { status: line.status, matchedType: null, matchedId: null, matchedById: null, matchedAt: null } });
}

async function finishAccept(line: Line, cand: Cand, flags: string[], reason: string, input: { staffId: string; req?: Req }, extra: Record<string, unknown>) {
  await prisma.bankMatchCandidate.updateMany({ where: { lineId: line.id, id: { not: cand.id }, status: 'OPEN' }, data: { status: 'REJECTED' } });
  await prisma.bankMatchCandidate.update({ where: { id: cand.id }, data: { status: 'ACCEPTED' } });
  const amlCase = await amlCaseFor(line, cand.userId, flags, input.staffId, reason || 'accepted');
  await writeAudit(prisma, {
    actorId: input.staffId, action: 'BANK_STATEMENT_MATCH', entity: 'BankStatementLine', entityId: line.id,
    before: { status: line.status }, after: { status: 'MATCHED', targetType: cand.targetType, targetId: cand.targetId, score: cand.score, flags, caseId: amlCase?.id ?? null, ...extra },
    reason: reason || null, req: input.req,
  });
  return { caseId: amlCase?.id ?? null };
}

async function acceptDeposit(line: Line, cand: Cand, flags: string[], reason: string, input: { staffId: string; permissions?: Set<Permission>; req?: Req }) {
  if (line.direction !== 'CREDIT') throw new AppError('Only money in can match a deposit', 400);
  const deposit = await prisma.deposit.findUnique({ where: { id: cand.targetId } });
  if (!deposit) throw new AppError('Deposit not found', 404);
  if (deposit.currency !== line.currency) throw new AppError('The deposit is in a different currency', 400);
  const awaiting = (AWAITING as readonly string[]).includes(deposit.status);
  if (!awaiting && deposit.status !== 'CONFIRMED') throw new AppError(`The deposit is ${deposit.status.toLowerCase()}`, 409);
  const received = new Decimal(line.amount.toString());
  const differs = !received.eq(new Decimal(deposit.amount.toString()));
  if (differs && !awaiting) throw new AppError('The deposit was already credited with a different amount — resolve it with a ledger adjustment', 409);

  await claimLine(line, cand, input.staffId);
  let outcome: Record<string, unknown> = { credited: false, alreadyConfirmed: !awaiting };
  try {
    if (awaiting) {
      if (differs) {
        // Credit what actually arrived, not what the customer said they'd send.
        await prisma.deposit.updateMany({ where: { id: deposit.id, status: { in: [...AWAITING] } }, data: { amount: received, adminNotes: `Amount set to ${received} received on ${line.source} (request said ${deposit.amount}). ${reason}`.slice(0, 1000) } });
      }
      const result = await confirmBankDeposit({
        depositId: deposit.id, staffId: input.staffId, permissions: input.permissions, req: input.req,
        notes: `Matched to ${line.source} ${line.railRef ?? line.id} (${line.valueDate.toISOString().slice(0, 10)})${reason ? ` — ${reason}` : ''}`.slice(0, 1000),
      });
      outcome = { ...result };
    }
  } catch (e) {
    await releaseLine(line);
    throw e;
  }
  await rememberAccount(cand.userId, line, input.staffId);
  const done = await finishAccept(line, cand, flags, reason, input, { amountAdjusted: differs });
  return { matched: true, targetType: 'DEPOSIT', targetId: deposit.id, ...outcome, ...done };
}

async function acceptWithdrawal(line: Line, cand: Cand, flags: string[], reason: string, input: { staffId: string; req?: Req }) {
  if (line.direction !== 'DEBIT') throw new AppError('Only money out can match a withdrawal', 400);
  const wd = await prisma.withdrawal.findUnique({ where: { id: cand.targetId } });
  if (!wd) throw new AppError('Withdrawal not found', 404);
  if (wd.status !== 'COMPLETED') throw new AppError('The bank shows this payout, but the withdrawal is not completed in Tazdan yet. Process it from the withdrawals queue first, then accept the match.', 409);
  await claimLine(line, cand, input.staffId);
  if (!flags.includes('THIRD_PARTY_PAYOUT')) await rememberAccount(cand.userId, line, input.staffId);
  const done = await finishAccept(line, cand, flags, reason, input, {});
  return { matched: true, targetType: 'WITHDRAWAL', targetId: wd.id, payoutConfirmed: true, ...done };
}

/** One click for every strong, clear deposit match. Flagged or ambiguous lines stay for a person. */
export async function acceptStrongDeposits(input: { staffId: string; permissions?: Set<Permission>; req?: Req; limit?: number }) {
  needPermission(input.permissions, 'deposits.confirm');
  const cands = await prisma.bankMatchCandidate.findMany({
    where: { status: 'OPEN', targetType: 'DEPOSIT', flags: { isEmpty: true }, signals: { path: ['clearWinner'], equals: true }, line: { status: 'SUGGESTED', direction: 'CREDIT', flags: { isEmpty: true } } },
    orderBy: { score: 'desc' }, take: Math.min(input.limit ?? 100, 200),
  });
  const results: Array<{ lineId: string; ok: boolean; credited?: boolean; pendingApproval?: boolean; error?: string }> = [];
  for (const c of cands) {
    try {
      const r: any = await acceptMatch({ lineId: c.lineId, candidateId: c.id, staffId: input.staffId, permissions: input.permissions, req: input.req });
      results.push({ lineId: c.lineId, ok: true, credited: Boolean(r.credited), pendingApproval: Boolean(r.pendingApproval) });
    } catch (e) {
      results.push({ lineId: c.lineId, ok: false, error: (e as Error).message });
    }
  }
  return { attempted: cands.length, accepted: results.filter((r) => r.ok).length, results };
}

/**
 * Money in that no request explains: create the customer's deposit from the
 * line and accept it (still through confirmation and dual control).
 */
export async function assignLineToCustomer(input: { lineId: string; userId: string; reason: string; staffId: string; permissions?: Set<Permission>; req?: Req }) {
  needPermission(input.permissions, 'deposits.confirm');
  if (!input.reason || input.reason.trim().length < 10) throw new AppError('A reason of at least 10 characters is required', 400);
  const line = await prisma.bankStatementLine.findUnique({ where: { id: input.lineId } });
  if (!line) throw new AppError('Statement line not found', 404);
  if (line.direction !== 'CREDIT') throw new AppError('Only money in can be assigned to a customer', 400);
  if (!OPEN_LINE.includes(line.status)) throw new AppError(`This line is already ${line.status.toLowerCase()}`, 409);
  if (!CURRENCIES.has(line.currency)) throw new AppError(`${line.currency} is not a wallet currency`, 400);
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, kycStatus: true, firstName: true, lastName: true } });
  if (!user) throw new AppError('Customer not found', 404);
  if (user.kycStatus !== 'APPROVED') throw new AppError('The customer must pass KYC before money can be credited to them', 400);

  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id, currency: line.currency as Currency, amount: line.amount, paymentMethod: 'BANK_TRANSFER', reference: generateReference('DEP'),
      bankName: line.counterpartyBank, accountNumber: line.counterpartyAccount, senderName: line.counterpartyName, status: 'WAITING_CONFIRMATION',
      notes: `Created by staff from a ${line.source} statement line: ${input.reason.trim()}`.slice(0, 1000),
    },
  });
  const owners = await accountOwners(line.accountKey);
  const cust = (await loadCustomers([user.id])).get(user.id)!;
  const scored = scoreDeposit(lineFacts(line), {
    id: deposit.id, userId: user.id, reference: deposit.reference, amount: deposit.amount.toString(), currency: deposit.currency,
    createdAt: line.valueDate, senderName: null, accountKey: null,
  }, cust, [...owners.keys()].some((u) => u !== user.id));
  const cand = await prisma.bankMatchCandidate.upsert({
    where: { lineId_targetType_targetId: { lineId: line.id, targetType: 'DEPOSIT', targetId: deposit.id } },
    update: {},
    create: { lineId: line.id, targetType: 'DEPOSIT', targetId: deposit.id, userId: user.id, score: scored.score, flags: scored.flags, signals: { ...scored.signals, assignedByStaff: true } as Prisma.InputJsonValue },
  });
  try {
    return await acceptMatch({ lineId: line.id, candidateId: cand.id, reason: input.reason, staffId: input.staffId, permissions: input.permissions, req: input.req });
  } catch (e) {
    await prisma.deposit.updateMany({ where: { id: deposit.id, status: 'WAITING_CONFIRMATION' }, data: { status: 'CANCELLED', adminNotes: `Assignment failed: ${(e as Error).message}`.slice(0, 1000) } });
    await prisma.bankMatchCandidate.delete({ where: { id: cand.id } }).catch(() => {});
    throw e;
  }
}

export async function setLineStatus(input: { lineId: string; status: 'HELD' | 'IGNORED' | 'UNMATCHED'; reason: string; staffId: string; req?: Req }) {
  if (!input.reason || input.reason.trim().length < 5) throw new AppError('A reason is required', 400);
  const line = await prisma.bankStatementLine.findUnique({ where: { id: input.lineId } });
  if (!line) throw new AppError('Statement line not found', 404);
  if (line.status === 'MATCHED') throw new AppError('A matched line cannot be changed here', 409);
  if (line.flags.includes('SANCTIONS_HIT') && input.status !== 'HELD') throw new AppError('A line with a sanctions match stays held until compliance closes the case', 409);
  await prisma.bankStatementLine.update({ where: { id: line.id }, data: { status: input.status, note: input.reason.trim().slice(0, 500) } });
  await writeAudit(prisma, { actorId: input.staffId, action: 'BANK_STATEMENT_LINE_STATUS', entity: 'BankStatementLine', entityId: line.id, before: { status: line.status }, after: { status: input.status }, reason: input.reason, req: input.req });
  if (input.status === 'UNMATCHED') await matchLine({ ...line, status: 'UNMATCHED' });
  return { ok: true };
}

export async function openLineCase(input: { lineId: string; reason: string; userId?: string | null; staffId: string }) {
  if (!input.reason || input.reason.trim().length < 10) throw new AppError('A reason of at least 10 characters is required', 400);
  const line = await prisma.bankStatementLine.findUnique({ where: { id: input.lineId } });
  if (!line) throw new AppError('Statement line not found', 404);
  const c = await openCase({
    type: 'AML', priority: 'MEDIUM', title: `Review a ${line.source} ${line.direction === 'CREDIT' ? 'payment in' : 'payment out'} of ${line.amount} ${line.currency}`,
    summary: input.reason.trim(), subjectUserId: input.userId ?? null, subjectType: 'BANK_STATEMENT_LINE', subjectId: line.id, openedById: input.staffId,
    evidence: { line: lineEvidence(line), flags: line.flags },
  });
  return { caseId: c.id, reference: c.reference };
}

// ── Reads ────────────────────────────────────────────────────────────

const personName = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

export async function listLines(filter: { status?: string; direction?: string; source?: string; q?: string; flagged?: boolean; page?: number; limit?: number }) {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where: Prisma.BankStatementLineWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.direction ? { direction: filter.direction } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.flagged ? { NOT: { flags: { isEmpty: true } } } : {}),
    ...(filter.q ? { OR: [
      { counterpartyName: { contains: filter.q, mode: 'insensitive' } }, { narration: { contains: filter.q, mode: 'insensitive' } },
      { railRef: { contains: filter.q, mode: 'insensitive' } }, { accountKey: { contains: filter.q.replace(/\D/g, '') || '__none__' } },
    ] } : {}),
  };
  const [lines, total, byStatus] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where, orderBy: [{ valueDate: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit,
      include: { candidates: { where: { status: { in: ['OPEN', 'ACCEPTED'] } }, orderBy: { score: 'desc' }, take: 3 } },
    }),
    prisma.bankStatementLine.count({ where }),
    prisma.bankStatementLine.groupBy({ by: ['status', 'direction'], _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const userIds = [...new Set(lines.flatMap((l) => l.candidates.map((c) => c.userId)))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, username: true } })).map((u) => [u.id, u]));
  return {
    page, limit, total,
    summary: byStatus.map((s) => ({ status: s.status, direction: s.direction, count: s._count._all, amount: s._sum.amount?.toString() ?? '0' })),
    lines: lines.map(({ raw: _raw, ...l }) => ({
      ...l,
      candidates: l.candidates.map((c) => ({ ...c, customer: users.get(c.userId) ? { id: c.userId, name: personName(users.get(c.userId)), username: users.get(c.userId)!.username } : { id: c.userId, name: null } })),
    })),
  };
}

export async function lineDetail(id: string) {
  const line = await prisma.bankStatementLine.findUnique({ where: { id }, include: { import: true, candidates: { orderBy: { score: 'desc' } } } });
  if (!line) throw new AppError('Statement line not found', 404);
  const depIds = line.candidates.filter((c) => c.targetType === 'DEPOSIT').map((c) => c.targetId);
  const wdIds = line.candidates.filter((c) => c.targetType === 'WITHDRAWAL').map((c) => c.targetId);
  const [deposits, withdrawals, users] = await Promise.all([
    prisma.deposit.findMany({ where: { id: { in: depIds } }, select: { id: true, reference: true, amount: true, currency: true, status: true, createdAt: true, senderName: true, accountNumber: true, bankName: true } }),
    prisma.withdrawal.findMany({ where: { id: { in: wdIds } }, select: { id: true, reference: true, amount: true, netAmount: true, currency: true, status: true, createdAt: true, processedAt: true, accountName: true, accountNumber: true, bankName: true } }),
    prisma.user.findMany({ where: { id: { in: line.candidates.map((c) => c.userId) } }, select: { id: true, firstName: true, lastName: true, username: true, kycStatus: true } }),
  ]);
  const targets = new Map<string, unknown>([...deposits.map((d) => [d.id, d] as const), ...withdrawals.map((w) => [w.id, w] as const)]);
  const people = new Map(users.map((u) => [u.id, u]));
  return {
    ...line,
    candidates: line.candidates.map((c) => ({ ...c, target: targets.get(c.targetId) ?? null, customer: people.get(c.userId) ? { ...people.get(c.userId)!, name: personName(people.get(c.userId)) } : null })),
  };
}

export async function listImports(limit = 50) {
  return prisma.bankStatementImport.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 200) });
}

/** What still needs a person: unexplained money in or out, payouts the bank never showed, deposits nobody paid. */
export async function exceptions() {
  const now = Date.now();
  const first = await prisma.bankStatementImport.findFirst({ orderBy: { periodStart: 'asc' }, select: { periodStart: true } });
  const sinceStatements = first?.periodStart ?? null;
  const [unexplainedIn, unexplainedOut, held, matchedWithdrawals] = await Promise.all([
    prisma.bankStatementLine.findMany({ where: { direction: 'CREDIT', status: { in: ['UNMATCHED', 'SUGGESTED'] }, createdAt: { lt: new Date(now - DAY) } }, orderBy: { valueDate: 'asc' }, take: 50 }),
    prisma.bankStatementLine.findMany({ where: { direction: 'DEBIT', status: { in: ['UNMATCHED', 'SUGGESTED'] } }, orderBy: { valueDate: 'asc' }, take: 50 }),
    prisma.bankStatementLine.findMany({ where: { status: 'HELD' }, orderBy: { valueDate: 'asc' }, take: 50 }),
    prisma.bankStatementLine.findMany({ where: { matchedType: 'WITHDRAWAL' }, select: { matchedId: true } }),
  ]);
  // Only payouts made since statements started arriving can be expected on one.
  const unconfirmedPayouts = sinceStatements ? (await prisma.withdrawal.findMany({
    where: {
      status: 'COMPLETED', walletAddress: null, processedAt: { gte: sinceStatements, lt: new Date(now - 3 * DAY) },
      id: { notIn: matchedWithdrawals.map((m) => m.matchedId!) },
    },
    select: { id: true, reference: true, userId: true, amount: true, netAmount: true, currency: true, processedAt: true, accountName: true, bankName: true },
    orderBy: { processedAt: 'asc' }, take: 50,
  })) : [];
  const unpaidDeposits = await prisma.deposit.findMany({
    where: { status: { in: [...AWAITING] }, paymentMethod: 'BANK_TRANSFER', createdAt: { lt: new Date(now - 3 * DAY) } },
    select: { id: true, reference: true, userId: true, amount: true, currency: true, createdAt: true, senderName: true },
    orderBy: { createdAt: 'asc' }, take: 50,
  });
  const strip = (ls: Line[]) => ls.map(({ raw: _raw, ...l }) => l);
  return { sinceStatements, unexplainedIn: strip(unexplainedIn), unexplainedOut: strip(unexplainedOut), held: strip(held), unconfirmedPayouts, unpaidDeposits };
}
