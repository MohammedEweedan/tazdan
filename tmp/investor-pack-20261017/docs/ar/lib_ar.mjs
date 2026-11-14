// Arabic edition design layer: right-to-left overrides on the shared stylesheet, Cairo type,
// an Arabic cover, CSS page-margin footers (pdf-lib cannot shape Arabic) and number helpers.
import { baseCss, cairoCss, esc, LOGO_WHITE } from '../lib.mjs';

export const arCss = `
${cairoCss}
html{direction:rtl}
body{font-family:Cairo,sans-serif;font-size:9.8pt;line-height:1.75}
h1.h,h2,h3,.kpi .v,.cover h1,.num,.cover .meta b{font-family:Cairo;letter-spacing:0}
h1.h{font-weight:700;font-size:19pt;line-height:1.4;margin-bottom:3mm}
h2{font-weight:700;font-size:12.4pt;line-height:1.5}
h3{font-weight:700}
.lead{font-size:10.8pt;line-height:1.8}
.eyebrow,.cover .eyebrow{letter-spacing:0;text-transform:none;font-size:8.8pt}
table{font-size:8.6pt;line-height:1.6}
th{letter-spacing:0;text-transform:none;font-size:8pt;text-align:right;padding:1.5mm 0 1.5mm 2mm}
td{padding:1.6mm 0 1.6mm 2mm}
td:last-child,th:last-child{padding-left:0}
.n,th.n{text-align:left}
ul,ol{padding-left:0;padding-right:4.8mm}
.callout{border-left:none;border-right:2.2px solid var(--navy);border-radius:2mm 0 0 2mm}
.callout.warn{border-right-color:#C98500}
.kpi .v{font-weight:700;font-size:12.6pt;line-height:1.4}
.tight td{padding-top:1mm;padding-bottom:1mm;line-height:1.5}
.kpi .l{font-size:7.9pt;line-height:1.5}
.chip{letter-spacing:0;font-size:7.3pt;line-height:1.6}
.legend i{margin-right:0;margin-left:1.2mm}
.note{font-size:7.9pt;line-height:1.65}
.cover h1{font-weight:700;font-size:31pt;line-height:1.3;max-width:160mm}
.cover .sub{font-size:12pt;line-height:1.75}
.cover .legal{line-height:1.7}
.cover .logo{align-self:flex-start}
.cover .ring{right:auto;left:-48mm}.cover .ring.r2{right:auto;left:-22mm}.cover .ring.r3{right:auto;left:4mm}
bdi{unicode-bidi:isolate}
`;

export const footerCss = title => `@page{@bottom-right{content:"تزدان · ${title.replace(/"/g, '')} · سري";font-family:Cairo;font-size:7pt;color:#7A8796}@bottom-left{content:counter(page);font-family:Cairo;font-size:7pt;color:#7A8796}}`;

export function coverAr({ eyebrow, title, sub, docNo, kind = 'حزمة المستثمر' }) {
  return `<section class="cover"><div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
  <img class="logo" src="${LOGO_WHITE}" alt="tazdan">
  <div class="eyebrow">${esc(eyebrow)}</div>
  <h1>${title}</h1>
  <p class="sub">${sub}</p>
  <div class="meta"><div><b>${esc(kind)}</b>${esc(docNo)}</div><div><b>التاريخ</b>أكتوبر 2026</div><div><b>الحالة</b>سري · للنقاش</div></div>
  <div class="legal">أعدّه مؤسس تزدان للمستثمرين المحتملين. هذا المستند ليس عرضًا لبيع أوراق مالية ولا دعوة لشرائها. التوقعات تقديرات تخطيطية وليست وعودًا. التراخيص والشراكات المصرفية وقنوات الدفع الحية غير قائمة بعد، وتبيّن تسميات الحالة في كل المستندات ما هو مكتمل، وما ينتظر شريكًا، وما هو معطّل في الإنتاج.</div>
  </section>`;
}

export function pageAr(title, body, extraCss = '') {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${baseCss}${arCss}${footerCss(title)}${extraCss}</style></head><body>${body}</body></html>`;
}

// Numbers stay in Western digits (as used in Libya) and are bidi-isolated so signs and units keep their place.
const fx = (v, d) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const mAr = (v, d = 2) => `<bdi>${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(d)}</bdi> مليون دولار`;
export const nM = (v, d = 2) => `<bdi>${v < 0 ? '(' : ''}${(Math.abs(v) / 1e6).toFixed(d)}${v < 0 ? ')' : ''}</bdi>`;
export const usdA = (v, d = 0) => `<bdi>${v < 0 ? '(' : ''}$${fx(v, d)}${v < 0 ? ')' : ''}</bdi>`;
export const intA = v => `<bdi>${Math.round(v).toLocaleString('en-US')}</bdi>`;
export const pctA = (v, d = 1) => `<bdi>${(v * 100).toFixed(d)}%</bdi>`;
export const b = s => `<bdi>${s}</bdi>`;
export const zA = v => Math.abs(v) < 5e3 ? 'التعادل' : mAr(v);

// Arabic SVG text: mark each <text> that contains Arabic right-to-left, so punctuation and mixed runs order
// correctly, and swap its start/end anchor so it keeps the position it was laid out at with left-to-right
// semantics. Pure numbers stay left-to-right so signs (−5) and units stay in place.
export const rtlSvg = svg => svg.replace(/<text ([^>]*)>([\s\S]*?)<\/text>/g, (m, attrs, body) => {
  if (!/[\u0600-\u06FF]/.test(body)) return m;
  const a = /text-anchor="/.test(attrs) ? attrs : attrs + ' text-anchor="start"';
  return `<text direction="rtl" unicode-bidi="embed" ${a.replace(/text-anchor="(start|end)"/, (_, v) => `text-anchor="${v === 'start' ? 'end' : 'start'}"`)}>${body}</text>`;
});
