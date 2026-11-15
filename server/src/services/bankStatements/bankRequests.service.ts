/**
 * AML/KYC requests exchanged with banks.
 *
 * OUTBOUND — Tazdan asks a bank: who holds an account that paid us, the
 * source of funds, a return of funds, a freeze. A bank's answer confirming
 * the holder of an account is remembered for the customer, so that account's
 * payments match from then on.
 * INBOUND — a bank asks Tazdan about one of our customers or a payment.
 *
 * Every request records its legal basis (the CBL regulation allows sharing
 * customer data only with consent, under a legal duty, a court order or the
 * CBL's instruction). Sending customer data to a bank — answering an inbound
 * request — needs a second staff member's approval (BANK_DISCLOSURE), and
 * neither may be the customer concerned. Letters are generated in Arabic and
 * English for the bank's compliance department.
 *
 * Suspicious transaction reports go to the Financial Information Unit, not to
 * banks: never mention a report in a letter (tipping off).
 */
import { randomBytes } from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { registerApprovalHandler, requestApproval } from '../platform/approvals.service';
import type { Permission } from '../platform/rbac';

export const REQUEST_TYPES = ['ACCOUNT_HOLDER', 'KYC_INFORMATION', 'TRANSACTION_DETAILS', 'SOURCE_OF_FUNDS', 'RETURN_OF_FUNDS', 'FREEZE', 'OTHER'] as const;
export const LEGAL_BASES = ['CUSTOMER_CONSENT', 'AML_LAW', 'COURT_ORDER', 'CBL_INSTRUCTION', 'SERVICE_CONTRACT'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export type LegalBasis = (typeof LEGAL_BASES)[number];
type Req = { ip?: string; headers?: Record<string, any> };

const complianceEmail = () => process.env.COMPLIANCE_EMAIL ?? 'compliance@tazdan.com';
const reference = () => `BIR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

export async function createBankRequest(input: {
  direction: 'OUTBOUND' | 'INBOUND';
  bankName: string;
  bankContact?: string | null;
  type: RequestType;
  legalBasis: LegalBasis;
  question: string;
  subjectUserId?: string | null;
  statementLineId?: string | null;
  caseId?: string | null;
  dueAt?: Date | null;
  staffId: string;
  req?: Req;
}) {
  if (input.question.trim().length < 10) throw new AppError('Describe the request in at least 10 characters', 400);
  if (input.subjectUserId && !(await prisma.user.findUnique({ where: { id: input.subjectUserId }, select: { id: true } }))) throw new AppError('Customer not found', 404);
  if (input.statementLineId && !(await prisma.bankStatementLine.findUnique({ where: { id: input.statementLineId }, select: { id: true } }))) throw new AppError('Statement line not found', 404);
  const row = await prisma.bankInfoRequest.create({
    data: {
      reference: reference(), direction: input.direction, bankName: input.bankName.trim().slice(0, 120), bankContact: input.bankContact?.trim().slice(0, 200) || null,
      type: input.type, legalBasis: input.legalBasis, question: input.question.trim().slice(0, 4000),
      subjectUserId: input.subjectUserId ?? null, statementLineId: input.statementLineId ?? null, caseId: input.caseId ?? null,
      dueAt: input.dueAt ?? (input.direction === 'INBOUND' ? new Date(Date.now() + 5 * 86_400_000) : null), createdById: input.staffId,
    },
  });
  await writeAudit(prisma, { actorId: input.staffId, action: 'BANK_REQUEST_CREATE', entity: 'BankInfoRequest', entityId: row.id, after: { direction: row.direction, bank: row.bankName, type: row.type, legalBasis: row.legalBasis, subjectUserId: row.subjectUserId }, req: input.req });
  return row;
}

async function load(id: string) {
  const r = await prisma.bankInfoRequest.findUnique({ where: { id } });
  if (!r) throw new AppError('Request not found', 404);
  return r;
}

/** Outbound: the letter has gone to the bank. */
export async function markSent(input: { id: string; staffId: string; req?: Req }) {
  const r = await load(input.id);
  if (r.direction !== 'OUTBOUND') throw new AppError('Inbound answers are sent through approval', 400);
  if (r.status !== 'OPEN') throw new AppError(`The request is ${r.status.toLowerCase().replace('_', ' ')}`, 409);
  await prisma.bankInfoRequest.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: new Date() } });
  await writeAudit(prisma, { actorId: input.staffId, action: 'BANK_REQUEST_SENT', entity: 'BankInfoRequest', entityId: r.id, req: input.req });
  return { ok: true };
}

/**
 * Outbound: record the bank's reply. When the bank confirms our customer
 * holds the account on the linked statement line, that account is
 * remembered for the customer.
 */
export async function recordBankAnswer(input: { id: string; answer: string; holderConfirmed?: boolean; staffId: string; req?: Req }) {
  const r = await load(input.id);
  if (r.direction !== 'OUTBOUND') throw new AppError('Use “propose answer” for a bank’s request to us', 400);
  if (!['OPEN', 'SENT'].includes(r.status)) throw new AppError(`The request is ${r.status.toLowerCase()}`, 409);
  if (input.answer.trim().length < 3) throw new AppError('Enter the bank’s answer', 400);
  let remembered = false;
  if (input.holderConfirmed) {
    if (r.type !== 'ACCOUNT_HOLDER' || !r.subjectUserId || !r.statementLineId) throw new AppError('Only an account-holder request about a customer and a statement line can confirm an account', 400);
    const line = await prisma.bankStatementLine.findUnique({ where: { id: r.statementLineId } });
    if (!line?.accountKey) throw new AppError('The statement line has no account number', 400);
    await prisma.bankPayerLink.upsert({
      where: { userId_accountKey: { userId: r.subjectUserId, accountKey: line.accountKey } },
      update: { source: 'BANK_CONFIRMED', confirmedById: input.staffId, lastSeenAt: new Date(), name: line.counterpartyName ?? undefined },
      create: { userId: r.subjectUserId, accountKey: line.accountKey, name: line.counterpartyName, source: 'BANK_CONFIRMED', confirmedById: input.staffId },
    });
    remembered = true;
  }
  await prisma.bankInfoRequest.update({ where: { id: r.id }, data: { status: 'ANSWERED', answer: input.answer.trim().slice(0, 4000), answeredAt: new Date() } });
  await writeAudit(prisma, { actorId: input.staffId, action: 'BANK_REQUEST_ANSWERED', entity: 'BankInfoRequest', entityId: r.id, after: { holderConfirmed: Boolean(input.holderConfirmed), accountRemembered: remembered }, req: input.req });
  return { ok: true, accountRemembered: remembered };
}

registerApprovalHandler('BANK_DISCLOSURE', {
  requestPermission: 'compliance.case.manage',
  approvePermission: 'compliance.decide',
  validate: (payload: any) => {
    if (!payload || typeof payload.requestId !== 'string' || typeof payload.answer !== 'string' || payload.answer.trim().length < 3) throw new AppError('Invalid disclosure', 400);
  },
  execute: async (payload: any, ctx) => {
    const moved = await prisma.bankInfoRequest.updateMany({
      where: { id: payload.requestId, status: 'PENDING_APPROVAL' },
      data: { status: 'SENT', answer: String(payload.answer).slice(0, 4000), approvedById: ctx.approvedById, sentAt: new Date() },
    });
    if (moved.count !== 1) throw new AppError('The request changed after the disclosure was proposed', 409);
    return { requestId: payload.requestId, sent: true };
  },
});

/** A disclosure still waiting for its second approver (rejected or expired ones don't count). */
async function waitingApproval(requestId: string) {
  return prisma.approvalRequest.findFirst({
    where: { type: 'BANK_DISCLOSURE', subjectType: 'BANK_INFO_REQUEST', subjectId: requestId, status: 'PENDING', expiresAt: { gt: new Date() } },
  });
}

/** Inbound: propose the reply. It is released to the bank only after a second staff member approves. */
export async function proposeDisclosure(input: { id: string; answer: string; staffId: string; permissions: Set<Permission>; req?: Req }) {
  const r = await load(input.id);
  if (r.direction !== 'INBOUND') throw new AppError('Only a bank’s request to us is answered through approval', 400);
  const reopen = r.status === 'PENDING_APPROVAL' && !(await waitingApproval(r.id));
  if (r.status !== 'OPEN' && !reopen) throw new AppError(`The request is ${r.status.toLowerCase().replace('_', ' ')}`, 409);
  if (input.answer.trim().length < 3) throw new AppError('Write the answer', 400);
  const approval = await requestApproval({
    type: 'BANK_DISCLOSURE',
    payload: { requestId: r.id, answer: input.answer.trim(), userId: r.subjectUserId ?? undefined, bank: r.bankName, legalBasis: r.legalBasis },
    reason: `Disclose to ${r.bankName} under ${r.legalBasis.toLowerCase().replace(/_/g, ' ')} (${r.reference})`,
    requestedById: input.staffId,
    subjectType: 'BANK_INFO_REQUEST',
    subjectId: r.id,
    permissions: input.permissions,
    req: input.req,
  });
  await prisma.bankInfoRequest.update({ where: { id: r.id }, data: { status: 'PENDING_APPROVAL', answer: input.answer.trim().slice(0, 4000) } });
  return { pendingApproval: true, approvalId: approval.id };
}

export async function closeBankRequest(input: { id: string; note: string; staffId: string; req?: Req }) {
  const r = await load(input.id);
  if (r.status === 'CLOSED') return { ok: true };
  if (r.status === 'PENDING_APPROVAL' && (await waitingApproval(r.id))) throw new AppError('A disclosure is waiting for approval; reject it in Approvals first', 409);
  await prisma.bankInfoRequest.update({ where: { id: r.id }, data: { status: 'CLOSED', closedAt: new Date() } });
  await writeAudit(prisma, { actorId: input.staffId, action: 'BANK_REQUEST_CLOSE', entity: 'BankInfoRequest', entityId: r.id, before: { status: r.status }, reason: input.note, req: input.req });
  return { ok: true };
}

export async function listBankRequests(filter: { status?: string; direction?: string; page?: number; limit?: number }) {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where = { ...(filter.status ? { status: filter.status } : {}), ...(filter.direction ? { direction: filter.direction } : {}) };
  const [requests, total, overdue] = await Promise.all([
    prisma.bankInfoRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.bankInfoRequest.count({ where }),
    prisma.bankInfoRequest.count({ where: { status: { in: ['OPEN', 'SENT', 'PENDING_APPROVAL'] }, dueAt: { lt: new Date() } } }),
  ]);
  return { page, limit, total, overdue, requests };
}

// ── Letters ──────────────────────────────────────────────────────────

const TYPE_TEXT: Record<RequestType, { en: string; ar: string }> = {
  ACCOUNT_HOLDER: { en: 'confirmation of the holder of an account', ar: 'تأكيد اسم صاحب الحساب' },
  KYC_INFORMATION: { en: 'customer due diligence information', ar: 'معلومات العناية الواجبة تجاه العميل' },
  TRANSACTION_DETAILS: { en: 'details of a transaction', ar: 'تفاصيل عملية' },
  SOURCE_OF_FUNDS: { en: 'the source of funds of a transfer', ar: 'مصدر أموال تحويل' },
  RETURN_OF_FUNDS: { en: 'the return of funds received in error', ar: 'إعادة أموال مستلمة عن طريق الخطأ' },
  FREEZE: { en: 'a temporary hold on funds', ar: 'تجميد مؤقت للأموال' },
  OTHER: { en: 'information', ar: 'معلومات' },
};
const BASIS_TEXT: Record<LegalBasis, { en: string; ar: string }> = {
  CUSTOMER_CONSENT: { en: 'the customer’s written consent', ar: 'موافقة العميل الكتابية' },
  AML_LAW: { en: 'our obligations under the anti-money-laundering and counter-terrorist-financing laws', ar: 'التزاماتنا بموجب قوانين مكافحة غسل الأموال وتمويل الإرهاب' },
  COURT_ORDER: { en: 'a court order', ar: 'أمر قضائي' },
  CBL_INSTRUCTION: { en: 'an instruction of the Central Bank of Libya', ar: 'تعليمات مصرف ليبيا المركزي' },
  SERVICE_CONTRACT: { en: 'our agreement with your bank', ar: 'الاتفاقية المبرمة مع مصرفكم' },
};

/** Account digits shown as the bank needs them; names as on the statement. */
export async function bankRequestDetail(id: string) {
  const r = await load(id);
  const line = r.statementLineId ? await prisma.bankStatementLine.findUnique({ where: { id: r.statementLineId } }) : null;
  const t = TYPE_TEXT[r.type as RequestType] ?? TYPE_TEXT.OTHER;
  const b = BASIS_TEXT[r.legalBasis as LegalBasis] ?? BASIS_TEXT.AML_LAW;
  const date = new Date().toISOString().slice(0, 10);
  const due = r.dueAt ? r.dueAt.toISOString().slice(0, 10) : null;
  const tx = line ? {
    en: `Transaction: ${line.direction === 'CREDIT' ? 'received' : 'sent'} ${line.amount} ${line.currency} on ${line.valueDate.toISOString().slice(0, 10)}${line.railRef ? `, reference ${line.railRef}` : ''}${line.counterpartyAccount ? `, account ${line.counterpartyAccount}` : ''}${line.counterpartyName ? `, name shown: ${line.counterpartyName}` : ''}.`,
    ar: `العملية: ${line.direction === 'CREDIT' ? 'استلام' : 'إرسال'} ${line.amount} ${line.currency} بتاريخ ${line.valueDate.toISOString().slice(0, 10)}${line.railRef ? `، الرقم المرجعي ${line.railRef}` : ''}${line.counterpartyAccount ? `، الحساب ${line.counterpartyAccount}` : ''}${line.counterpartyName ? `، الاسم الظاهر: ${line.counterpartyName}` : ''}.`,
  } : null;

  const letters = r.direction === 'OUTBOUND' ? {
    en: [
      `To: Compliance Department, ${r.bankName}${r.bankContact ? ` (${r.bankContact})` : ''}`, `Date: ${date}`, `Our reference: ${r.reference}`, '',
      `Subject: Request for ${t.en}`, '',
      `We request ${t.en}, under ${b.en}.`, tx?.en ?? '', '', r.question, '',
      due ? `We would be grateful for your reply by ${due}, quoting our reference.` : 'Please reply quoting our reference.',
      `Replies: ${complianceEmail()}`, '', 'Compliance Officer, Tazdan',
    ],
    ar: [
      `إلى: إدارة الالتزام، ${r.bankName}${r.bankContact ? ` (${r.bankContact})` : ''}`, `التاريخ: ${date}`, `إشارتنا: ${r.reference}`, '',
      `الموضوع: طلب ${t.ar}`, '',
      `نطلب ${t.ar}، استناداً إلى ${b.ar}.`, tx?.ar ?? '', '', r.question, '',
      due ? `نرجو التكرم بالرد قبل ${due} مع ذكر إشارتنا.` : 'نرجو الرد مع ذكر إشارتنا.',
      `للرد: ${complianceEmail()}`, '', 'مسؤول الالتزام، تزدان',
    ],
  } : {
    en: [
      `To: Compliance Department, ${r.bankName}${r.bankContact ? ` (${r.bankContact})` : ''}`, `Date: ${date}`, `Our reference: ${r.reference}`, '',
      `Subject: Reply to your request for ${t.en}`, '',
      `This information is provided under ${b.en}, for that purpose only, and must be kept confidential.`, '', r.answer ?? '[answer awaiting approval]', '',
      'Compliance Officer, Tazdan',
    ],
    ar: [
      `إلى: إدارة الالتزام، ${r.bankName}${r.bankContact ? ` (${r.bankContact})` : ''}`, `التاريخ: ${date}`, `إشارتنا: ${r.reference}`, '',
      `الموضوع: الرد على طلبكم بشأن ${t.ar}`, '',
      `تُقدّم هذه المعلومات استناداً إلى ${b.ar}، ولهذا الغرض فقط، ويجب الحفاظ على سريتها.`, '', r.answer ?? '[الرد بانتظار الموافقة]', '',
      'مسؤول الالتزام، تزدان',
    ],
  };
  return { ...r, line, letter: { en: letters.en.filter((s, i, a) => s !== '' || a[i - 1] !== '').join('\n'), ar: letters.ar.filter((s, i, a) => s !== '' || a[i - 1] !== '').join('\n') } };
}
