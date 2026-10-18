// Removes the chat thread's "End-to-end encrypted" pill from the demo clips and the
// chat still. The app shows this banner, but the claim is not substantiated, so the
// investor material must not display it. Each frame is searched for the pill at any
// vertical position below the header (it scrolls), then painted over with the
// background sampled beside it. Source files are left untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../node_modules/sharp');

const ROOT = '/Users/moe/Downloads/promrkts', HERE = path.dirname(new URL(import.meta.url).pathname);
const FF = '/opt/homebrew/bin/ffmpeg';
// Per-locale geometry in 720-wide frames: pill template box, header bottom, and the lowest row a
// scrim-dimmed pill can match from (just above its usual position).
const AR = process.env.LOCALE === 'ar';
const T = AR ? { x: 212, y: 257, w: 296, h: 70 } : { x: 210, y: 232, w: 300, h: 58 };
const HEADER = AR ? 212 : 186, DIM_MIN_Y = AR ? 225 : 200;
const REF = path.join(HERE, AR ? 'ar/ref.png' : 'ref.png'), OUTDIR = AR ? path.join(HERE, 'ar') : HERE, VARIANT = AR ? 'ar-dark' : 'en-dark';

const ref = await sharp(REF).extract({ left: T.x, top: T.y, width: T.w, height: T.h }).greyscale().raw().toBuffer();

async function clean(rgb, W, H) {
  const s = W / 720, tw = Math.round(T.w * s), th = Math.round(T.h * s), tx = Math.round(T.x * s), head = Math.round(HEADER * s);
  const tpl = s === 1 ? ref : await sharp(ref, { raw: { width: T.w, height: T.h, channels: 1 } }).resize(tw, th).raw().toBuffer();
  const lum = (x, y) => { const i = (y * W + x) * 3; return (rgb[i] * 0.299 + rgb[i + 1] * 0.587 + rgb[i + 2] * 0.114); };
  // Contrast-normalised correlation, so the pill is still found when a sheet's scrim dims it.
  const norm = a => { const m = a.reduce((q, v) => q + v, 0) / a.length; const sd = Math.sqrt(a.reduce((q, v) => q + (v - m) ** 2, 0) / a.length) || 1; return a.map(v => (v - m) / sd); };
  let best = { d: -1, y: -1 };
  for (let y0 = head - th + 6; y0 <= Math.round((T.y + 100) * s); y0++) {
    const a = [], b = [];
    for (let yy = 0; yy < th; yy += 2) { const y = y0 + yy; if (y < head || y >= H) continue;
      for (let xx = 0; xx < tw; xx += 3) { a.push(lum(tx + xx, y)); b.push(tpl[yy * tw + xx]); } }
    if (a.length < 200) continue;
    const na = norm(a), nb = norm(b), r = na.reduce((q, v, k) => q + v * nb[k], 0) / na.length;
    if (r > best.d) best = { d: r, y: y0 };
  }
  // Visible pills score 0.9+; a pill dimmed by a sheet's scrim scores ~0.5 at its usual row. Partial
  // matches straddling the header edge (y < 200) also reach ~0.5, so they need the higher bar.
  if (!(best.d >= 0.6 || (best.d >= 0.48 && best.y >= Math.round(DIM_MIN_Y * s)))) return { hit: false, d: best.d };
  // Paint the pill area with the background just left of it (follows dimming when a sheet is open).
  const sy = Math.min(H - 1, Math.max(head, best.y + Math.round(th / 2))), si = (sy * W + Math.round(150 * s)) * 3;
  const bg = [rgb[si], rgb[si + 1], rgb[si + 2]];
  for (let y = Math.max(head, best.y - 3); y < Math.min(H, best.y + th + 3); y++)
    for (let x = tx - 4; x < tx + tw + 4; x++) { const i = (y * W + x) * 3; rgb[i] = bg[0]; rgb[i + 1] = bg[1]; rgb[i + 2] = bg[2]; }
  return { hit: true, d: best.d, y: best.y };
}

async function cleanClip(src, out) {
  const tmp = path.join(HERE, 'frames-' + path.basename(src, '.mp4')); await fs.rm(tmp, { recursive: true, force: true }); await fs.mkdir(tmp, { recursive: true });
  execFileSync(FF, ['-loglevel', 'error', '-i', src, '-vsync', '0', path.join(tmp, '%05d.png')]);
  const files = (await fs.readdir(tmp)).filter(f => f.endsWith('.png')).sort(); let hits = 0, worstMiss = -1;
  for (const f of files) {
    const p = path.join(tmp, f); const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const r = await clean(data, info.width, info.height);
    if (r.hit) { hits++; await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(p + '.c.png'); await fs.rename(p + '.c.png', p); }
    else worstMiss = Math.max(worstMiss, r.d);
  }
  execFileSync(FF, ['-loglevel', 'error', '-y', '-framerate', '30', '-i', path.join(tmp, '%05d.png'), '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  await fs.rm(tmp, { recursive: true, force: true });
  console.log(path.basename(src), `${hits}/${files.length} frames cleaned; highest non-match correlation ${worstMiss.toFixed(2)}`);
}

const A = path.join(ROOT, 'client/public/app');
await cleanClip(path.join(A, `loops/${VARIANT}/messages.mp4`), path.join(OUTDIR, 'messages.mp4'));
await cleanClip(path.join(A, `loops/${VARIANT}/chat-payment.mp4`), path.join(OUTDIR, 'chat-payment.mp4'));
// The chat stills (P2P escrow thread, conversation list) carry no banner; they are used unchanged.
