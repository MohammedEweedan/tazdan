import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditViolations } from './audit-policy.mjs';

const advisory = { name: 'braces', severity: 'high', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' };
const waiver = { package: 'braces', advisory: 'GHSA-vfj7-8cjw-p6xm', workspaces: ['client'], scope: 'build-only', owner: 'Security owner', reason: 'Only repository-controlled lint patterns are processed by the tool.', expiresAt: '2026-11-10T00:00:00Z' };
const audit = { metadata: {}, vulnerabilities: { braces: { name: 'braces', severity: 'high', via: [advisory] }, lint: { name: 'lint', severity: 'high', via: ['braces'] } } };
test('a precisely scoped current exception covers inherited reports', () => assert.equal(auditViolations(audit, 'client', [waiver], Date.parse('2026-10-11')).failures.length, 0));
test('exceptions cannot cover another workspace, advisory, expiry or critical severity', () => {
  assert.ok(auditViolations(audit, 'server', [waiver], Date.parse('2026-10-11')).failures.length);
  assert.ok(auditViolations(audit, 'client', [waiver], Date.parse('2026-11-11')).failures.length);
  const changed = structuredClone(audit); changed.vulnerabilities.braces.via[0].url += '-new';
  assert.ok(auditViolations(changed, 'client', [waiver], Date.parse('2026-10-11')).failures.length);
  changed.vulnerabilities.braces.via[0] = { ...advisory, severity: 'critical' };
  assert.ok(auditViolations(changed, 'client', [waiver], Date.parse('2026-10-11')).failures.length);
});
test('an incomplete audit fails closed', () => assert.throws(() => auditViolations({ error: {} }, 'client', [])));
