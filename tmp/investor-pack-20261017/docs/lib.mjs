// Shared design layer for the investor-pack PDFs: fonts, tokens, components,
// print-ready SVG charts, and the Chromium PDF / pdf.js PNG renderers.
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = '/Users/moe/Downloads/promrkts';
export const WORK = path.join(ROOT, 'tmp/investor-pack-20261017');
export const PACK = path.join(ROOT, 'deliverables/Tazdan_Investor_Pack_2026-10-17');
export const FONTS = path.join(ROOT, 'client/public/fonts');
export const CAP = path.join(WORK, 'capture');
export const SCREENS = path.join(ROOT, 'client/public/app/screens/en-dark');
export const LOGO_WHITE = 'file://' + path.join(ROOT, 'client/public/logo-white.png');
export const LOGO_NAVY = 'file://' + path.join(ROOT, 'client/public/logo-color.png');
export const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

export const C = {
  navy: '#24384F', deep: '#132233', ink: '#15202B', ink2: '#3C4A58', muted: '#66748A', line: '#DDE3EA',
  soft: '#F3F6F9', soft2: '#E8EDF3', green: '#0F7A55', amber: '#8A5A00', red: '#B42318',
  // Validated categorical slots 1-3 (dataviz reference palette, all-pairs safe).
  s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a',
};

const face = (fam, file, w) => `@font-face{font-family:'${fam}';src:url('file://${FONTS}/${file}') format('woff2');font-weight:${w};font-display:block}`;
export const fontCss = [
  ...[400, 500, 600, 700].map(w => face('Inter', `Inter-${w}.woff2`, w)),
  ...[400, 500, 600, 700].map(w => face('Outfit', `Outfit-latin-${w}.woff2`, w)),
].join('\n');

