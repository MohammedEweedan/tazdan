/**
 * AI control layer for the cockpit.
 *
 * Levels (AI_LEVEL):
 *   OFF      — disabled (the production default until a data-processing
 *              agreement is in place and AI_LEVEL is set deliberately).
 *   OBSERVE  — the assistant answers questions from live platform data.
 *   ASSIST   — OBSERVE plus drafts (case summaries, support replies) that a
 *              person must accept before they take effect.
 * There is no AUTOMATE level: the assistant never moves money, changes a
 * status or sends anything. Its tools are read-only and limited to what the
 * operator's own role can see. Every request, every tool call it made and
 * what happened to each draft is recorded in AiInteraction.
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { AI_TOOLS, runTool, toolsFor } from './tools';

export type AiLevel = 'OFF' | 'OBSERVE' | 'ASSIST';
const MODEL = () => process.env.AI_MODEL?.trim() || 'claude-opus-5';
const MAX_TOOL_ROUNDS = 8;

export function aiLevel(): AiLevel {
  const v = (process.env.AI_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'OFF' : 'ASSIST')).toUpperCase();
  return v === 'OBSERVE' || v === 'ASSIST' ? v : 'OFF';
}
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());

export function aiStatus() {
  return { level: aiLevel(), configured: aiConfigured(), model: MODEL(), enabled: aiLevel() !== 'OFF' && aiConfigured() };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN from the environment
  return client;
}

function assertLevel(min: Exclude<AiLevel, 'OFF'>) {
  const s = aiStatus();
  if (!s.configured) throw new AppError('The AI assistant is not configured on this server (no Anthropic credentials)', 503, 'FEATURE_DISABLED');
  if (s.level === 'OFF') throw new AppError('The AI assistant is switched off (AI_LEVEL=OFF)', 503, 'FEATURE_DISABLED');
  if (min === 'ASSIST' && s.level !== 'ASSIST') throw new AppError('Drafting needs AI_LEVEL=ASSIST', 503, 'FEATURE_DISABLED');
}

// Stable text only (no timestamps or IDs) so the prompt prefix stays cacheable.
const ASSISTANT_SYSTEM = `You are the operations assistant inside Tazdan's Control Cockpit. Tazdan is a regulated-style money platform: wallets, Libya-focused remittance corridors, FX, P2P, business payouts. Your readers are Tazdan staff (operations, compliance, treasury, support, finance).

How to work:
- Answer only from what the tools return. If the data needed is not available to you, say so plainly and say which page of the cockpit would show it. Never estimate or invent figures, names, statuses or dates.
- Quote exact amounts with their currency, and name the record (reference or ID) each fact comes from, so the reader can open it.
- Keep answers short and scannable: lead with the answer, then the supporting facts. Use plain language; explain risk-rule codes in words.
- You cannot take actions. When something should be done (approve, refund, escalate, change a rule), say what you recommend and who would do it in the cockpit; sensitive actions there need a second approver.
- Customer data is confidential. Do not repeat more personal detail than the question needs. Masked values (emails, account numbers) stay masked.
- Sanctions, fraud and AML matters are internal. Never suggest telling a customer that they matched a watchlist, are suspected of fraud, or are under compliance review.`;

const SUPPORT_SYSTEM = `You draft replies for Tazdan's support agents to send to a customer. The agent will review and edit your draft before anything is sent.

Rules for the draft:
- Write to the customer in the language they used most recently (Arabic or English). Warm, plain, specific; no marketing language.
- Use only facts in the provided context. If the answer depends on something not in the context, write the reply so the agent can fill it in, marked like [agent: confirm …].
- Never mention compliance reviews, sanctions or watchlist screening, fraud suspicion, risk scores or internal case numbers. For a held or delayed payment, say it is being checked and give the next step or timeframe only if the context states one.
- Never promise refunds, timelines or outcomes the context does not support.
- Return only the reply text, with no preamble.`;

const CASE_SYSTEM = `You summarise a compliance case file for Tazdan's compliance officers. The officer will review your summary before it is added to the case file.

Write these sections with short bullet points:
1. What happened — the facts, with amounts, dates and references.
2. Risk indicators — which rules fired and what they mean in plain words; note anything that weakens or strengthens each.
3. Gaps — information that is missing and would change the decision.
4. Suggested next step — one recommendation, framed as a suggestion for the officer to decide.
Use only the provided record. Do not speculate about intent or guilt. Return only the summary.`;

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
const addUsage = (u: Usage, r: Anthropic.Beta.BetaMessage) => {
  u.input += r.usage.input_tokens ?? 0; u.output += r.usage.output_tokens ?? 0;
  u.cacheRead += r.usage.cache_read_input_tokens ?? 0; u.cacheWrite += r.usage.cache_creation_input_tokens ?? 0;
};
const textOf = (content: Anthropic.Beta.BetaContentBlock[]) => content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();

function mapProviderError(err: unknown): never {
  if (err instanceof Anthropic.RateLimitError) throw new AppError('The AI provider is rate-limiting requests — try again shortly', 429, 'RATE_LIMITED');
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AppError('The AI provider rejected this server’s credentials', 503, 'PROVIDER_UNAVAILABLE');
  if (err instanceof Anthropic.BadRequestError) throw new AppError(`The AI request was invalid: ${err.message.slice(0, 200)}`, 502, 'PROVIDER_REJECTED');
  // APIConnectionError extends APIError, so it is checked first.
  if (err instanceof Anthropic.APIConnectionError) throw new AppError('Could not reach the AI provider', 503, 'PROVIDER_UNAVAILABLE');
  if (err instanceof Anthropic.APIError) throw new AppError('The AI provider is unavailable — try again shortly', 503, 'PROVIDER_UNAVAILABLE');
  throw err;
}

async function create(params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, 'model' | 'max_tokens'> & { max_tokens?: number }) {
  return getClient().beta.messages.create({
    model: MODEL(), max_tokens: params.max_tokens ?? 16000, thinking: { type: 'adaptive' },
    // A safety-classifier decline is retried server-side on the model Anthropic recommends.
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    ...params,
  });
}

export interface StaffActor { id: string; permissions: string[] }

/** OBSERVE: answer a question from live data using the operator's permitted tools. */
export async function ask(staff: StaffActor, question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
  assertLevel('OBSERVE');
  const tools = toolsFor(staff.permissions);
  const prior = history.slice(-10);
  while (prior.length && prior[0].role !== 'user') prior.shift(); // a conversation must open with a user turn
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...prior.map((h) => ({ role: h.role, content: h.content.slice(0, 4000) })),
    { role: 'user', content: question },
  ];
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const toolCalls: Array<{ name: string; input: unknown; refs: string[]; isError: boolean }> = [];
  let answer = ''; let stopReason: string | null = null; let model = MODEL(); let refusal: string | null = null;
  const started = Date.now();
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await create({
        system: [{ type: 'text', text: ASSISTANT_SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: tools.map((t) => t.definition), messages,
      });
      addUsage(usage, res);
      model = res.model; stopReason = res.stop_reason;
      if (res.stop_reason === 'refusal') { refusal = res.stop_details?.category ?? 'unspecified'; answer = 'The assistant declined to answer this request.'; break; }
      if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
      const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !uses.length) { answer = textOf(res.content); break; }
      if (round === MAX_TOOL_ROUNDS) { answer = `${textOf(res.content)}\n\n(Stopped after ${MAX_TOOL_ROUNDS} lookups — ask a narrower question.)`.trim(); break; }
      messages.push({ role: 'assistant', content: res.content });
      const results = await Promise.all(uses.map(async (u) => {
        const tool = tools.find((t) => t.definition.name === u.name);
        if (!tool) {
          // Not offered to this operator, or unknown: never executed.
          toolCalls.push({ name: u.name, input: u.input, refs: [], isError: true });
          return { type: 'tool_result' as const, tool_use_id: u.id, content: JSON.stringify({ error: 'This data is not available to your role.' }), is_error: true };
        }
        const r = await runTool(tool, u.input as Record<string, any>);
        toolCalls.push({ name: u.name, input: u.input, refs: r.refs, isError: r.isError });
        return { type: 'tool_result' as const, tool_use_id: u.id, content: r.text, is_error: r.isError };
      }));
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    await prisma.aiInteraction.create({ data: { kind: 'ASSISTANT_QUERY', level: 'OBSERVE', operatorId: staff.id, model, input: { question }, references: { toolCalls } as any, output: { error: (err as Error).message.slice(0, 300) }, outcome: 'ERROR' } }).catch(() => undefined);
    logger.warn('[ai] assistant request failed', { err: (err as Error).message });
    mapProviderError(err);
  }
  const row = await prisma.aiInteraction.create({
    data: {
      kind: 'ASSISTANT_QUERY', level: 'OBSERVE', operatorId: staff.id, model,
      input: { question, historyTurns: history.length }, references: { toolCalls } as any,
      output: { answer, stopReason, refusal, usage, ms: Date.now() - started }, outcome: refusal ? 'REFUSED' : 'ANSWERED',
    },
  });
  return { interactionId: row.id, answer, model, toolCalls: toolCalls.map(({ name, refs, isError }) => ({ name, refs, isError })), usage, refusal };
}

