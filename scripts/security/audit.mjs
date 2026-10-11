import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { auditViolations } from './audit-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = process.argv[2];
if (!['server', 'client', 'mobile'].includes(workspace)) throw new Error('Choose server, client or mobile');
const exceptions = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/dependency-exceptions.json'), 'utf8'));
let raw;
try { raw = execFileSync('npm', ['audit', '--json', '--fetch-retries=1', '--fetch-timeout=30000'], { cwd: path.join(root, workspace), encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (error) { if (error.status !== 1 || !error.stdout) throw new Error('Dependency audit failed to run; release blocked'); raw = error.stdout; }
const audit = JSON.parse(raw);
const result = auditViolations(audit, workspace, exceptions);
console.log(JSON.stringify({ workspace, counts: audit.metadata.vulnerabilities, ...result }, null, 2));
process.exitCode = result.failures.length ? 1 : 0;
