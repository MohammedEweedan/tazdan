// Builds 06_Product_Demo/Tazdan_Product_Demo.mp4 from the recorded app clips:
// a 1920x1080 stage per feature (phone left, caption right, chapter rail below),
// joined with short crossfades. Writes segments.json for the feature index.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { WORK, PACK, PACK_AR, LOGO_WHITE, fontCss, cairoCss, browser, esc } from './lib.mjs';
// EDITION=ar builds the Arabic film: Arabic-UI clips, Arabic captions, mirrored layout.
const AR = process.env.EDITION === 'ar';
const { features, chapters, statusCounts } = AR ? await import('./ar/data_ar.mjs') : await import('./data.mjs');

const FF = '/opt/homebrew/bin/ffmpeg', FP = '/opt/homebrew/bin/ffprobe';
const OUT = path.join(WORK, AR ? 'video-ar' : 'video'); await fs.mkdir(OUT, { recursive: true });
const FINAL = AR ? path.join(PACK_AR, '06_Product_Demo/Tazdan_Product_Demo_AR.mp4') : path.join(PACK, '06_Product_Demo/Tazdan_Product_Demo.mp4');
await fs.mkdir(path.dirname(FINAL), { recursive: true });
const XF = 0.4;                                    // crossfade seconds
const SCR = { x: AR ? 1121 : 402, y: 84, w: 397, h: 860 }, BZ = 14, RAD = 62;
const chipCol = { ready: ['#163F31', '#7FE0B5'], partner: ['#4A3610', '#FFCF70'], off: ['#2B333D', '#C3CCD6'] };

const stageCss = `${fontCss}
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:Inter;color:#fff;background:transparent}
.bg{position:absolute;inset:0;background:radial-gradient(1200px 900px at 28% 46%,#21364D 0%,#15263A 48%,#0D1826 100%)}
.glow{position:absolute;left:${SCR.x - 140}px;top:${SCR.y - 40}px;width:${SCR.w + 280}px;height:${SCR.h + 80}px;border-radius:50%;background:radial-gradient(closest-side,rgba(99,140,190,.22),rgba(99,140,190,0));}
.shadow{position:absolute;left:${SCR.x - BZ}px;top:${SCR.y - BZ}px;width:${SCR.w + 2 * BZ}px;height:${SCR.h + 2 * BZ}px;border-radius:${RAD}px;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.08)}
.logo{position:absolute;right:120px;top:84px;height:34px}
.copy{position:absolute;left:960px;top:0;bottom:0;width:820px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-size:21px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8FA6BE;margin-bottom:26px}
h1{font-family:Outfit;font-weight:600;font-size:76px;line-height:1.04;letter-spacing:-.015em;margin-bottom:28px}
p{font-size:31px;line-height:1.45;color:#C7D4E1;max-width:780px}
.chip{display:inline-block;margin-top:40px;font-size:22px;font-weight:600;padding:9px 22px 10px;border-radius:40px;align-self:flex-start}
.rail{position:absolute;left:120px;right:120px;bottom:52px;display:flex;gap:12px}
.rail div{flex:1;font-size:15px;font-weight:500;color:#5F7690;padding-top:14px;border-top:3px solid #2A3E55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rail div.done{border-top-color:#58779A;color:#7F97B1}
.rail div.on{border-top-color:#fff;color:#fff}
.foot{position:absolute;left:960px;bottom:128px;font-size:17px;color:#7890A9;letter-spacing:.02em}
.card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 200px}
.card .logo2{height:58px;align-self:flex-start;margin-bottom:64px}
.card h1{font-size:104px;margin-bottom:30px}
.card p{font-size:34px;max-width:1240px}
.stats{display:flex;gap:28px;margin-top:56px}
.stat{background:rgba(255,255,255,.06);border-radius:22px;padding:26px 34px;min-width:250px}
.stat b{display:block;font-family:Outfit;font-size:60px;font-weight:600;line-height:1}
.stat span{font-size:21px;color:#9FB2C6}
.disc{position:absolute;left:200px;bottom:90px;font-size:20px;color:#7890A9;max-width:1300px;line-height:1.5}
${AR ? `${cairoCss}
body,h1,.stat b{font-family:Cairo}
body{direction:rtl}
.copy{left:150px;width:850px}
.eyebrow{letter-spacing:0;text-transform:none;font-size:25px}
h1{font-weight:700;font-size:70px;line-height:1.25;letter-spacing:0}
p{font-size:30px;line-height:1.75}
.logo{right:auto;left:120px}
.foot{left:auto;right:920px;letter-spacing:0;font-size:19px}
.rail{direction:rtl}.rail div{font-size:17px}
.card h1{font-size:96px;line-height:1.2}
.stat span{font-size:22px;line-height:1.5}
.disc{left:auto;right:200px;font-size:21px;line-height:1.7}` : ''}
`;