async function draft(kind: 'CASE_SUMMARY' | 'SUPPORT_REPLY', staff: StaffActor, system: string, context: unknown, instruction: string, references: Record<string, unknown>) {
  assertLevel('ASSIST');
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await create({
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `${instruction}\n\n<record>\n${JSON.stringify(context, null, 2).slice(0, 60_000)}\n</record>` }],
    });
  } catch (err) { mapProviderError(err); }
  const refused = res.stop_reason === 'refusal';
  const text = refused ? '' : textOf(res.content);
  const row = await prisma.aiInteraction.create({
    data: {
      kind, level: 'ASSIST', operatorId: staff.id, model: res.model, input: { instruction }, references: references as any,
      output: { text, stopReason: res.stop_reason, refusal: refused ? res.stop_details?.category ?? 'unspecified' : null, usage: res.usage as any },
      approvalStatus: refused ? 'NOT_REQUIRED' : 'PENDING', outcome: refused ? 'REFUSED' : null,
    },
  });
  if (refused) throw new AppError('The assistant declined to draft this', 422);
  return { interactionId: row.id, text, model: res.model };
}

const tool = (name: string) => AI_TOOLS.find((t) => t.definition.name === name)!;

/** ASSIST: summary of a compliance case for the officer to accept into the case file. */
export async function draftCaseSummary(staff: StaffActor, caseId: string) {
  const c = await prisma.complianceCase.findUnique({ where: { id: caseId } });
  if (!c) throw new AppError('Case not found', 404);
  const context: Record<string, unknown> = { case: JSON.parse((await runTool(tool('compliance_case'), { id_or_reference: c.id })).text) };
  if (c.subjectUserId && staff.permissions.includes('customers.read')) context.subject = JSON.parse((await runTool(tool('customer_profile'), { user_id: c.subjectUserId })).text);
  if (c.subjectType === 'REMITTANCE' && c.subjectId && staff.permissions.includes('remittance.read')) context.transfer = JSON.parse((await runTool(tool('remittance_transfer'), { id_or_reference: c.subjectId })).text);
  return draft('CASE_SUMMARY', staff, CASE_SYSTEM, context, `Summarise compliance case ${c.reference}.`, { caseId: c.id, subjectUserId: c.subjectUserId, subject: c.subjectType ? `${c.subjectType}:${c.subjectId}` : null });
}

