/**
 * Matching a statement line to a deposit or withdrawal request: references,
 * confirmed accounts, Arabic/Latin names, amounts, timing and AML flags.
 */
import { clearWinner, nameSimilarity, referenceSignal, scoreDeposit, scoreWithdrawal, type CustomerFacts, type LineFacts } from '../services/bankStatements/match';

const at = (iso: string) => new Date(iso);
const customer = (over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  userId: 'u1', names: ['Mohamed Alwarfalli'], accountKeys: [], confirmedAccountKeys: [], phoneKey: null, ...over,
});
const credit = (over: Partial<LineFacts> = {}): LineFacts => ({
  direction: 'CREDIT', amount: '1500.000', currency: 'LYD', valueDate: at('2026-11-14T09:00:00Z'),
  railRef: null, narration: null, counterpartyName: null, accountKey: null, ...over,
});
const deposit = (over: Record<string, unknown> = {}) => ({
  id: 'd1', userId: 'u1', reference: 'DEP-MH2X9A-7F3C1B2A', amount: '1500', currency: 'LYD',
  createdAt: at('2026-11-14T08:00:00Z'), senderName: null, accountKey: null, ...over,
});

describe('names across Arabic and Latin script', () => {
  it('matches the same person written in either script, partially or in full', () => {
    expect(nameSimilarity('محمد علي الورفلي', 'Mohamed Alwarfalli')).toBeGreaterThanOrEqual(0.7);
    expect(nameSimilarity('عبد الرحمن سالم', 'Abdulrahman Salem')).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity('MOHAMMED ALI ALWARFALLI', 'Mohamed Alwarfalli')).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity('أحمد', 'احمد')).toBe(1);
  });
  it('keeps different people apart', () => {
    expect(nameSimilarity('خالد مصطفى الزوي', 'Mohamed Alwarfalli')).toBeLessThan(0.3);
    expect(nameSimilarity('Fatima Ben Omran', 'Mohamed Alwarfalli')).toBeLessThan(0.3);
  });
});

describe('references', () => {
  it('finds our reference in full, or its random part as customers usually type it', () => {
    expect(referenceSignal('DEP-MH2X9A-7F3C1B2A', 'تحويل DEP-MH2X9A-7F3C1B2A')).toBe('exact');
    expect(referenceSignal('DEP-MH2X9A-7F3C1B2A', 'payment 7f3c 1b2a')).toBe('partial');
    expect(referenceSignal('DEP-MH2X9A-7F3C1B2A', 'payment MH2X9A')).toBeNull();
  });
});

describe('money in against a deposit request', () => {
  it('reference + amount is a strong match', () => {
    const s = scoreDeposit(credit({ narration: 'DEP-MH2X9A-7F3C1B2A' }), deposit(), customer(), false);
    expect(s.strong).toBe(true);
    expect(s.flags).toEqual([]);
    expect(s.score).toBeGreaterThanOrEqual(80);
  });

  it('a confirmed paying account + amount + name matches without any reference', () => {
    const s = scoreDeposit(credit({ accountKey: '20100120361', counterpartyName: 'محمد علي الورفلي' }), deposit(), customer({ confirmedAccountKeys: ['20100120361'] }), false);
    expect(s.signals).toMatchObject({ account: 'confirmed', amount: 'exact' });
    expect(s.strong).toBe(true);
  });

  it('an OnePay wallet that is the customer’s phone number counts as their account', () => {
    const s = scoreDeposit(credit({ accountKey: '912345678', counterpartyName: 'Mohamed Alwarfalli' }), deposit(), customer({ phoneKey: '218912345678' }), false);
    expect(s.signals.account).toBe('phone');
    expect(s.strong).toBe(true);
  });

  it('flags money from another customer’s account, another name, or a different amount — never strong', () => {
    const other = scoreDeposit(credit({ narration: 'DEP-MH2X9A-7F3C1B2A', accountKey: '55500011122' }), deposit(), customer(), true);
    expect(other.flags).toContain('ACCOUNT_OF_OTHER_CUSTOMER');
    expect(other.strong).toBe(false);
    const name = scoreDeposit(credit({ narration: 'DEP-MH2X9A-7F3C1B2A', counterpartyName: 'خالد مصطفى الزوي' }), deposit(), customer(), false);
    expect(name.flags).toContain('NAME_MISMATCH');
    expect(name.strong).toBe(false);
    const amount = scoreDeposit(credit({ narration: 'DEP-MH2X9A-7F3C1B2A', amount: '1400' }), deposit(), customer(), false);
    expect(amount.flags).toContain('AMOUNT_DIFFERS');
    expect(amount.strong).toBe(false);
  });

  it('an amount alone is a weak suggestion, not a match', () => {
    const s = scoreDeposit(credit(), deposit(), customer(), false);
    expect(s.strong).toBe(false);
    expect(s.score).toBeLessThan(50);
  });

  it('two equally good requests leave the choice to a person', () => {
    const a = { scored: scoreDeposit(credit({ narration: 'DEP-MH2X9A-7F3C1B2A' }), deposit(), customer(), false) };
    const b = { scored: { ...a.scored } };
    expect(clearWinner([a, b])).toBeNull();
    expect(clearWinner([a])).toBe(a);
  });
});

describe('money out against a withdrawal', () => {
  const wd = (over: Record<string, unknown> = {}) => ({
    id: 'w1', userId: 'u1', reference: 'WDR-MH3A1B-99AA11BB', amount: '1010', netAmount: '1000', currency: 'LYD',
    createdAt: at('2026-11-13T08:00:00Z'), status: 'COMPLETED', accountName: 'Mohamed Alwarfalli', accountKey: '20100120361', ...over,
  });
  const debit = (over: Partial<LineFacts> = {}) => credit({ direction: 'DEBIT', amount: '1000', accountKey: '20100120361', counterpartyName: 'محمد الورفلي', ...over });

  it('net amount to the payout account confirms the payout', () => {
    const s = scoreWithdrawal(debit(), wd(), customer());
    expect(s.signals).toMatchObject({ amount: 'net amount', account: 'payout account' });
    expect(s.strong).toBe(true);
  });

  it('a payout to someone else’s name is flagged for AML but still matches the bank debit', () => {
    const s = scoreWithdrawal(debit({ counterpartyName: 'Salem Trading Co' }), wd({ accountName: 'Salem Trading Co' }), customer());
    expect(s.flags).toContain('THIRD_PARTY_PAYOUT');
    expect(s.strong).toBe(true);
  });

  it('a different account, or a payout the app still shows as pending, is not confirmed automatically', () => {
    expect(scoreWithdrawal(debit({ accountKey: '77700011122' }), wd(), customer()).flags).toContain('ACCOUNT_DIFFERS');
    const pending = scoreWithdrawal(debit(), wd({ status: 'PENDING' }), customer());
    expect(pending.flags).toContain('PAID_NOT_MARKED');
    expect(pending.strong).toBe(false);
  });
});
