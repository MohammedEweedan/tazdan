import fs from 'node:fs/promises'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../node_modules/sharp'); const HERE = path.dirname(new URL(import.meta.url).pathname);
const AR = process.env.LOCALE === 'ar'; const T = AR ? { x: 212, y: 257, w: 296, h: 70 } : { x: 210, y: 232, w: 300, h: 58 }, HEADER = AR ? 212 : 186;
const ref = await sharp(path.join(HERE, AR ? 'ar/ref.png' : 'ref.png')).extract({ left: T.x, top: T.y, width: T.w, height: T.h }).greyscale().raw().toBuffer();
// Contrast-normalised match so a dimmed pill (under a sheet's scrim) is still found.
const norm = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1; return a.map(v => (v - m) / sd); };
for (const c of ['messages', 'chat-payment']) {
  const tmp = path.join(HERE, 'v-' + c); await fs.rm(tmp, { recursive: true, force: true }); await fs.mkdir(tmp);
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-loglevel', 'error', '-i', path.join(HERE, AR ? 'ar' : '', c + '.mp4'), '-vsync', '0', path.join(tmp, '%05d.png')]);
  const files = (await fs.readdir(tmp)).sort(); const sus = [];
  for (const f of files) {
    const { data, info } = await sharp(path.join(tmp, f)).greyscale().raw().toBuffer({ resolveWithObject: true }); const W = info.width;
    let best = -1, by = 0;
    for (let y0 = HEADER; y0 <= T.y + 100; y0 += 2) { const a = [], b = [];
      for (let yy = 0; yy < T.h; yy += 3) for (let xx = 0; xx < T.w; xx += 4) { a.push(data[(y0 + yy) * W + T.x + xx]); b.push(ref[yy * T.w + xx]); }
      const na = norm(a), nb = norm(b); const r = na.reduce((s, v, i) => s + v * nb[i], 0) / na.length; if (r > best) { best = r; by = y0; } }
    if (best > 0.5) sus.push([f, best.toFixed(2), by]);
  }
  console.log(c, files.length, 'frames; suspicious (corr>0.5):', sus.length, JSON.stringify(sus.slice(0, 12)));
  await fs.rm(tmp, { recursive: true, force: true });
}
