import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './secret-scan.mjs';
test('scans examples and Markdown without revealing secret bytes', () => {
  const credential = 'A'.repeat(24);
  const text = ['SMTP_PASS="' + credential + '"', 'token: ' + 'sk_' + 'live_' + credential, 'postgres://user:' + credential + '@db.example.com/prod'].join('\n');
  const findings = scanText(text); assert.equal(findings.length, 3);
  assert.ok(!JSON.stringify(findings).includes(credential));
});
test('permits empty config and explicit local test database fixtures', () => {
  assert.equal(scanText('SMTP_PASS=""\npostgres://test:testpassword@localhost:5432/test').length, 0);
});
