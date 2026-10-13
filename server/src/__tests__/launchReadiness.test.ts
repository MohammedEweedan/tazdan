import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { LAUNCH_GATES, readLaunchEvidence, inspectLaunchEvidence, assertLaunchMovement } from '../services/ops/launchReadiness.service';
const sha = 'a'.repeat(40);
const digest = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const fixture = () => ({ version: 1, releaseSha: sha, scope: { market: 'TEST', currencies: ['USD'], features: ['transfers'], corridors: ['TEST-TEST'], providers: ['test-provider'] }, gates: Object.fromEntries(LAUNCH_GATES.map(g => [g, { status: 'verified', owner: 'Test reviewer', verifiedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', artifact: 'proof.txt', sha256: digest('TEST FIXTURE ONLY') }])) });
describe('release evidence and launch scope', () => {
  let root: string;
  const oldEnv = { ...process.env };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tazdan-evidence-')); fs.writeFileSync(path.join(root, 'proof.txt'), 'TEST FIXTURE ONLY'); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); process.env = { ...oldEnv }; });
  const save = (input: any) => { const file = path.join(root, 'evidence.json'); fs.writeFileSync(file, JSON.stringify(input)); return file; };
  it('requires seven current reviews bound to the deployed commit and artifact bytes', () => {
    const f = fixture(); const file = save(f);
    expect(readLaunchEvidence(file, sha).ok).toBe(true);
    expect(readLaunchEvidence(file, 'b'.repeat(40)).ok).toBe(false);
    fs.writeFileSync(path.join(root, 'proof.txt'), 'changed');
    expect(readLaunchEvidence(file, sha).ok).toBe(false);
    f.gates.providers.status = 'pending'; expect(inspectLaunchEvidence(f, sha).ok).toBe(false);
  });
  it('rejects expired/future reviews and path escape including symlinks', () => {
    const f = fixture(); f.gates.authorization.expiresAt = '2020-01-01T00:00:00Z';
    expect(inspectLaunchEvidence(f, sha).ok).toBe(false);
    f.gates.authorization = { ...fixture().gates.authorization, verifiedAt: '2098-01-01T00:00:00Z' };
    expect(inspectLaunchEvidence(f, sha).ok).toBe(false);
    f.gates.authorization = { ...fixture().gates.authorization, artifact: '../missing' };
    expect(readLaunchEvidence(save(f), sha).ok).toBe(false);
    fs.symlinkSync('/etc/hosts', path.join(root, 'outside')); f.gates.authorization.artifact = 'outside';
    expect(readLaunchEvidence(save(f), sha).ok).toBe(false);
  });
  it('keeps production closed by default and enforces approved features, currencies, corridors and providers', () => {
    process.env.NODE_ENV = 'production'; delete process.env.REAL_MONEY_ENABLED;
    expect(() => assertLaunchMovement('transfers', 'USD')).toThrow(/not open/);
    process.env.REAL_MONEY_ENABLED = '1'; process.env.RELEASE_SHA = sha; process.env.LAUNCH_EVIDENCE_PATH = save(fixture());
    expect(() => assertLaunchMovement('transfers', 'USD', 'TEST-TEST', 'test-provider')).not.toThrow();
    for (const args of [['cards', 'USD'], ['transfers', 'LYD'], ['transfers', 'USD', 'OTHER-TEST'], ['transfers', 'USD', undefined, 'unknown']]) {
      expect(() => assertLaunchMovement(...args as [string, string?, string?, string?])).toThrow(/outside/);
    }
  });
});
