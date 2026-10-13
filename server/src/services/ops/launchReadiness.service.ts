import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export const LAUNCH_GATES = ['authorization', 'providers', 'security', 'moneyPaths', 'deviceQa', 'recovery', 'operations'] as const;
const FEATURES = ['withdrawals', 'deposits', 'p2p', 'fx', 'remittance', 'blockchain', 'cards', 'transfers', 'business_payouts'] as const;
const review = z.object({
  status: z.enum(['verified', 'pending']),
  owner: z.string().min(3),
  verifiedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  artifact: z.string().min(1).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export const launchEvidenceSchema = z.object({
  version: z.literal(1),
  releaseSha: z.string().regex(/^[a-f0-9]{40}$/),
  scope: z.object({
    market: z.string().min(2),
    currencies: z.array(z.string().regex(/^[A-Z0-9_]{2,12}$/)).nonempty(),
    features: z.array(z.enum(FEATURES)).nonempty(),
    corridors: z.array(z.string().min(3)).default([]),
    providers: z.array(z.string().min(2)).default([]),
  }).strict(),
  gates: z.object({ authorization: review, providers: review, security: review, moneyPaths: review, deviceQa: review, recovery: review, operations: review }).strict(),
}).strict();
export type LaunchEvidence = z.infer<typeof launchEvidenceSchema>;

export function inspectLaunchEvidence(input: unknown, releaseSha: string | undefined, now = Date.now()) {
  const parsed = launchEvidenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, problems: ['Launch evidence is missing or invalid'], evidence: null };
  const evidence = parsed.data;
  const problems: string[] = [];
  if (!releaseSha || evidence.releaseSha !== releaseSha) problems.push('Evidence must match the deployed release SHA');
  if (new Set(evidence.scope.features).size !== evidence.scope.features.length || new Set(evidence.scope.currencies).size !== evidence.scope.currencies.length) problems.push('Launch scope contains duplicates');
  for (const gate of LAUNCH_GATES) {
    const r = evidence.gates[gate];
    const verified = Date.parse(r.verifiedAt ?? '');
    const expires = Date.parse(r.expiresAt ?? '');
    if (r.status !== 'verified' || !r.artifact || !r.sha256 || !Number.isFinite(verified) || verified > now || !Number.isFinite(expires) || expires <= now || expires <= verified) {
      problems.push(`${gate}: current reviewed evidence is required`);
    }
  }
  return { ok: problems.length === 0, problems, evidence };
}

export function readLaunchEvidence(file: string | undefined, releaseSha: string | undefined) {
  if (!file) return inspectLaunchEvidence(null, releaseSha);
  let input: unknown;
  try {
    if (fs.statSync(file).size > 64 * 1024) throw new Error('Evidence manifest too large');
    input = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return { ok: false, problems: ['Launch evidence file cannot be read'], evidence: null }; }
  const result = inspectLaunchEvidence(input, releaseSha);
  if (!result.ok || !result.evidence) return result;
  const root = path.dirname(path.resolve(file));
  for (const gate of LAUNCH_GATES) {
    const r = result.evidence.gates[gate];
    try {
      const artifact = path.resolve(root, r.artifact!);
      if (artifact !== root && !artifact.startsWith(root + path.sep)) throw new Error('Artifact outside evidence directory');
      const real = fs.realpathSync(artifact);
      if (!real.startsWith(fs.realpathSync(root) + path.sep) || fs.statSync(real).size > 20 * 1024 * 1024) throw new Error('Invalid artifact');
      const hash = crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex');
      if (hash !== r.sha256) throw new Error('Artifact changed');
    } catch { result.problems.push(`${gate}: evidence artifact is missing or its digest differs`); }
  }
  return { ...result, ok: result.problems.length === 0 };
}

let cached: ReturnType<typeof readLaunchEvidence> | null = null;
let cacheKey = '';
let cachedAt = 0;

export function isRealMoneyEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.REAL_MONEY_ENABLED === '1';
}

export function currentLaunchReadiness() {
  const file = process.env.LAUNCH_EVIDENCE_PATH;
  const sha = process.env.RELEASE_SHA;
  const key = `${file ?? ''}:${sha ?? ''}`;
  if (!cached || cacheKey !== key || Date.now() - cachedAt > 30_000) {
    cached = readLaunchEvidence(file, sha); cacheKey = key; cachedAt = Date.now();
  }
  // Check expiration on every use, including within the file-cache window.
  if (cached.ok && cached.evidence) return inspectLaunchEvidence(cached.evidence, sha);
  return cached;
}

export function assertLaunchMovement(feature: string, currency?: string | null, corridor?: string | null, provider?: string | null) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!isRealMoneyEnabled()) throw new AppError('Money services are not open yet.', 503, 'FEATURE_DISABLED');
  const report = currentLaunchReadiness();
  if (!report.ok || !report.evidence) throw new AppError('Money services are temporarily paused for launch verification.', 503, 'FEATURE_DISABLED');
  const { scope } = report.evidence;
  if (!scope.features.includes(feature as typeof FEATURES[number]) || (currency && !scope.currencies.includes(currency.toUpperCase())) ||
      (corridor && !scope.corridors.includes(corridor)) || (provider && !scope.providers.includes(provider))) {
    throw new AppError('This service is outside the current launch scope.', 503, 'FEATURE_DISABLED');
  }
}
