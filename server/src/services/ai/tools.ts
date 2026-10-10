/**
 * Read-only data tools for the operations assistant.
 *
 * Each tool names the staff permission it needs; a tool the operator cannot
 * use is not offered to the model at all, so the assistant can never show a
 * staff member data their role does not already allow. Results are trimmed
 * and masked before they leave the platform (emails, phones and account
 * numbers are partially hidden; secrets, hashes and keys are never read).
 * No tool writes anything.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../utils/prisma';
import { poolPositions, treasuryAlerts } from '../treasury/pools.service';
import { listControls } from '../platform/controls.service';
import { getRate } from '../exchange/fxRateProvider.service';
import { circuitOpen } from '../providers/registry';

const MAX_RESULT_CHARS = 12_000;

export function maskEmail(e?: string | null) {
  if (!e) return null;
  const [u, d] = e.split('@');
  return d ? `${u.slice(0, 1)}***@${d}` : '***';
}
const maskTail = (v?: string | null, keep = 4) => (v ? `…${v.slice(-keep)}` : null);
const iso = (d?: Date | null) => (d ? d.toISOString() : null);

export interface AiTool {
  definition: Anthropic.Beta.BetaTool;
  permission: string;
  run: (input: Record<string, any>) => Promise<unknown>;
  /** Entity references this call touched (for the audit record). */
  refs?: (input: Record<string, any>, result: any) => string[];
}

