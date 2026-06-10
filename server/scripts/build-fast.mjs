/**
 * Fast Docker build: transpile-only emit via esbuild.
 *
 * `npm run build` (tsc) takes minutes and hundreds of MB of RAM because it
 * type-checks the whole program — on a small droplet it crawls or gets
 * OOM-killed, which looks like a hung `docker build`. Runtime output doesn't
 * need type-checking (that's what CI / local dev is for); it needs faithful
 * JS emit. esbuild does that emit in well under a second with ~50MB RSS.
 *
 * Parity with the old tsc build:
 *   - file-per-file CommonJS into dist/, mirroring src/ structure
 *   - external .js.map sourcemaps (Sentry-readable)
 *   - non-TS files imported at runtime (banks.json, assets/*.png) copied
 *     across, same as tsc's resolveJsonModule emit + the old `cp -r assets`
 *   - src/__tests__ excluded
 *
 * NOT done here: type-checking. Run `npm run build` or `npx tsc --noEmit`
 * locally / in CI before shipping.
 */
import { build } from 'esbuild';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';
const OUT = 'dist';

async function walk(dir, acc = { ts: [], other: [] }) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      await walk(full, acc);
    } else if (entry.name.endsWith('.ts')) {
      if (entry.name.endsWith('.d.ts')) continue;
      acc.ts.push(full);
    } else {
      acc.other.push(full);
    }
  }
  return acc;
}

const started = Date.now();
await rm(OUT, { recursive: true, force: true });

const { ts, other } = await walk(SRC);

await build({
  entryPoints: ts,
  outdir: OUT,
  outbase: SRC,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  supported: {
    // Keep parity with the old tsc CommonJS emit. Native dynamic import()
    // uses ESM resolution at runtime and requires ".js" extensions, so
    // extensionless local imports like import("./foo.service") break in dist.
    'dynamic-import': false,
  },
  sourcemap: true,
  logLevel: 'warning',
});

// Mirror runtime data files (JSON imports, email logo assets, …).
for (const file of other) {
  const dest = path.join(OUT, path.relative(SRC, file));
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(file, dest);
}

console.log(`[build-fast] ${ts.length} TS files + ${other.length} static files → ${OUT} in ${Date.now() - started}ms`);
