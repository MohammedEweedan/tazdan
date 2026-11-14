import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateTarget, verifyManifest } from './restore-drill.mjs';
test('restore refuses an existing production name, source target equality or missing acknowledgement', () => {
  assert.throws(() => validateTarget(null, 'postgres://localhost/production', '1'));
  assert.throws(() => validateTarget('postgres://localhost/tazdan_restore_a', 'postgres://localhost/tazdan_restore_a', '1'));
  assert.throws(() => validateTarget(null, 'postgres://localhost/tazdan_restore_a', '0'));
  assert.equal(validateTarget(null, 'postgres://localhost/tazdan_restore_a', '1').pathname, '/tazdan_restore_a');
});
test('tampered or escaping backup artifacts fail verification', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tazdan-restore-test-'));
  try {
    fs.writeFileSync(path.join(root, 'db.dump'), 'test');
    const m = { version: 1, createdAt: new Date().toISOString(), database: { file: 'db.dump', sha256: crypto.createHash('sha256').update('test').digest('hex') }, uploads: null };
    const file = path.join(root, 'manifest.json'); fs.writeFileSync(file, JSON.stringify(m));
    await verifyManifest(file);
    fs.writeFileSync(path.join(root, 'db.dump'), 'tamper'); await assert.rejects(() => verifyManifest(file));
    m.database.file = '../db.dump'; fs.writeFileSync(file, JSON.stringify(m)); await assert.rejects(() => verifyManifest(file));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
