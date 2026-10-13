import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const RULES = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['AWS-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['service-key', /\b(?:sk_live_|rk_live_|ghp_|github_pat_|re_)[A-Za-z0-9_]{20,}\b/],
  ['mail-password', /^\s*SMTP_PASS\s*=\s*["']?([^"'\r\n#]+)/],
  ['connection-password', /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@([^/\s]+)/],
];
const placeholder = value => /^(?:\s*|pass|password|test\w*|changeme\w*|your[_ -].*|example\w*|\$\{.*\}|<.*>)$/i.test(value.trim());
export function scanText(text) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const [kind, rule] of RULES) {
      const match = rule.exec(line); if (!match) continue;
      if (kind === 'mail-password' && placeholder(match[1])) continue;
      if (kind === 'connection-password' && (/^(?:localhost|127\.0\.0\.1|postgres)(?::\d+)?$/.test(match[2]) || placeholder(match[1]))) continue;
      findings.push({ line: i + 1, kind });
    }
  });
  return findings;
}
export function scanRepository() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  for (const file of files) {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size > 2 * 1024 * 1024) continue;
    const data = fs.readFileSync(file); if (data.includes(0)) continue;
    findings.push(...scanText(data.toString('utf8')).map(f => ({ file, ...f })));
  }
  // Report location/category only. Credential bytes must never enter CI logs.
  for (const f of findings) console.error(`${f.file}:${f.line}: ${f.kind}`);
  console.log(`Secret scan: ${files.length} tracked paths, ${findings.length} findings`);
  return findings;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = scanRepository().length ? 1 : 0;
