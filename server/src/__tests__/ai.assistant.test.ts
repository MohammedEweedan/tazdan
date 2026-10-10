/**
 * AI control layer: permission-scoped tools, audit trail, human acceptance of
 * drafts and the OFF switch. The Anthropic client is mocked — no network.
 * RUN_DB_TESTS=1 locally; always in CI.
 */
import { prisma } from '../utils/prisma';
import { ask, decideDraft, draftCaseSummary } from '../services/ai/assistant.service';
import { toolsFor } from '../services/ai/tools';
import { openCase } from '../services/compliance/cases.service';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  class FakeAnthropic { beta = { messages: { create: (...args: unknown[]) => mockCreate(...args) } }; }
  for (const k of ['RateLimitError', 'AuthenticationError', 'PermissionDeniedError', 'BadRequestError', 'APIError', 'APIConnectionError']) (FakeAnthropic as any)[k] = actual[k];
  return { __esModule: true, default: FakeAnthropic };
});

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `ai${Date.now().toString(36)}`;

const msg = (content: any[], stop_reason: string) => ({ id: 'msg', model: 'claude-opus-5', role: 'assistant', type: 'message', content, stop_reason, stop_details: null, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });

describe('AI tool scoping', () => {
  it('offers only tools the operator’s permissions allow', () => {
    const support = toolsFor(['ai.use', 'support.read']).map((t) => t.definition.name);
    expect(support).toEqual(['support_context']);
    const all = toolsFor(['cockpit.view', 'customers.read', 'treasury.read']).map((t) => t.definition.name);
    expect(all).toEqual(expect.arrayContaining(['platform_overview', 'search_records', 'customer_profile', 'treasury_positions']));
    expect(all).not.toContain('compliance_case');
  });
});

describeDb('AI assistant', () => {
  let staffId: string;
  const env = { ...process.env };

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used';
    process.env.AI_LEVEL = 'ASSIST';
    const s = await prisma.user.create({ data: { email: `${marker}@example.com`, passwordHash: 'x', firstName: 'Ai', lastName: 'Operator', role: 'ADMIN', status: 'ACTIVE', username: marker, referralCode: `${marker}r` } });
    staffId = s.id;
  });
  afterAll(async () => { process.env = env; await prisma.$disconnect().catch(() => {}); });
  beforeEach(() => mockCreate.mockReset());

  it('never runs a tool outside the operator’s role, and logs every call', async () => {
    mockCreate
      .mockResolvedValueOnce(msg([{ type: 'tool_use', id: 'tu1', name: 'treasury_positions', input: {} }, { type: 'tool_use', id: 'tu2', name: 'platform_overview', input: {} }], 'tool_use'))
      .mockResolvedValueOnce(msg([{ type: 'text', text: 'Treasury data is not available to you; the overview shows 0 open exceptions.' }], 'end_turn'));
    const r = await ask({ id: staffId, permissions: ['ai.use', 'cockpit.view'] }, 'How is treasury doing?');
    expect(r.answer).toContain('not available');
    // The model was only offered the permitted tool…
    expect(mockCreate.mock.calls[0][0].tools.map((t: any) => t.name)).toEqual(['platform_overview']);
    expect(mockCreate.mock.calls[0][0].fallbacks).toBe('default');
    // …and a call to anything else came back as an error without running.
    const followUp = mockCreate.mock.calls[1][0].messages.at(-1).content;
    const denied = followUp.find((b: any) => b.tool_use_id === 'tu1');
    expect(denied.is_error).toBe(true);
    expect(JSON.parse(denied.content).error).toMatch(/not available/);
    expect(JSON.parse(followUp.find((b: any) => b.tool_use_id === 'tu2').content)).toHaveProperty('queues');
    const logged = await prisma.aiInteraction.findUniqueOrThrow({ where: { id: r.interactionId } });
    expect(logged.operatorId).toBe(staffId);
    expect((logged.references as any).toolCalls.map((c: any) => [c.name, c.isError])).toEqual([['treasury_positions', true], ['platform_overview', false]]);
  });

  it('a case summary is a draft until a compliance officer accepts it, once', async () => {
    const c = await openCase({ type: 'AML', title: `${marker} test case`, summary: 'Test' });
    mockCreate.mockResolvedValueOnce(msg([{ type: 'text', text: '1. What happened — test.' }], 'end_turn'));
    const d = await draftCaseSummary({ id: staffId, permissions: ['ai.use', 'compliance.read'] }, c.id);
    expect((await prisma.caseNote.count({ where: { caseId: c.id, authorType: 'AI' } }))).toBe(0);
    await expect(decideDraft({ id: staffId, permissions: ['ai.use', 'compliance.read'] }, d.interactionId, true)).rejects.toMatchObject({ statusCode: 403 });
    const accepted = await decideDraft({ id: staffId, permissions: ['ai.use', 'compliance.case.manage'] }, d.interactionId, true, '1. What happened — edited by officer.');
    expect(accepted.approvalStatus).toBe('APPROVED');
    expect(accepted.outcome).toBe('ACCEPTED_EDITED');
    const note = await prisma.caseNote.findFirstOrThrow({ where: { caseId: c.id, authorType: 'AI' } });
    expect(note.body).toContain('edited by officer');
    await expect(decideDraft({ id: staffId, permissions: ['ai.use', 'compliance.case.manage'] }, d.interactionId, true)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('is unavailable when switched off', async () => {
    process.env.AI_LEVEL = 'OFF';
    await expect(ask({ id: staffId, permissions: ['ai.use'] }, 'hello there')).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(mockCreate).not.toHaveBeenCalled();
    process.env.AI_LEVEL = 'ASSIST';
  });
});
