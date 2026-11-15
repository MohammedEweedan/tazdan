/**
 * Bank statement matching against Postgres: a LyPay/OnePay/bank statement
 * imported, matched to deposit and withdrawal requests, accepted by staff.
 *
 *   - a reference + amount match credits the deposit exactly once, even when two staff accept at once
 *   - the paying account is remembered, so the next payment from it matches without a reference
 *   - re-importing a file is refused; an overlapping statement adds only its new lines
 *   - third-party money needs a written reason and opens an AML case
 *   - a large amount still goes through dual control from the one-click accept
 *   - unexplained money in can be assigned to a customer; a sanctions hit holds the line
 *   - a bank debit confirms a completed payout
 *   - answering a bank's request about a customer needs a second staff member's approval
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a disposable database.
 */
import { prisma } from '../utils/prisma';
import { generateReference } from '../utils/helpers';
import type { Permission } from '../services/platform/rbac';
import {
  acceptMatch, acceptStrongDeposits, assignLineToCustomer, exceptions, importStatement, matchLines,
} from '../services/bankStatements/statements.service';
import { createBankRequest, proposeDisclosure } from '../services/bankStatements/bankRequests.service';
import { decideApproval } from '../services/platform/approvals.service';

jest.mock('../services/exchange/fxRateProvider.service', () => ({
  ...jest.requireActual('../services/exchange/fxRateProvider.service'),
  // 1 LYD = 0.15 USD, so dual control (5,000 USD) starts at about 33,334 LYD.
  getRate: jest.fn(async () => ({ sellPrice: 0.15, buyPrice: 0.15, source: 'test', fetchedAt: new Date() })),
}));
jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `bsm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
const importIds: string[] = [];
const PERMS = new Set<Permission>(['deposits.confirm', 'withdrawals.approve', 'recon.read', 'recon.run', 'recon.resolve', 'compliance.case.manage', 'compliance.decide']);
const iban = () => `LY83002048${String(Math.floor(Math.random() * 1e15)).padStart(15, '0')}`;

async function user(first: string, last: string, admin = false) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: first, lastName: last, status: 'ACTIVE', role: admin ? 'ADMIN' : 'USER', staffRoles: admin ? ['SUPER_ADMIN'] : [],
      kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(0, 30),
    },
  });
}
const deposit = (userId: string, amount: string) => prisma.deposit.create({
  data: { userId, currency: 'LYD', amount, paymentMethod: 'BANK_TRANSFER', reference: generateReference('DEP'), status: 'WAITING_CONFIRMATION', createdAt: new Date(Date.now() - 60_000) },
});
const lyd = async (userId: string) => (await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'LYD' } } }))?.balance.toString() ?? '0';

/** Now, as a Tripoli wall-clock time the way statements write it. */
function now() {
  const d = new Date(Date.now() + 2 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
type Row = { amount: string; type?: string; name?: string; account?: string; ref: string; text?: string };
const csv = (rows: Row[]) => Buffer.from([
  'Date,Amount,Type,Sender Name,Account,Reference,Description',
  ...rows.map((r) => [now(), r.amount, r.type ?? 'Credit', r.name ?? '', r.account ?? '', `${marker}-${r.ref}`, r.text ?? ''].map((c) => `"${c}"`).join(',')),
].join('\n'));
async function load(rows: Row[], source: 'LYPAY' | 'ONEPAY' | 'BANK' = 'LYPAY') {
  const r = await importStatement({ source, content: csv(rows), fileName: 'statement.csv', actorId: null });
  importIds.push(r.importId);
  return r;
}
const lineByRef = (ref: string) => prisma.bankStatementLine.findFirstOrThrow({ where: { railRef: `${marker}-${ref}` }, include: { candidates: { orderBy: { score: 'desc' } } } });

describeDb('bank statement matching', () => {
  let staff: Awaited<ReturnType<typeof user>>;
  let staff2: Awaited<ReturnType<typeof user>>;
  let ali: Awaited<ReturnType<typeof user>>;
  let salem: Awaited<ReturnType<typeof user>>;
  let khaled: Awaited<ReturnType<typeof user>>;
  const aliAccount = iban();

  beforeAll(async () => {
    staff = await user('Staff', 'One', true);
    staff2 = await user('Staff', 'Two', true);
    ali = await user('Mohamed', 'Alwarfalli');
    salem = await user('Salem', 'Benomran');
    khaled = await user('Khaled', 'Zawi');
  });

  afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await prisma.bankStatementImport.deleteMany({ where: { id: { in: importIds } } }).catch(() => {});
    await prisma.bankPayerLink.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.bankInfoRequest.deleteMany({ where: { subjectUserId: { in: ids } } }).catch(() => {});
    await prisma.watchlistEntry.deleteMany({ where: { listName: marker } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('matches by reference, credits once under concurrent accepts, and remembers the paying account', async () => {
    const dep = await deposit(ali.id, '1500');
    const r = await load([{ amount: '1,500.000', name: 'محمد علي الورفلي', account: aliAccount, ref: 'L1', text: `تحويل ${dep.reference}` }]);
    expect(r).toMatchObject({ newLines: 1, duplicates: 0, suggested: 1, strong: 1 });

    const line = await lineByRef('L1');
    expect(line.status).toBe('SUGGESTED');
    expect(line.candidates[0]).toMatchObject({ targetId: dep.id, flags: [] });
    expect((line.candidates[0].signals as any).clearWinner).toBe(true);

    const attempts = await Promise.allSettled([
      acceptMatch({ lineId: line.id, candidateId: line.candidates[0].id, staffId: staff.id, permissions: PERMS }),
      acceptMatch({ lineId: line.id, candidateId: line.candidates[0].id, staffId: staff2.id, permissions: PERMS }),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(await lyd(ali.id)).toBe('1500');
    expect((await prisma.deposit.findUniqueOrThrow({ where: { id: dep.id } })).status).toBe('CONFIRMED');
    expect(await prisma.bankPayerLink.findFirst({ where: { userId: ali.id } })).toMatchObject({ accountKey: line.accountKey, source: 'CONFIRMED_MATCH' });

    // The next payment from the same account needs no reference.
    const next = await deposit(ali.id, '200');
    await load([{ amount: '200', name: 'MOHAMED ALWARFALLI', account: aliAccount, ref: 'L2', text: 'monthly top up' }]);
    const l2 = await lineByRef('L2');
    expect(l2.candidates[0]).toMatchObject({ targetId: next.id, flags: [] });
    expect((l2.candidates[0].signals as any)).toMatchObject({ account: 'confirmed', strong: true });
  });

  it('refuses a re-imported file and adds only the new lines of an overlapping statement', async () => {
    const rows: Row[] = [{ amount: '10', ref: 'D1', name: 'Nobody' }];
    await load(rows);
    await expect(importStatement({ source: 'LYPAY', content: csv(rows), actorId: null })).rejects.toMatchObject({ statusCode: 409 });
    const overlap = await load([...rows, { amount: '11', ref: 'D2', name: 'Nobody' }]);
    expect(overlap).toMatchObject({ lines: 2, newLines: 1, duplicates: 1 });
  });

  it('one-click accept credits strong matches but still sends large amounts to dual control', async () => {
    const small = await deposit(salem.id, '700');
    const large = await deposit(khaled.id, '40000');
    await load([
      { amount: '700', name: 'سالم بن عمران', ref: 'S1', text: small.reference },
      { amount: '40000', name: 'خالد الزوي', ref: 'S2', text: large.reference },
    ], 'ONEPAY');
    const r = await acceptStrongDeposits({ staffId: staff.id, permissions: PERMS });
    const s2 = await lineByRef('S2');
    expect(r.results.find((x) => x.lineId === s2.id)).toMatchObject({ ok: true, credited: false, pendingApproval: true });
    expect(await lyd(salem.id)).toBe('700');
    expect(await lyd(khaled.id)).toBe('0');
    expect(await prisma.approvalRequest.findFirst({ where: { type: 'DEPOSIT_CONFIRMATION', subjectId: large.id, status: 'PENDING' } })).not.toBeNull();
    expect(s2.status).toBe('MATCHED');
  });

  it('third-party money needs a reason and opens an AML case', async () => {
    const dep = await deposit(khaled.id, '300');
    // Khaled's reference, but paid from Ali's remembered account under Ali's name.
    await load([{ amount: '300', name: 'محمد الورفلي', account: aliAccount, ref: 'T1', text: dep.reference }]);
    const line = await lineByRef('T1');
    const cand = line.candidates.find((c) => c.targetId === dep.id)!;
    expect(cand.flags).toEqual(expect.arrayContaining(['ACCOUNT_OF_OTHER_CUSTOMER']));
    await expect(acceptMatch({ lineId: line.id, candidateId: cand.id, staffId: staff.id, permissions: PERMS })).rejects.toMatchObject({ statusCode: 400 });
    const ok: any = await acceptMatch({ lineId: line.id, candidateId: cand.id, reason: 'Khaled confirmed his cousin paid on his behalf', staffId: staff.id, permissions: PERMS });
    expect(ok.caseId).toBeTruthy();
    expect(await prisma.complianceCase.findUnique({ where: { id: ok.caseId } })).toMatchObject({ type: 'AML', subjectUserId: khaled.id });
  });

  it('unexplained money in can be assigned to a customer; a sanctions hit holds the line', async () => {
    await prisma.watchlistEntry.create({ data: { listName: marker, entityType: 'PERSON', name: 'Qarqoum Zubairovich Testlisted', normalizedName: 'qarqoum zubairovich testlisted', source: 'test' } });
    const r = await load([
      { amount: '55', name: 'Unknown Sender', ref: 'U1' },
      { amount: '90', name: 'Qarqoum Zubairovich Testlisted', ref: 'U2' },
    ]);
    expect(r.sanctionsHits).toBe(1);
    const held = await lineByRef('U2');
    expect(held).toMatchObject({ status: 'HELD', flags: ['SANCTIONS_HIT'] });

    const before = await lyd(salem.id);
    const u1 = await lineByRef('U1');
    await expect(assignLineToCustomer({ lineId: u1.id, userId: salem.id, reason: 'short', staffId: staff.id, permissions: PERMS })).rejects.toMatchObject({ statusCode: 400 });
    await assignLineToCustomer({ lineId: u1.id, userId: salem.id, reason: 'Customer sent the receipt by support chat', staffId: staff.id, permissions: PERMS });
    expect(Number(await lyd(salem.id)) - Number(before)).toBe(55);
  });

  it('a bank debit confirms a completed payout and flags payouts to someone else', async () => {
    const own = await prisma.withdrawal.create({ data: { userId: ali.id, currency: 'LYD', amount: '1010', fee: '10', netAmount: '1000', paymentMethod: 'BANK_TRANSFER', bankName: 'Jumhouria', accountNumber: aliAccount, accountName: 'Mohamed Alwarfalli', reference: generateReference('WDR'), status: 'COMPLETED', processedAt: new Date() } });
    const other = await prisma.withdrawal.create({ data: { userId: salem.id, currency: 'LYD', amount: '420', fee: '0', netAmount: '420', paymentMethod: 'BANK_TRANSFER', bankName: 'Wahda', accountNumber: iban(), accountName: 'Tripoli Trading Co', reference: generateReference('WDR'), status: 'COMPLETED', processedAt: new Date() } });
    await load([
      { amount: '1000', type: 'Debit', name: 'محمد الورفلي', account: aliAccount, ref: 'W1' },
      { amount: '420', type: 'Debit', name: 'Tripoli Trading Co', account: other.accountNumber!, ref: 'W2' },
    ], 'BANK');
    const w1 = await lineByRef('W1');
    expect(w1.candidates[0]).toMatchObject({ targetType: 'WITHDRAWAL', targetId: own.id, flags: [] });
    await acceptMatch({ lineId: w1.id, candidateId: w1.candidates[0].id, staffId: staff.id, permissions: PERMS });
    expect(await prisma.bankStatementLine.findUniqueOrThrow({ where: { id: w1.id } })).toMatchObject({ status: 'MATCHED', matchedType: 'WITHDRAWAL', matchedId: own.id });

    const w2 = await lineByRef('W2');
    expect(w2.candidates[0]).toMatchObject({ targetId: other.id });
    expect(w2.candidates[0].flags).toContain('THIRD_PARTY_PAYOUT');
    // Unmatched payouts and money in show up as exceptions until someone deals with them.
    expect((await exceptions()).unexplainedOut.map((l) => l.id)).toContain(w2.id);
    expect((await matchLines([w2.id])).checked).toBe(1);
  });

  it('answering a bank’s request about a customer needs a second staff member', async () => {
    const req = await createBankRequest({ direction: 'INBOUND', bankName: 'Jumhouria Bank', type: 'KYC_INFORMATION', legalBasis: 'AML_LAW', question: 'Please confirm the customer holding account ending 0361 and their occupation.', subjectUserId: ali.id, staffId: staff.id });
    const proposed = await proposeDisclosure({ id: req.id, answer: 'Mohamed Alwarfalli, verified customer since 2026, engineer.', staffId: staff.id, permissions: PERMS });
    expect((await prisma.bankInfoRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('PENDING_APPROVAL');
    await expect(decideApproval({ id: proposed.approvalId, approve: true, deciderId: staff.id, permissions: PERMS })).rejects.toMatchObject({ statusCode: 403 });
    await decideApproval({ id: proposed.approvalId, approve: true, deciderId: staff2.id, permissions: PERMS });
    expect(await prisma.bankInfoRequest.findUniqueOrThrow({ where: { id: req.id } })).toMatchObject({ status: 'SENT', approvedById: staff2.id });
  });
});