export const PACK_AR = path.join(ROOT, 'deliverables/Tazdan_Investor_Pack_AR_2026-10-17');
const AR_RANGE = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200F,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const LAT_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-200B,U+2012-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD';
export const cairoCss = [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-arabic-${w}.woff2') format('woff2');font-weight:${w};unicode-range:${AR_RANGE};font-display:block}
@font-face{font-family:'Cairo';src:url('file://${FONTS}/Cairo-latin-${w}.woff2') format('woff2');font-weight:${w};unicode-range:${LAT_RANGE};font-display:block}`).join('\n');

export const baseCss = `
${fontCss}
:root{--navy:${C.navy};--deep:${C.deep};--ink:${C.ink};--ink2:${C.ink2};--muted:${C.muted};--line:${C.line};--soft:${C.soft};--soft2:${C.soft2};--green:${C.green};--amber:${C.amber};--red:${C.red}}
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
body{font-family:Inter,sans-serif;font-size:9.4pt;line-height:1.55;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:'tnum' 0}
@page{size:A4;margin:21mm 18mm 19mm 18mm}
.cover{width:210mm;height:297mm;position:relative;overflow:hidden;color:#fff;background:linear-gradient(160deg,#0F1B29 0%,#16283B 48%,#24384F 100%);padding:22mm 20mm 20mm;page-break-after:always;display:flex;flex-direction:column}
.cover .logo{height:9mm;width:auto;align-self:flex-start}
.cover .eyebrow{color:#9FB2C6;margin-top:auto}
.cover h1{font-family:Outfit;font-weight:600;font-size:34pt;line-height:1.08;color:#fff;margin:4mm 0 5mm;letter-spacing:-.015em;max-width:150mm}
.cover .sub{font-size:12.5pt;line-height:1.5;color:#C9D6E3;max-width:140mm;margin:0}
.cover .meta{display:flex;gap:10mm;margin-top:14mm;padding-top:5mm;border-top:.6px solid rgba(255,255,255,.22);font-size:8.4pt;color:#9FB2C6}
.cover .meta b{display:block;color:#fff;font-weight:600;font-size:9pt;margin-bottom:.6mm}
.cover .legal{font-size:7.4pt;color:#7F93A8;margin-top:8mm;max-width:160mm;line-height:1.5}
.cover .ring{position:absolute;right:-48mm;top:30mm;width:150mm;height:150mm;border-radius:50%;border:.7px solid rgba(255,255,255,.07)}
.cover .ring.r2{right:-22mm;top:56mm;width:98mm;height:98mm}
.cover .ring.r3{right:4mm;top:82mm;width:46mm;height:46mm;background:rgba(255,255,255,.035)}
h1.h{font-family:Outfit;font-weight:600;font-size:20pt;line-height:1.15;color:var(--navy);margin:0 0 3.5mm;letter-spacing:-.01em;break-after:avoid}
.section{break-before:page}
.eyebrow{font-size:7.4pt;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:1.5mm}
h2{font-family:Outfit;font-weight:600;font-size:12.6pt;line-height:1.25;margin:6.5mm 0 2.2mm;color:var(--ink);break-after:avoid}
h3{font-size:9.6pt;font-weight:600;margin:4mm 0 1.2mm;color:var(--ink);break-after:avoid}
p{margin:0 0 2.5mm}
ul,ol{margin:0 0 3mm;padding-left:4.6mm}
li{margin:0 0 1.2mm}
li::marker{color:var(--muted)}
.lead{font-size:11pt;line-height:1.55;color:var(--ink2);margin-bottom:4mm}
.muted{color:var(--muted)}
.note{font-size:7.8pt;line-height:1.5;color:var(--muted)}
b,strong{font-weight:600}
a{color:var(--navy);text-decoration:none}
table{width:100%;border-collapse:collapse;font-size:8.5pt;line-height:1.45;margin:2mm 0 4mm}
th{text-align:left;font-weight:600;color:var(--muted);font-size:7.2pt;text-transform:uppercase;letter-spacing:.05em;border-bottom:1.1px solid var(--ink);padding:1.5mm 2mm 1.5mm 0}
td{border-bottom:.5px solid var(--line);padding:1.7mm 2mm 1.7mm 0;vertical-align:top}
td:last-child,th:last-child{padding-right:0}
.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr{break-inside:avoid}
tr.total td{font-weight:600;border-top:1px solid var(--ink);border-bottom:none}
tr.sub td{color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0 5mm}
.kpis.k3{grid-template-columns:repeat(3,1fr)}
.kpis.k2{grid-template-columns:repeat(2,1fr)}
.kpi{background:var(--soft);border-radius:2.4mm;padding:3.2mm 3.6mm 3mm;break-inside:avoid}
.kpi .v{font-family:Outfit;font-size:16.5pt;font-weight:600;color:var(--navy);line-height:1.1;letter-spacing:-.01em}
.kpi .l{font-size:7.6pt;color:var(--muted);margin-top:1.2mm;line-height:1.35}
.callout{border-left:2.2px solid var(--navy);background:var(--soft);padding:3mm 4mm;margin:3mm 0 4mm;border-radius:0 2mm 2mm 0;break-inside:avoid}
.callout p:last-child{margin:0}
.callout.warn{border-color:#C98500;background:#FFF7E6}
.chip{display:inline-block;font-size:6.9pt;font-weight:600;padding:.35mm 1.9mm .45mm;border-radius:10mm;white-space:nowrap;line-height:1.5;letter-spacing:.01em}
.chip.ready{background:#E2F3EB;color:#0B6646}
.chip.partner{background:#FFF0CC;color:#7A4F00}
.chip.off{background:#E9EDF2;color:#3C4A58}
.chip.plan{background:#E5EDF8;color:#1E5296}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.card{border:.6px solid var(--line);border-radius:2.4mm;padding:3.4mm 3.8mm;break-inside:avoid}
.card h3{margin-top:0}
.card p:last-child,.card ul:last-child{margin-bottom:0}
.phones{display:flex;gap:4mm;margin:3mm 0 4mm;justify-content:space-between}
.phone{flex:1;text-align:center;font-size:7.4pt;color:var(--muted);break-inside:avoid}
.phone img{width:100%;border-radius:4.2mm;border:1.6mm solid #0B0F14;display:block;margin-bottom:1.6mm;background:#0B0F14}
figure{margin:3mm 0 4mm;break-inside:avoid}
figcaption{font-size:7.6pt;color:var(--muted);margin-top:1.2mm}
.fig-title{font-size:8.6pt;font-weight:600;margin-bottom:1mm}
.legend{display:flex;gap:4mm;font-size:7.6pt;color:var(--ink2);margin:0 0 1.5mm}
.legend i{display:inline-block;width:2.6mm;height:2.6mm;border-radius:.6mm;margin-right:1.2mm;vertical-align:-.3mm}
.toc{counter-reset:none}
.toc div{display:flex;justify-content:space-between;border-bottom:.5px solid var(--line);padding:2.2mm 0}
.toc div span:first-child{font-weight:500}
.keep{break-inside:avoid}
.two-col{columns:2;column-gap:7mm}
.two-col p,.two-col li{break-inside:avoid}
.num{font-family:Outfit;font-weight:600;color:var(--navy)}
.step{display:grid;grid-template-columns:9mm 1fr;gap:2mm;margin-bottom:2.6mm;break-inside:avoid}
.step .num{font-size:13pt;line-height:1.2}
.rule{height:.6px;background:var(--line);margin:4mm 0}
`;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const chip = (kind, text) => `<span class="chip ${kind}">${text}</span>`;
export const usd = (v, d = 0) => (v < 0 ? '(' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (v < 0 ? ')' : '');
export const usdM = (v, d = 2) => (v < 0 ? '(' : '') + '$' + (Math.abs(v) / 1e6).toFixed(d) + 'M' + (v < 0 ? ')' : '');
export const int = v => Math.round(v).toLocaleString('en-US');
export const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

export function cover({ eyebrow, title, sub, docNo, kind = 'Investor pack' }) {
  return `<section class="cover"><div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
  <img class="logo" src="${LOGO_WHITE}" alt="tazdan">
  <div class="eyebrow">${esc(eyebrow)}</div>
  <h1>${title}</h1>
  <p class="sub">${sub}</p>
  <div class="meta"><div><b>${esc(kind)}</b>${esc(docNo)}</div><div><b>Date</b>October 2026</div><div><b>Status</b>Confidential · for discussion</div></div>
  <div class="legal">Prepared by the founder of Tazdan for prospective investors. This document is not an offer to sell or a solicitation to buy securities. Forecasts are planning estimates, not promises. Licences, banking partners and live payment rails are not yet in place; status labels throughout show what is built, what awaits a partner, and what is switched off in production.</div>
  </section>`;
}

export function page(title, body, extraCss = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${baseCss}${extraCss}</style></head><body>${body}</body></html>`;
}

export const footerTemplate = title => `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:6.6pt;color:#7A8796;padding:0 18mm;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span>Tazdan · ${esc(title)} · Confidential</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

// ---------- SVG charts (print; no hover layer) ----------
const niceMax = v => { if (v <= 0) return 0; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const fmtAxis = (v, unit) => unit === 'm' ? (v === 0 ? '0' : `${v < 0 ? '−' : ''}${+(Math.abs(v) / 1e6).toFixed(2)}`) : unit === 'M' ? (v === 0 ? '0' : `${v < 0 ? '−' : ''}$${+(Math.abs(v) / 1e6).toFixed(2)}M`) : unit === 'k' ? `${(v / 1e3).toFixed(0)}k` : String(v);

export function groupedBars({ categories, series, width = 640, height = 230, unit = 'M', label = true, labelFmt, font = 'Inter' }) {
  const padL = 44, padR = 8, padT = 10, padB = 24;
  const all = series.flatMap(s => s.values);
  const hi = niceMax(Math.max(0, ...all)), lo = -niceMax(Math.max(0, -Math.min(0, ...all)));
  const ticks = []; const step = (hi - lo) / 4 || 1; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const W = width - padL - padR, H = height - padT - padB;
  const y = v => padT + H * (hi - v) / (hi - lo || 1);
  const gw = W / categories.length, bw = Math.min(22, (gw - 14) / series.length - 2);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" direction="ltr" style="display:block;font-family:${font};direction:ltr">`;
  for (const t of ticks) s += `<line x1="${padL}" x2="${width - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#9AA6B2' : '#E6EAEF'}" stroke-width="${t === 0 ? 1 : .7}"/><text x="${padL - 6}" y="${y(t) + 3}" font-size="8.5" fill="#66748A" text-anchor="end">${fmtAxis(t, unit)}</text>`;
  categories.forEach((c, i) => {
    const gx = padL + gw * i + (gw - (bw + 2) * series.length) / 2;
    series.forEach((se, j) => {
      const v = se.values[i], x = gx + j * (bw + 2), y0 = y(0), y1 = y(v), h = Math.max(.8, Math.abs(y1 - y0)), top = Math.min(y0, y1), r = Math.min(3, bw / 2, h);
      s += v >= 0
        ? `<path d="M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y0} Z" fill="${se.color}"/>`
        : `<path d="M${x},${y0} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + bw - r} Q${x + bw},${top + h} ${x + bw},${top + h - r} V${y0} Z" fill="${se.color}"/>`;
      if (label && se.label !== false && (i === categories.length - 1)) s += `<text x="${x + bw / 2}" y="${v >= 0 ? y1 - 3 : y1 + 9}" font-size="7.5" fill="#3C4A58" text-anchor="middle">${(labelFmt || (v => unit === 'm' ? `${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(2)}` : unit === 'M' ? `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1e6).toFixed(2)}M` : fmtAxis(v, unit)))(v)}</text>`;
    });
    s += `<text x="${padL + gw * i + gw / 2}" y="${height - 8}" font-size="8.5" fill="#3C4A58" text-anchor="middle">${esc(c)}</text>`;
  });
  return s + '</svg>';
}

export function lines({ xLabels, series, width = 640, height = 220, unit = 'M', every = 12, font = 'Inter' }) {
  const padL = 44, padR = 54, padT = 10, padB = 22;
  const all = series.flatMap(s => s.values);
  const hi = niceMax(Math.max(0, ...all)), lo = -niceMax(Math.max(0, -Math.min(0, ...all)));
  const step = (hi - lo) / 4 || 1, ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const W = width - padL - padR, H = height - padT - padB, n = xLabels.length;
  const x = i => padL + W * i / (n - 1), y = v => padT + H * (hi - v) / (hi - lo || 1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" direction="ltr" style="display:block;font-family:${font};direction:ltr">`;
  for (const t of ticks) s += `<line x1="${padL}" x2="${width - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#9AA6B2' : '#E6EAEF'}" stroke-width="${t === 0 ? 1 : .7}"/><text x="${padL - 6}" y="${y(t) + 3}" font-size="8.5" fill="#66748A" text-anchor="end">${fmtAxis(t, unit)}</text>`;
  xLabels.forEach((l, i) => { if ((i + 1) % every === 0) s += `<text x="${x(i)}" y="${height - 6}" font-size="8.5" fill="#3C4A58" text-anchor="middle">${esc(l)}</text>`; });
  const ends = [];
  for (const se of series) {
    s += `<path d="${se.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    ends.push({ y: y(se.values.at(-1)), name: se.name, color: se.color, xe: x(n - 1) });
  }
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 10) ends[i].y = ends[i - 1].y + 10;
  for (const e of ends) s += `<circle cx="${e.xe}" cy="${e.y}" r="0"/><text x="${e.xe + 5}" y="${e.y + 3}" font-size="8" fill="#3C4A58">${esc(e.name)}</text>`;
  return s + '</svg>';
}

export const legend = items => `<div class="legend">${items.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`;

// ---------- renderers ----------
let browserP;
export async function browser() {
  if (!browserP) { const { chromium } = await import(path.join(WORK, 'node_modules/playwright-core/index.mjs')); browserP = chromium.launch({ executablePath: EXE, headless: true }); }
  return browserP;
}

export async function renderPdf(name, html, outPdf, { footer = true, title = name, stamp = true, brand = 'Tazdan' } = {}) {
  const htmlFile = path.join(WORK, 'docs/out', name + '.html');
  await fs.mkdir(path.dirname(htmlFile), { recursive: true });
  await fs.mkdir(path.dirname(outPdf), { recursive: true });
  await fs.writeFile(htmlFile, html);
  const b = await browser(); const ctx = await b.newContext(); const pg = await ctx.newPage();
  const load = async css => { await pg.goto('file://' + htmlFile, { waitUntil: 'load' }); if (css) await pg.addStyleTag({ content: css }); await pg.evaluate(() => document.fonts.ready); };
  if (!footer) { await load(); await pg.pdf({ path: outPdf, preferCSSPageSize: true, printBackground: true }); await ctx.close(); return outPdf; }
  // Cover and body print separately: Chromium would otherwise shrink the full-bleed cover to the body margins.
  await load('@page{margin:0;@bottom-left{content:none}@bottom-right{content:none}} body>*:not(.cover){display:none!important}');
  const coverPdf = await pg.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: '1' });
  await load('.cover{display:none!important}');
  // Layout check: print a throwaway copy with invisible end-of-section markers and find where each lands.
  await pg.evaluate(() => { const mk = i => { const m = document.createElement('span'); m.textContent = `ENDMARK${i}`; m.style.cssText = 'font-size:2px;color:#fff;display:inline'; return m; };
    const secs = [...document.querySelectorAll('.section')]; secs.forEach((s, i) => s.parentNode.insertBefore(mk(i), s)); document.body.appendChild(mk(secs.length)); });
  const diag = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
  await checkLayout(name, diag);
  await load('.cover{display:none!important}');
  const bodyPdf = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
  await ctx.close();
  const { PDFDocument, StandardFonts, rgb } = await import(path.join(WORK, 'node_modules/pdf-lib/cjs/index.js')).then(m => m.default || m);
  const outDoc = await PDFDocument.create(); outDoc.setTitle(brand + ' · ' + title); outDoc.setAuthor('Tazdan'); outDoc.setCreator('Tazdan investor pack');
  const cov = await PDFDocument.load(coverPdf), bod = await PDFDocument.load(bodyPdf);
  const [c0] = await outDoc.copyPages(cov, [0]); outDoc.addPage(c0);
  for (const pgx of await outDoc.copyPages(bod, bod.getPageIndices())) outDoc.addPage(pgx);
  const font = await outDoc.embedFont(StandardFonts.Helvetica), total = outDoc.getPageCount(), col = rgb(0.48, 0.53, 0.59);
  // Paint white paper under each body page: Chromium leaves @page margins transparent, which some viewers show as black.
  const { PDFArray } = await import(path.join(WORK, 'node_modules/pdf-lib/cjs/index.js')).then(m => m.default || m);
  outDoc.getPages().forEach((p, i) => { if (!i) return; const { width: w, height: h } = p.getSize();
    const paper = outDoc.context.register(outDoc.context.flateStream(`q 1 1 1 rg 0 0 ${w} ${h} re f Q`));
    p.node.normalize(); const contents = p.node.Contents(); if (contents instanceof PDFArray) contents.insert(0, paper); else p.node.set(outDoc.context.obj('Contents'), outDoc.context.obj([paper, contents])); });
  if (stamp) outDoc.getPages().forEach((p, i) => { if (!i) return; const { width } = p.getSize(); const left = `Tazdan · ${title} · Confidential`, right = `${i + 1} / ${total}`;
    p.drawText(left, { x: 51, y: 26, size: 6.8, font, color: col }); p.drawText(right, { x: width - 51 - font.widthOfTextAtSize(right, 6.8), y: 26, size: 6.8, font, color: col }); });
  await fs.writeFile(outPdf, await outDoc.save());
  return outPdf;
}

// Page previews through macOS's PDF renderer (sips renders page 1 only, so split first).
export async function pdfToPngs(pdfPath, outPrefix, { pages, width = 1100 } = {}) {
  const { PDFDocument } = await import(path.join(WORK, 'node_modules/pdf-lib/cjs/index.js')).then(m => m.default || m);
  const { execFileSync } = await import('node:child_process');
  const src = await PDFDocument.load(await fs.readFile(pdfPath)); const n = src.getPageCount(); const files = [];
  for (let i = 0; i < n; i++) {
    if (pages && !pages.includes(i + 1)) continue;
    const one = await PDFDocument.create(); const [pp] = await one.copyPages(src, [i]); one.addPage(pp);
    const tmp = `${outPrefix}-p${String(i + 1).padStart(2, '0')}.pdf`, png = tmp.replace(/\.pdf$/, '.png');
    await fs.writeFile(tmp, await one.save());
    execFileSync('/usr/bin/sips', ['-s', 'format', 'png', '--resampleWidth', String(width), tmp, '--out', png], { stdio: 'ignore' });
    await fs.unlink(tmp); files.push(png);
  }
  return { numPages: n, files };
}

async function checkLayout(name, buf) {
  const pdfjs = await import(path.join(WORK, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).catch(() => import(path.join(WORK, 'node_modules/pdfjs-dist/build/pdf.mjs')));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise; const ends = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n); const [, , , H] = pg.view; const tc = await pg.getTextContent();
    for (const it of tc.items) { const m = /ENDMARK(\d+)/.exec(it.str); if (m) ends[+m[1]] = { page: n, fill: (H - 54 - it.transform[5]) / (H - 54 - 60) }; }
  }
  let start = 1;
  ends.forEach((e, i) => { if (!e) return; const pages = e.page - start + 1;
    if (pages > 1 && e.fill < 0.3) console.log(`  ! ${name} section ${i}: ${pages} pages, last page only ${(e.fill * 100).toFixed(0)}% full (page ${e.page})`);
    else if (process.env.LAYOUT) console.log(`    ${name} section ${i}: ${pages} page(s), last ${(e.fill * 100).toFixed(0)}% full`);
    start = e.page + 1; });
}
