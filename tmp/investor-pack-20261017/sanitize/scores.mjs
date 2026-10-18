import fs from 'node:fs/promises'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../node_modules/sharp'); const SRC = process.env.SRC; const HERE = path.dirname(new URL(import.meta.url).pathname);
const T = { x: 210, y: 232, w: 300, h: 58 }, HEADER = 186, A = '/Users/moe/Downloads/promrkts/client/public/app/loops/en-dark/';
const ref = await sharp(path.join(HERE, 'ref.png')).extract({ left: T.x, top: T.y, width: T.w, height: T.h }).greyscale().raw().toBuffer();
const norm = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1; return a.map(v => (v - m) / sd); };
for (const c of ['messages', 'chat-payment']) {
  const tmp = path.join(HERE, 's-' + c); await fs.rm(tmp, { recursive: true, force: true }); await fs.mkdir(tmp);
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-loglevel', 'error', '-i', (SRC ? path.join(HERE, c + '.mp4') : A + c + '.mp4'), '-vsync', '0', path.join(tmp, '%05d.png')]);
  const out = [];
  for (const f of (await fs.readdir(tmp)).sort()) {
    const { data, info } = await sharp(path.join(tmp, f)).greyscale().raw().toBuffer({ resolveWithObject: true }); const W = info.width; let best = -1, by = 0;
    for (let y0 = HEADER - T.h + 6; y0 <= 330; y0++) { const a = [], b = [];
      for (let yy = 0; yy < T.h; yy += 2) { const y = y0 + yy; if (y < HEADER) continue; for (let xx = 0; xx < T.w; xx += 3) { a.push(data[y * W + T.x + xx]); b.push(ref[yy * T.w + xx]); } }
      if (a.length < 200) continue; const na = norm(a), nb = norm(b); const r = na.reduce((s, v, i) => s + v * nb[i], 0) / na.length; if (r > best) { best = r; by = y0; } }
    out.push([+f.slice(0, 5), +best.toFixed(2), by]);
  }
  await fs.writeFile(path.join(HERE, 'scores-' + c + '.json'), JSON.stringify(out));
  const bins = {}; for (const [, r] of out) { const k = (Math.floor(r * 10) / 10).toFixed(1); bins[k] = (bins[k] || 0) + 1; }
  console.log(c, JSON.stringify(bins)); console.log('  mid-range frames (0.45-0.8):', JSON.stringify(out.filter(o => o[1] >= 0.45 && o[1] < 0.8).slice(0, 40)));
}