/** ASSIST: reply draft for a support escalation; the agent edits and sends it. */
export async function draftSupportReply(staff: StaffActor, escalationId: string) {
  const t = await prisma.supportEscalation.findUnique({ where: { id: escalationId } });
  if (!t) throw new AppError('Escalation not found', 404);
  const context = { escalation: { reason: t.reason, details: t.details, status: t.status, createdAt: t.createdAt, fromP2PTrade: Boolean(t.tradeId) }, customer: JSON.parse((await runTool(tool('support_context'), { user_id: t.raisedById })).text) };
  return draft('SUPPORT_REPLY', staff, SUPPORT_SYSTEM, context, 'Draft a reply to this customer about their escalation.', { escalationId: t.id, userId: t.raisedById });
}

/** A person accepts (optionally edited) or rejects a draft. Accepting a case summary adds it to the case file. */
export async function decideDraft(staff: StaffActor, interactionId: string, accept: boolean, finalText?: string, note?: string) {
  const row = await prisma.aiInteraction.findUnique({ where: { id: interactionId } });
  if (!row) throw new AppError('AI draft not found', 404);
  if (row.approvalStatus !== 'PENDING') throw new AppError(`This draft is already ${row.approvalStatus.toLowerCase()}`, 409);
  const required = row.kind === 'CASE_SUMMARY' ? 'compliance.case.manage' : row.kind === 'SUPPORT_REPLY' ? 'support.reply' : 'ai.approve';
  // Whoever asked for a draft may always discard it; accepting needs the permission the action itself needs.
  const ownDiscard = !accept && row.operatorId === staff.id;
  if (!ownDiscard && !staff.permissions.includes(required)) throw new AppError(`Deciding this draft needs the ${required} permission`, 403, 'AUTHORIZATION');
  const draftText = String((row.output as any)?.text ?? '');
  const text = (finalText ?? draftText).trim();
  if (accept && !text) throw new AppError('Nothing to accept', 400);
  return prisma.$transaction(async (tx) => {
    const moved = await tx.aiInteraction.updateMany({
      where: { id: row.id, approvalStatus: 'PENDING' },
      data: { approvalStatus: accept ? 'APPROVED' : 'REJECTED', approvedById: staff.id, approvedAt: new Date(), outcome: accept ? (text === draftText ? 'ACCEPTED_AS_DRAFTED' : 'ACCEPTED_EDITED') : `REJECTED${note ? `: ${note.slice(0, 200)}` : ''}` },
    });
    if (moved.count !== 1) throw new AppError('This draft was decided by someone else — refresh', 409);
    if (accept && row.kind === 'CASE_SUMMARY') {
      const caseId = String((row.references as any)?.caseId ?? '');
      await tx.caseNote.create({ data: { caseId, authorId: staff.id, authorType: 'AI', kind: 'AI_SUMMARY', body: `${text}\n\n— AI-drafted summary (${row.model}), reviewed and accepted by staff.` } });
    }
    return tx.aiInteraction.findUniqueOrThrow({ where: { id: row.id } });
  });
}