type Controls = Awaited<ReturnType<typeof listControls>> | null;
function activeSwitches(c: Controls) {
  if (!c) return [];
  const now = Date.now();
  return [
    ...c.features.filter((f) => f.blocked).map((f) => ({ key: f.feature, reason: f.reason })),
    ...c.switches.filter((s) => s.scope !== 'FEATURE' && s.blocked && (!s.expiresAt || s.expiresAt.getTime() > now)).map((s) => ({ key: `${s.scope}:${s.key}`, reason: s.reason })),
  ];
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object' as const, properties, required, additionalProperties: false });

export const AI_TOOLS: AiTool[] = [
  {
    permission: 'cockpit.view',
    definition: {
      name: 'platform_overview', strict: true,
      description: 'Current operating picture: customer counts, 24h money movement, queue sizes (deposits, withdrawals, KYC, compliance, remittance review), open reconciliation exceptions, kill switches that are on, and treasury alert counts. Call this first for any "how are we doing" or status question.',
      input_schema: obj({}),
    },
    run: async () => {
      const since = new Date(Date.now() - 86400_000);
      const [customers, newCustomers, deposits24, withdrawals24, pendingDeposits, pendingWithdrawals, kyc, cases, review, recon, controls, alerts] = await Promise.all([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: since } } }),
        prisma.deposit.groupBy({ by: ['currency'], where: { status: 'CONFIRMED', confirmedAt: { gte: since } }, _sum: { amount: true }, _count: true }),
        prisma.withdrawal.groupBy({ by: ['currency'], where: { status: 'COMPLETED', processedAt: { gte: since } }, _sum: { amount: true }, _count: true }),
        prisma.deposit.count({ where: { status: { in: ['PENDING', 'WAITING_CONFIRMATION'] as any } } }).catch(() => null),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { kycStatus: 'PENDING' } }),
        prisma.complianceCase.count({ where: { status: { not: 'CLOSED' } } }),
        prisma.remittanceTransfer.count({ where: { state: 'MANUAL_REVIEW' } }),
        prisma.reconciliationItem.count({ where: { resolution: 'OPEN', status: { not: 'MATCHED' } } }),
        listControls().catch(() => null),
        treasuryAlerts().catch(() => []),
      ]);
      return {
        asOf: new Date().toISOString(), customers, newCustomers24h: newCustomers,
        deposits24h: deposits24.map((d) => ({ currency: d.currency, count: d._count, amount: d._sum.amount?.toString() ?? '0' })),
        withdrawals24h: withdrawals24.map((d) => ({ currency: d.currency, count: d._count, amount: d._sum.amount?.toString() ?? '0' })),
        queues: { pendingDeposits, pendingWithdrawals, kycPending: kyc, openComplianceCases: cases, remittancesInReview: review, openReconExceptions: recon },
        killSwitchesOn: activeSwitches(controls),
        treasuryAlerts: { total: alerts.length, critical: alerts.filter((a) => a.severity === 'CRITICAL').length, high: alerts.filter((a) => a.severity === 'HIGH').length },
      };
    },
  },
  {
    permission: 'customers.read',
    definition: {
      name: 'search_records', strict: true,
      description: 'Find customers, remittances, deposits, withdrawals and compliance cases by name, username, email, ID or reference (e.g. "RMT-261006-…", "CASE-…", a deposit or withdrawal reference). Returns up to 5 matches of each kind with their IDs for follow-up calls.',
      input_schema: obj({ query: { type: 'string', description: 'Text to search for (at least 3 characters).' } }, ['query']),
    },
    run: async ({ query }) => {
      const q = String(query).trim();
      if (q.length < 3) return { error: 'Query must be at least 3 characters' };
      const [users, remittances, deposits, withdrawals, cases] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'USER', OR: [{ id: q }, { email: { contains: q, mode: 'insensitive' } }, { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] },
          take: 5, select: { id: true, firstName: true, lastName: true, username: true, email: true, status: true, kycStatus: true, country: true },
        }),
        prisma.remittanceTransfer.findMany({ where: { OR: [{ id: q }, { reference: { contains: q, mode: 'insensitive' } }, { providerRef: q }] }, take: 5, select: { id: true, reference: true, state: true, sendAmount: true, sourceCurrency: true, createdAt: true } }),
        prisma.deposit.findMany({ where: { OR: [{ id: q }, { reference: { contains: q, mode: 'insensitive' } }] }, take: 5, select: { id: true, reference: true, status: true, amount: true, currency: true, userId: true } }),
        prisma.withdrawal.findMany({ where: { OR: [{ id: q }, { reference: { contains: q, mode: 'insensitive' } }] }, take: 5, select: { id: true, reference: true, status: true, amount: true, currency: true, userId: true } }),
        prisma.complianceCase.findMany({ where: { OR: [{ id: q }, { reference: { contains: q, mode: 'insensitive' } }] }, take: 5, select: { id: true, reference: true, status: true, type: true, title: true } }),
      ]);
      return { customers: users.map((u) => ({ ...u, email: maskEmail(u.email) })), remittances, deposits, withdrawals, cases };
    },
    refs: (_i, r) => [...(r.customers ?? []).map((u: any) => `user:${u.id}`), ...(r.remittances ?? []).map((t: any) => `remittance:${t.id}`)],
  },
  {
    permission: 'customers.read',
    definition: {
      name: 'customer_profile', strict: true,
      description: 'One customer: account status, KYC, wallet balances, recent transactions, recent risk decisions, open compliance cases and security events. Use the customer ID from search_records.',
      input_schema: obj({ user_id: { type: 'string', description: 'Customer ID.' } }, ['user_id']),
    },
    run: async ({ user_id }) => {
      const u = await prisma.user.findUnique({
        where: { id: String(user_id) },
        select: { id: true, firstName: true, lastName: true, username: true, email: true, phone: true, status: true, kycStatus: true, kycTier: true, country: true, accountType: true, createdAt: true, twoFactorEnabled: true },
      });
      if (!u) return { error: 'Customer not found' };
      const [wallets, txs, risk, cases, security] = await Promise.all([
        prisma.wallet.findMany({ where: { userId: u.id }, select: { currency: true, balance: true, frozen: true } }),
        prisma.transaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 15, select: { type: true, currency: true, amount: true, reference: true, description: true, createdAt: true } }),
        prisma.riskDecision.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { subjectType: true, outcome: true, score: true, triggeredRules: true, explanation: true, createdAt: true } }),
        prisma.complianceCase.findMany({ where: { subjectUserId: u.id, status: { not: 'CLOSED' } }, select: { reference: true, type: true, status: true, title: true } }),
        prisma.securityEvent.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { type: true, createdAt: true } }),
      ]);
      return {
        customer: { ...u, email: maskEmail(u.email), phone: maskTail(u.phone), createdAt: iso(u.createdAt) },
        wallets: wallets.filter((w) => Number(w.balance) !== 0 || Number(w.frozen) !== 0).map((w) => ({ currency: w.currency, balance: w.balance.toString(), held: w.frozen.toString() })),
        recentTransactions: txs, recentRiskDecisions: risk, openCases: cases, recentSecurityEvents: security,
      };
    },
    refs: (i) => [`user:${i.user_id}`],
  },
  {
    permission: 'remittance.read',
    definition: {
      name: 'remittance_transfer', strict: true,
      description: 'One cross-border transfer by ID or reference: amounts, rates and fees, beneficiary (account masked), every lifecycle state change with reasons, route decision, payout attempts, risk decision and provider calls.',
      input_schema: obj({ id_or_reference: { type: 'string' } }, ['id_or_reference']),
    },
    run: async ({ id_or_reference }) => {
      const k = String(id_or_reference);
      const t = await prisma.remittanceTransfer.findFirst({
        where: { OR: [{ id: k }, { reference: k }] },
        include: { corridor: { select: { code: true, status: true } }, beneficiary: true, routes: true, payouts: true },
      });
      if (!t) return { error: 'Transfer not found' };
      const [transitions, risk, calls] = await Promise.all([
        prisma.stateTransition.findMany({ where: { entityType: 'REMITTANCE', entityId: t.id }, orderBy: { createdAt: 'asc' }, select: { fromState: true, toState: true, actorType: true, reason: true, createdAt: true } }),
        prisma.riskDecision.findFirst({ where: { subjectType: 'REMITTANCE', subjectId: t.id }, select: { outcome: true, score: true, triggeredRules: true, explanation: true } }),
        prisma.providerCall.findMany({ where: { entityId: t.id }, orderBy: { createdAt: 'asc' }, select: { providerCode: true, operation: true, success: true, errorCode: true, latencyMs: true, createdAt: true } }),
      ]);
      const b = t.beneficiary;
      return {
        transfer: {
          id: t.id, reference: t.reference, state: t.state, corridor: t.corridor.code, corridorStatus: t.corridor.status,
          sendAmount: t.sendAmount.toString(), feeAmount: t.feeAmount.toString(), totalDebit: t.totalDebit.toString(), sourceCurrency: t.sourceCurrency,
          receiveAmount: t.receiveAmount.toString(), destCurrency: t.destCurrency, baseRate: t.baseRate.toString(), customerRate: t.customerRate.toString(),
          purpose: t.purpose, providerCode: t.providerCode, failureReason: (t as any).failureReason ?? null, createdAt: iso(t.createdAt), userId: t.userId,
        },
        beneficiary: { name: b.fullName, country: b.country, method: b.payoutMethod, account: maskTail(b.iban ?? b.accountNumber ?? b.mobileWallet), screening: b.screeningStatus },
        routes: t.routes.map((r) => ({ provider: r.providerCode, eligible: r.eligible, selected: r.selected, score: r.score?.toString() ?? null, reason: r.reason })),
        payouts: t.payouts.map((p) => ({ attempt: p.attempt, provider: p.providerCode, status: p.status, failureReason: p.failureReason, submittedAt: iso(p.submittedAt), paidAt: iso(p.paidAt) })),
        transitions, risk, providerCalls: calls,
      };
    },
    refs: (_i, r) => (r.transfer ? [`remittance:${r.transfer.id}`] : []),
  },
  {
    permission: 'compliance.read',
    definition: {
      name: 'compliance_case', strict: true,
      description: 'One compliance case by ID or reference with its full case file (notes, status changes), the risk decision that opened it and the subject.',
      input_schema: obj({ id_or_reference: { type: 'string' } }, ['id_or_reference']),
    },
    run: async ({ id_or_reference }) => {
      const k = String(id_or_reference);
      const c = await prisma.complianceCase.findFirst({ where: { OR: [{ id: k }, { reference: k }] }, include: { notes: { orderBy: { createdAt: 'asc' }, select: { kind: true, authorType: true, body: true, createdAt: true } } } });
      if (!c) return { error: 'Case not found' };
      const decision = c.riskDecisionId ? await prisma.riskDecision.findUnique({ where: { id: c.riskDecisionId }, select: { outcome: true, score: true, triggeredRules: true, explanation: true, signals: true } }) : null;
      return { case: { ...c, notes: undefined, createdAt: iso(c.createdAt), slaDueAt: iso(c.slaDueAt) }, notes: c.notes, riskDecision: decision };
    },
    refs: (_i, r) => (r.case ? [`case:${r.case.id}`] : []),
  },
  {
    permission: 'compliance.read',
    definition: {
      name: 'compliance_queue', strict: true,
      description: 'Open compliance cases (oldest SLA first), unreviewed screening hits, KYC/KYB queue sizes and cases past their SLA.',
      input_schema: obj({}),
    },
    run: async () => {
      const [cases, hits, overdue, kyc, kyb] = await Promise.all([
        prisma.complianceCase.findMany({ where: { status: { not: 'CLOSED' } }, orderBy: [{ slaDueAt: { sort: 'asc', nulls: 'last' } }], take: 25, select: { reference: true, type: true, priority: true, status: true, title: true, slaDueAt: true, assignedToId: true } }),
        prisma.screeningResult.count({ where: { status: 'POTENTIAL_MATCH', reviewedAt: null } }),
        prisma.complianceCase.count({ where: { status: { not: 'CLOSED' }, slaDueAt: { lt: new Date() } } }),
        prisma.user.count({ where: { kycStatus: 'PENDING' } }),
        prisma.businessProfile.count({ where: { kybStatus: 'PENDING' } }),
      ]);
      return { openCases: cases, unreviewedScreeningHits: hits, casesPastSla: overdue, kycPending: kyc, kybPending: kyb };
    },
  },
  {
    permission: 'treasury.read',
    definition: {
      name: 'treasury_positions', strict: true,
      description: 'Liquidity per treasury pool (balance, reserved, available, minimum/target), treasury alerts and open settlement obligations.',
      input_schema: obj({}),
    },
    run: async () => {
      const [positions, alerts, settlements] = await Promise.all([
        poolPositions(), treasuryAlerts(),
        prisma.remittanceSettlement.findMany({ where: { status: { in: ['OPEN', 'INSTRUCTED'] } }, select: { reference: true, providerCode: true, amount: true, currency: true, dueAt: true, status: true } }),
      ]);
      return { pools: positions.map((p) => ({ code: p.code, currency: p.currency, balance: p.balance, reserved: p.reserved, available: p.available, minimum: p.minimum, target: p.target, consumed24h: p.consumed24h })), alerts, settlements };
    },
  },
  {
    permission: 'recon.read',
    definition: {
      name: 'reconciliation_exceptions', strict: true,
      description: 'Open reconciliation exceptions (breaks between provider statements, the ledger, wallets and treasury) and the latest runs.',
      input_schema: obj({}),
    },
    run: async () => {
      const [items, runs] = await Promise.all([
        prisma.reconciliationItem.findMany({ where: { resolution: { in: ['OPEN', 'ESCALATED'] }, status: { not: 'MATCHED' } }, orderBy: { createdAt: 'desc' }, take: 30, select: { status: true, internalType: true, internalId: true, externalRef: true, internalAmount: true, externalAmount: true, currency: true, resolution: true, details: true, createdAt: true } }),
        prisma.reconciliationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { source: true, providerCode: true, status: true, totals: true, createdAt: true } }),
      ]);
      return { exceptions: items, latestRuns: runs };
    },
  },
  {
    permission: 'providers.read',
    definition: {
      name: 'provider_status', strict: true,
      description: 'Every external provider (payout rails, KYC, screening, card issuer, blockchain, notifications): mode (PRODUCTION/SANDBOX/MOCK), status, last health check, circuit breaker and 24h call errors.',
      input_schema: obj({}),
    },
    run: async () => {
      const since = new Date(Date.now() - 86400_000);
      const [rows, calls] = await Promise.all([
        prisma.provider.findMany({ select: { code: true, name: true, category: true, mode: true, status: true, lastHealthAt: true, lastHealthOk: true } }),
        prisma.providerCall.groupBy({ by: ['providerCode', 'success'], where: { createdAt: { gte: since } }, _count: true }),
      ]);
      return rows.map((p) => ({ ...p, circuitOpen: circuitOpen(p.code), calls24h: calls.filter((c) => c.providerCode === p.code).reduce((n, c) => n + c._count, 0), failures24h: calls.find((c) => c.providerCode === p.code && !c.success)?._count ?? 0 }));
    },
  },
  {
    permission: 'fx.read',
    definition: {
      name: 'fx_rates', strict: true,
      description: 'Current effective customer rates (buy/sell and source) for the main LYD pairs and USDT/USD.',
      input_schema: obj({}),
    },
    run: async () => {
      const pairs = [['USD', 'LYD'], ['EUR', 'LYD'], ['GBP', 'LYD'], ['EGP', 'LYD'], ['TRY', 'LYD'], ['AED', 'LYD'], ['TND', 'LYD'], ['USDT', 'USD']];
      return Promise.all(pairs.map(async ([b, q]) => ({ pair: `${b}/${q}`, ...(await getRate(b, q).then((r) => ({ buy: r.buyPrice, sell: r.sellPrice, source: r.source })).catch(() => ({ error: 'unavailable' }))) })));
    },
  },
  {
    permission: 'compliance.read',
    definition: {
      name: 'risk_rules', strict: true,
      description: 'The risk engine rules: what each checks, its action (REVIEW, REJECT, CHALLENGE…), score, parameters, whether enabled, and how often it fired in 30 days.',
      input_schema: obj({}),
    },
    run: async () => {
      const [rules, fired] = await Promise.all([
        prisma.riskRule.findMany({ select: { code: true, name: true, category: true, description: true, enabled: true, action: true, score: true, params: true, version: true } }),
        prisma.riskEvent.groupBy({ by: ['type'], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true }),
      ]);
      return rules.map((r) => ({ ...r, fired30d: fired.find((f) => f.type === r.code)?._count ?? 0 }));
    },
  },
  {
    permission: 'support.read',
    definition: {
      name: 'support_context', strict: true,
      description: 'Everything support needs about one customer: open escalations, recent messages with support, failed or held remittances, refunds, KYC document status, recent deposits and withdrawals.',
      input_schema: obj({ user_id: { type: 'string' } }, ['user_id']),
    },
    run: async ({ user_id }) => {
      const id = String(user_id);
      const support = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
      const [tickets, messages, held, kyc, deposits, withdrawals] = await Promise.all([
        prisma.supportEscalation.findMany({ where: { raisedById: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { reason: true, details: true, status: true, createdAt: true, resolutionNote: true } }),
        support ? prisma.message.findMany({ where: { OR: [{ senderId: id, receiverId: support.id }, { senderId: support.id, receiverId: id }] }, orderBy: { createdAt: 'desc' }, take: 20, select: { senderId: true, content: true, type: true, createdAt: true } }) : [],
        prisma.remittanceTransfer.findMany({ where: { userId: id, state: { in: ['FAILED', 'REFUND_PENDING', 'REJECTED', 'DISPUTED', 'MANUAL_REVIEW', 'REFUNDED'] } }, take: 10, select: { reference: true, state: true, totalDebit: true, sourceCurrency: true, createdAt: true } }),
        prisma.kYCDocument.findMany({ where: { userId: id }, select: { documentType: true, status: true, rejectionReason: true } }),
        prisma.deposit.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 5, select: { reference: true, status: true, amount: true, currency: true, createdAt: true } }),
        prisma.withdrawal.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 5, select: { reference: true, status: true, amount: true, currency: true, createdAt: true } }),
      ]);
      return {
        escalations: tickets,
        messages: [...messages].reverse().map((m) => ({ from: m.senderId === id ? 'customer' : 'support', type: m.type, content: m.content.slice(0, 600), at: iso(m.createdAt) })),
        // Held remittances are listed for the agent's awareness only — see the tipping-off rule.
        heldOrFailedRemittances: held, kycDocuments: kyc, recentDeposits: deposits, recentWithdrawals: withdrawals,
      };
    },
    refs: (i) => [`user:${i.user_id}`],
  },
  {
    permission: 'controls.read',
    definition: {
      name: 'control_switches', strict: true,
      description: 'Emergency kill switches and feature controls: which are on, scope, who set them and why.',
      input_schema: obj({}),
    },
    run: async () => {
      const c = await listControls();
      return { features: c.features, otherActiveSwitches: activeSwitches(c).filter((x) => x.key.includes(':')), recentChanges: c.events.slice(0, 20) };
    },
  },
];

export function toolsFor(permissions: string[]): AiTool[] {
  return AI_TOOLS.filter((t) => permissions.includes(t.permission));
}

export async function runTool(tool: AiTool, input: Record<string, any>): Promise<{ text: string; refs: string[]; isError: boolean }> {
  try {
    const result = await tool.run(input ?? {});
    let text = JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [truncated — ask a narrower question]`;
    return { text, refs: tool.refs?.(input, result) ?? [], isError: Boolean((result as any)?.error) };
  } catch (err) {
    return { text: JSON.stringify({ error: `Tool failed: ${(err as Error).message.slice(0, 200)}` }), refs: [], isError: true };
  }
}