const html = body => `<!doctype html><html><head><meta charset="utf-8"><style>${stageCss}</style></head><body>${body}</body></html>`;
const rail = ch => `<div class="rail">${chapters.map((c, i) => `<div class="${i === ch ? 'on' : i < ch ? 'done' : ''}">${String(i + 1).padStart(2, '0')} ${esc(c)}</div>`).join('')}</div>`;

const b = await browser(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const pg = await ctx.newPage();
async function shot(body, file, transparent = false) {
  // Navigate to a file so file:// fonts and the logo load (setContent runs on about:blank).
  const f = path.join(OUT, 'stage.html'); await fs.writeFile(f, html(body));
  await pg.goto('file://' + f, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  if (await pg.evaluate(() => [...document.images].some(i => !i.naturalWidth))) throw new Error('image failed to load in ' + file);
  const ok = await pg.evaluate(async ar => { const fs = ar ? ['700 40px Cairo', '400 30px Cairo'] : ['600 40px Outfit', '400 30px Inter']; await Promise.all(fs.map(f => document.fonts.load(f, ar ? 'تزدان abc' : 'abc'))); return fs.every(f => document.fonts.check(f, ar ? 'تزدان' : 'abc')); }, AR);
  if (!ok) throw new Error('brand fonts not loaded');
  await pg.screenshot({ path: file, omitBackground: transparent });
}

// Bezel: transparent except the phone frame; its inner corners mask the clip's square corners.
await shot(`<div style="position:absolute;left:${SCR.x - BZ}px;top:${SCR.y - BZ}px;width:${SCR.w + 2 * BZ}px;height:${SCR.h + 2 * BZ}px;border:${BZ}px solid #06090D;border-radius:${RAD}px"></div>`, path.join(OUT, 'bezel.png'), true);

const probe = f => +execFileSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const segs = [];
const encode = (args, out) => execFileSync(FF, ['-loglevel', 'error', '-y', ...args, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-an', out]);

// Intro
const L = AR ? {
  eb: 'جولة في المنتج · أكتوبر 2026', h: 'تطبيق واحد للمال<br>في ليبيا وخارجها.', p: `المحافظ والمدفوعات والمراسلة والصرف والادخار والتحويلات الدولية ودفعات الأعمال. ${features.length} ميزة في نحو ثلاث دقائق ونصف.`,
  disc: 'سُجّل على تطبيق تزدان بعميل وأرصدة وبيانات سوق افتراضية، ولا تتحرك أي أموال حقيقية. لكل ميزة حالتها: مكتملة، أو بانتظار شريك، أو معطّلة في الإنتاج.',
  foot: 'جولة محاكاة · عميل وبيانات افتراضية', oeb: 'ما شاهدته', oh: 'مكتمل، وجاهز<br>لشركائه.',
  s1: 'مكتملة وتعمل اليوم', s2: 'مكتملة، بانتظار مصرف<br>أو ترخيص أو شريك صرف', s3: 'مكتملة، ومعطّلة<br>في الإنتاج',
  op: 'لم يُعرض هنا: لوحة التحكم التشغيلية للموظفين (ويب) للامتثال والخزينة والمطابقة والاعتمادات. التفاصيل في حزمة المستثمر.',
} : {
  eb: 'Product walkthrough · October 2026', h: 'One app for money<br>in Libya and beyond.', p: `Wallets, payments, messaging, FX, savings, cross-border transfers and business payouts. ${features.length} features in about three minutes.`,
  disc: 'Recorded on the Tazdan app with a fictional customer, balances and market data. No real money moves. Each feature carries a status: built, waiting on a partner, or switched off in production.',
  foot: 'Simulated walkthrough · fictional customer and data', oeb: 'What you saw', oh: 'Built, and ready<br>for its partners.',
  s1: 'built and usable today', s2: 'built, waiting on a bank,<br>licence or payout partner', s3: 'built, switched off<br>in production',
  op: 'Not shown: the staff Control Cockpit (web) for compliance, treasury, reconciliation and approvals. See the investor pack for detail.',
};
await shot(`<div class="bg"></div><div class="card"><img class="logo2" src="${LOGO_WHITE}"><div class="eyebrow">${L.eb}</div><h1>${L.h}</h1><p>${L.p}</p></div><div class="disc">${L.disc}</div>`, path.join(OUT, 'intro.png'));
encode(['-loop', '1', '-t', '6', '-i', path.join(OUT, 'intro.png'), '-vf', 'fps=30,format=yuv420p'], path.join(OUT, 'seg_intro.mp4'));
segs.push({ file: path.join(OUT, 'seg_intro.mp4'), dur: 6, id: 'intro' });

for (const [i, f] of features.entries()) {
  const [bgc, fgc] = chipCol[f.kind];
  const bgFile = path.join(OUT, `bg_${f.id}.png`);
  await shot(`<div class="bg"></div><div class="glow"></div><div class="shadow"></div><img class="logo" src="${LOGO_WHITE}"><div class="foot">${L.foot}</div>
    <div class="copy"><div class="eyebrow">${String(f.ch + 1).padStart(2, '0')} · ${esc(chapters[f.ch])}</div><h1>${esc(f.title)}</h1><p>${esc(f.desc)}</p><span class="chip" style="background:${bgc};color:${fgc}">${esc(f.status)}</span></div>${rail(f.ch)}`, bgFile);
  const src = probe(f.src);
  // Long flows play slightly faster (max 1.4x) so each segment stays near ten seconds; short screens hold their last frame.
  let speed = 1, play = src;
  if (f.max) play = Math.min(src, f.max);
  else if (src > 10.5) { speed = Math.min(1.4, src / 10.5); play = src / speed; }
  const hold = Math.max(0, 5.6 - play), dur = +(play + hold).toFixed(3);
  const out = path.join(OUT, `seg_${String(i).padStart(2, '0')}_${f.id}.mp4`);
  encode(['-loop', '1', '-t', String(dur), '-i', bgFile, '-i', f.src, '-loop', '1', '-t', String(dur), '-i', path.join(OUT, 'bezel.png'),
    '-filter_complex', `[1:v]trim=0:${(play * speed).toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=30,scale=${SCR.w}:${SCR.h}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}[c];[0:v][c]overlay=${SCR.x}:${SCR.y}:shortest=0[a];[a][2:v]overlay=0:0,format=yuv420p`,
    '-t', String(dur)], out);
  segs.push({ file: out, dur, id: f.id, speed: +speed.toFixed(2) });
  console.log(f.id, dur, speed.toFixed(2));
}

// Outro
await shot(`<div class="bg"></div><div class="card"><img class="logo2" src="${LOGO_WHITE}"><div class="eyebrow">${L.oeb}</div><h1>${L.oh}</h1>
  <div class="stats"><div class="stat"><b>${statusCounts.ready}</b><span>${L.s1}</span></div><div class="stat"><b>${statusCounts.partner}</b><span>${L.s2}</span></div><div class="stat"><b>${statusCounts.off}</b><span>${L.s3}</span></div></div>
  <p style="margin-top:48px;font-size:28px">${L.op}</p></div>`, path.join(OUT, 'outro.png'));
encode(['-loop', '1', '-t', '7', '-i', path.join(OUT, 'outro.png'), '-vf', 'fps=30,format=yuv420p'], path.join(OUT, 'seg_outro.mp4'));
segs.push({ file: path.join(OUT, 'seg_outro.mp4'), dur: 7, id: 'outro' });
await ctx.close(); await b.close();

// Crossfade chain
const inputs = segs.flatMap(s => ['-i', s.file]);
let chain = '', last = '[0:v]', t = 0;
segs.forEach((s, k) => {
  if (k === 0) { t = s.dur; return; }
  const off = (t - XF).toFixed(3), lab = `[x${k}]`;
  chain += `${last}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${off}${k === segs.length - 1 ? ',format=yuv420p' : ''}${lab};`;
  last = lab; t = t + s.dur - XF;
});
execFileSync(FF, ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', chain.slice(0, -1), '-map', last, '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', FINAL], { maxBuffer: 1 << 26 });

// Timestamps for the index: each segment starts where the previous crossfade begins.
let at = 0; const index = segs.map((s, k) => { const start = k ? at - XF : 0; at = (k ? at - XF : 0) + s.dur; return { id: s.id, start: +Math.max(0, start).toFixed(2), dur: s.dur, speed: s.speed || 1 }; });
await fs.writeFile(path.join(OUT, 'segments.json'), JSON.stringify({ total: probe(FINAL), index }, null, 2));
console.log('final', FINAL, probe(FINAL));
