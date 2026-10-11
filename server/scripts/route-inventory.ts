/**
 * Static route inventory. Parses src/index.ts mounts and every router file,
 * then prints one line per endpoint (METHOD PATH AUTH) or a JSON summary.
 *
 *   npx ts-node --transpile-only scripts/route-inventory.ts          # table
 *   npx ts-node --transpile-only scripts/route-inventory.ts --json   # JSON
 *
 * Static only: it reads source text, so it counts what is declared and
 * mounted, not what a running server answers.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../src');
const index = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf8');

// import { xRouter } from './routes/x'  |  import xRouter from './routes/x'
const importMap = new Map<string, string>();
for (const m of index.matchAll(/import\s+(?:\{\s*(\w+)\s*\}|(\w+))\s+from\s+'\.\/routes\/([\w/.-]+)'/g)) {
  importMap.set(m[1] ?? m[2], m[3]);
}

const mounts: Array<{ prefix: string; file: string }> = [];
for (const m of index.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
  const file = importMap.get(m[2]);
  if (file) mounts.push({ prefix: m[1], file });
}

interface Endpoint { method: string; path: string; auth: string; file: string }
const endpoints: Endpoint[] = [];

// Inline endpoints declared directly on `app` in index.ts.
for (const m of index.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,([^\n]*)/g)) {
  endpoints.push({ method: m[1].toUpperCase(), path: m[2], auth: authOf(m[3], ''), file: 'index.ts' });
}

function authOf(line: string, routerWide: string): string {
  const s = `${routerWide} ${line}`;
  if (/requirePermission\(|\bP\('/.test(s)) return 'staff-permission';
  if (/requireAdmin/.test(s)) return 'admin';
  if (/requireApiKey/.test(s)) return 'api-key';
  if (/optionalAuthenticate/.test(s)) return 'optional';
  if (/authenticate/.test(s)) return 'user';
  return 'public';
}

for (const { prefix, file } of mounts) {
  const full = path.join(SRC, 'routes', file.endsWith('.ts') ? file : `${file}.ts`);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  // Router-wide middleware: `router.use(authenticate, ...)` before routes.
  let routerWide = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const use = line.match(/^\s*\w+\.use\(([^)]*)\)/);
    if (use && !/'\//.test(use[1])) routerWide += ` ${use[1]}`;
    const m = line.match(/^\s*\w+\.(get|post|put|patch|delete)\s*\(\s*'([^']*)'(.*)$/);
    if (!m) continue;
    // Middleware lists can wrap onto following lines; join until the closing paren.
    let rest = m[3];
    let j = i;
    while (!/\)\s*;?\s*$/.test(rest) && j < i + 8 && j + 1 < lines.length) { j++; rest += lines[j]; }
    const sub = m[2] === '/' ? '' : m[2];
    endpoints.push({ method: m[1].toUpperCase(), path: `${prefix}${sub}`, auth: authOf(rest, routerWide), file });
  }
}

endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

if (process.argv.includes('--json')) {
  const byAuth: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  for (const e of endpoints) {
    byAuth[e.auth] = (byAuth[e.auth] ?? 0) + 1;
    const domain = e.path.split('/')[2] ?? '(root)';
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;
  }
  console.log(JSON.stringify({ total: endpoints.length, byAuth, byDomain, endpoints }, null, 2));
} else {
  for (const e of endpoints) console.log(`${e.method.padEnd(6)} ${e.path.padEnd(60)} ${e.auth}`);
  console.log(`\nTOTAL ${endpoints.length}`);
}
