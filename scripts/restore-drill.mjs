#!/usr/bin/env node
// Restores ONLY into a new disposable database. Never drops/cleans a database.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function validateTarget(source, target, confirmed) {
  if (confirmed !== '1') throw new Error('Set RESTORE_DRILL_CONFIRMED=1 for a disposable restore database');
  const dst = new URL(target);
  if (!['postgres:', 'postgresql:'].includes(dst.protocol) || !/^\/tazdan_restore_[a-z0-9_]{1,48}$/.test(dst.pathname)) throw new Error('Target database must have the tazdan_restore_ prefix');
  if (source) {
    const src = new URL(source);
    if (src.hostname === dst.hostname && src.port === dst.port && src.pathname === dst.pathname) throw new Error('Source and restore target must differ');
  }
  return dst;
}
async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyManifest(manifestFile) {
  const root = fs.realpathSync(path.dirname(path.resolve(manifestFile)));
  const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (m.version !== 1 || !m.database || !Number.isFinite(Date.parse(m.createdAt))) throw new Error('Invalid backup manifest');
  let dump;
  for (const [kind, item] of [['database', m.database], ['uploads', m.uploads]]) {
    if (!item && kind === 'uploads') continue;
    if (!item || path.basename(item.file) !== item.file || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid backup artifact');
    const file = fs.realpathSync(path.join(root, item.file));
    if (!file.startsWith(root + path.sep) || await digest(file) !== item.sha256) throw new Error('Backup artifact digest does not match');
    if (kind === 'database') dump = file;
  }
  return { manifest: m, dump };
}
function pgCommand(tool, args, url) {
  const connection = new URL(url); const password = decodeURIComponent(connection.password); connection.password = '';
  const env = { ...process.env, PGPASSWORD: password };
  const pgArgs = ['--dbname', connection.toString(), ...args];
  return process.env.PG_TOOL_CONTAINER
    ? { executable: 'docker', args: ['exec', '-i', '--env', 'PGPASSWORD', process.env.PG_TOOL_CONTAINER, tool, ...pgArgs], env }
    : { executable: tool, args: pgArgs, env };
}
function sql(url, query) {
  const cmd = pgCommand('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', query], url);
  try { return execFileSync(cmd.executable, cmd.args, { env: cmd.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim(); }
  catch { throw new Error('Restore database query failed; credentials and database errors are omitted'); }
}
async function restore(url, dump) {
  const cmd = pgCommand('pg_restore', ['--exit-on-error', '--no-owner', '--no-privileges'], url);
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(dump);
    const child = spawn(cmd.executable, cmd.args, { env: cmd.env, stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.resume(); // Never print connection details or restored private rows.
    child.on('error', () => reject(new Error('Restore process could not start')));
    child.stdin.on('error', () => {});
    input.on('error', reject); input.pipe(child.stdin);
    child.on('close', code => { input.destroy(); code === 0 ? resolve() : reject(new Error('Restore failed; disposable target retained for investigation')); });
  });
}
export async function runDrill() {
  const started = Date.now();
  const dst = validateTarget(process.env.DATABASE_URL, process.env.RESTORE_TARGET_DATABASE_URL, process.env.RESTORE_DRILL_CONFIRMED);
  const { manifest, dump } = await verifyManifest(process.env.RESTORE_MANIFEST_PATH);
  const db = dst.pathname.slice(1); const admin = new URL(dst); admin.pathname = '/postgres';
  if (sql(admin.toString(), `SELECT 1 FROM pg_database WHERE datname='${db}'`) === '1') throw new Error('Target already exists; choose a new database. Nothing was dropped');
  sql(admin.toString(), `CREATE DATABASE "${db}"`);
  await restore(dst.toString(), dump);
  const failures = Number(sql(dst.toString(), `SELECT count(*) FROM (
    SELECT "groupId",currency FROM "LedgerEntry" GROUP BY "groupId",currency HAVING abs(sum(amount)) > 0.000000000001
    UNION ALL
    SELECT a.id,a.currency FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId"=a.id GROUP BY a.id HAVING abs(a.balance-coalesce(sum(e.amount),0)) > 0.000000000001
  ) problems`));
  const invalidReserves = Number(sql(dst.toString(), 'SELECT count(*) FROM "Wallet" WHERE balance < 0 OR frozen < 0 OR frozen > balance'));
  const entries = Number(sql(dst.toString(), 'SELECT count(*) FROM "LedgerEntry"'));
  const elapsedSeconds = (Date.now() - started) / 1000;
  const withinRto = elapsedSeconds <= Number(process.env.RESTORE_RTO_SECONDS ?? 3600);
  const report = { version: 1, status: failures === 0 && invalidReserves === 0 && withinRto ? 'passed' : 'failed', createdAt: new Date().toISOString(), targetDatabase: db, backupCreatedAt: manifest.createdAt, elapsedSeconds, withinRto, ledgerExceptions: failures, invalidReserves, ledgerEntries: entries, uploadsDigestVerified: Boolean(manifest.uploads), limitations: ['Local restore timing excludes outage detection, offsite download, key recovery and cutover.', 'PITR RPO and provider/wallet reconciliation require a separate drill.', 'Uploads digest verification is not an application document-read test.'] };
  const output = process.env.RESTORE_REPORT_PATH ?? path.join(path.dirname(path.resolve(process.env.RESTORE_MANIFEST_PATH)), `${db}.report.json`);
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runDrill().catch(() => { console.error('Restore drill failed. Verify manifest, fresh disposable target and access; no credentials are printed.'); process.exitCode = 1; });
