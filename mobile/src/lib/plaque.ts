/**
 * Branded QR and till plaque — one design for the on-screen preview
 * (components/business/PlaquePreview) and the printed / PDF version here.
 *
 * Plaque: the business name in its brand colour, "Scan to pay", the QR with
 * the business's logo in the middle, and a brand-coloured footer with the
 * tazdan ن mark and "tazdan accepted here" in the chosen language.
 */
import { create as createQr } from 'qrcode';
import { contrastRatio, normalizeAccent } from '@/theme/accent';

export const TAZDAN_NAVY = '#24384F';

export const PLAQUE_LOCALES = [
  { code: 'en', label: 'English', scan: 'Scan to pay', accepted: 'tazdan accepted here', brand: 'tazdan', rtl: false },
  { code: 'ar', label: 'العربية', scan: 'امسح وادفع', accepted: 'تزدان مقبول هنا', brand: 'تزدان', rtl: true },
  { code: 'fr', label: 'Français', scan: 'Scannez pour payer', accepted: 'tazdan accepté ici', brand: 'tazdan', rtl: false },
  { code: 'es', label: 'Español', scan: 'Escanea para pagar', accepted: 'Aceptamos tazdan', brand: 'tazdan', rtl: false },
  { code: 'de', label: 'Deutsch', scan: 'Zum Bezahlen scannen', accepted: 'tazdan wird hier akzeptiert', brand: 'tazdan', rtl: false },
  { code: 'nl', label: 'Nederlands', scan: 'Scan om te betalen', accepted: 'tazdan hier geaccepteerd', brand: 'tazdan', rtl: false },
  { code: 'ru', label: 'Русский', scan: 'Сканируйте для оплаты', accepted: 'Здесь принимают tazdan', brand: 'tazdan', rtl: false },
  { code: 'tr', label: 'Türkçe', scan: 'Ödemek için tarayın', accepted: 'tazdan burada geçerli', brand: 'tazdan', rtl: false },
  { code: 'zh', label: '中文', scan: '扫码付款', accepted: '此处可使用 tazdan 付款', brand: 'tazdan', rtl: false },
] as const;
export type PlaqueLocale = (typeof PLAQUE_LOCALES)[number]['code'];
export const plaqueText = (code: string) => PLAQUE_LOCALES.find((l) => l.code === code) ?? PLAQUE_LOCALES[0];

export const BRAND_PRESETS = ['#24384F', '#0F7B4A', '#B3261E', '#C2410C', '#7C3AED', '#0E7490', '#111827', '#9D174D', '#A16207', '#1D4ED8'];

/** A brand colour, or tazdan navy. */
export const brandOr = (hex?: string | null) => normalizeAccent(hex ?? '') ?? TAZDAN_NAVY;

/** QR modules need strong contrast on white: the brand colour if dark enough, else navy. */
export function qrInk(hex?: string | null): string {
  const c = brandOr(hex);
  return contrastRatio(c, '#FFFFFF') >= 4.5 ? c : TAZDAN_NAVY;
}

/** Text that sits on the brand colour. */
export const onBrand = (hex?: string | null) => (contrastRatio(brandOr(hex), '#FFFFFF') >= 3 ? '#FFFFFF' : '#0A0A0B');

/** The tazdan ن mark (from the app icon) as inline SVG, in one colour. */
export function tazdanMarkSvg(color: string, size: number, hole: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 714 / 765)}" viewBox="240 266 765 714"><path fill="none" stroke="${color}" stroke-width="87" stroke-linecap="round" stroke-linejoin="round" d="M497 445 L454 445 A155.5 155.5 0 0 0 298.5 600.5 L298.5 766 A155.5 155.5 0 0 0 454 921.5 L765 921.5 A155.5 155.5 0 0 0 920.5 766 L920.5 600.5 A155.5 155.5 0 0 0 765 445 L730 445"/><rect x="635" y="584" width="355" height="207" rx="103.5" fill="${color}"/><circle cx="878" cy="687" r="39" fill="${hole}"/><circle cx="618" cy="350" r="69" fill="${color}"/></svg>`;
}

/**
 * The QR as vector SVG (error correction H), so print is sharp at any size
 * and the logo overlay is deterministic. A clear square in the middle is
 * left for the logo; H recovers up to 30%, the hole is under 7%.
 */
export function qrSvg(value: string, color: string, withHole = true) {
  const m = createQr(value, { errorCorrectionLevel: 'H' }).modules;
  const n = m.size;
  const hole = withHole ? Math.ceil(n * 0.26) | 1 : 0; // odd, centred
  const h0 = (n - hole) / 2;
  let d = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!m.get(r, c)) continue;
      if (hole && r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole) continue;
      d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" width="100%" height="100%"><path fill="${color}" d="${d}"/></svg>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const PAGE: Record<string, { w: number; h: number }> = { A6: { w: 105, h: 148 }, A5: { w: 148, h: 210 }, STAND: { w: 100, h: 150 }, A4: { w: 210, h: 297 } };

/** Printable plaque (or poster when size = A4). `logo` is a data URI; without one the tazdan ن sits in the middle. */
export function plaqueHtml(o: {
  name: string; logo?: string | null; value: string; primary?: string | null; secondary?: string | null;
  locale: string; size?: keyof typeof PAGE; till?: string | null;
}) {
  const t = plaqueText(o.locale);
  const page = PAGE[o.size ?? 'A6'];
  const brand = brandOr(o.primary);
  const accent = o.secondary ? brandOr(o.secondary) : brand;
  const ink = onBrand(brand);
  const u = page.w / 105; // scale everything from the A6 design
  const qr = 64 * u;
  return `<!doctype html><html lang="${t.code}"><head><meta charset="utf-8"><style>
    @page{size:${page.w}mm ${page.h}mm;margin:0}
    *{box-sizing:border-box}
    body{margin:0;font-family:-apple-system,"SF Pro Display",Roboto,"Segoe UI","Noto Sans Arabic",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .p{width:${page.w}mm;height:${page.h}mm;display:flex;flex-direction:column;background:#fff;overflow:hidden}
    .top{height:${5 * u}mm;background:linear-gradient(90deg,${brand},${accent})}
    .body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${6 * u}mm ${8 * u}mm ${4 * u}mm;text-align:center}
    .n{font-size:${18 * u}pt;font-weight:800;color:${brand};letter-spacing:-0.2pt;line-height:1.15;margin:0}
    .s{font-size:${10 * u}pt;font-weight:600;color:#3C4A58;margin:${1.5 * u}mm 0 ${5 * u}mm}
    .q{position:relative;width:${qr}mm;height:${qr}mm;padding:${3 * u}mm;border-radius:${5 * u}mm;border:${0.5 * u}mm solid #E6E8EC}
    .q .code{width:100%;height:100%}
    .logo{position:absolute;left:50%;top:50%;width:${15 * u}mm;height:${15 * u}mm;transform:translate(-50%,-50%);background:#fff;border-radius:${3.5 * u}mm;padding:${1.4 * u}mm;box-shadow:0 0 0 ${0.6 * u}mm #fff}
    .logo img,.logo svg{width:100%;height:100%;object-fit:contain;border-radius:${2.4 * u}mm;display:block}
    .till{font-size:${7 * u}pt;color:#8A94A3;margin-top:${3 * u}mm;direction:ltr}
    .foot{height:${17 * u}mm;background:${brand};color:${ink};display:flex;align-items:center;justify-content:center;gap:${2.5 * u}mm;font-size:${10 * u}pt;font-weight:700}
    .foot svg{display:block;width:${8 * u}mm;height:auto}
    .rtl{direction:rtl;unicode-bidi:isolate}
    .foot.rtl{flex-direction:row-reverse;direction:ltr}
  </style></head><body><div class="p">
    <div class="top"></div>
    <div class="body">
      <p class="n" dir="auto">${esc(o.name)}</p>
      <p class="s${t.rtl ? ' rtl' : ''}">${esc(t.scan)}</p>
      <div class="q"><div class="code">${qrSvg(o.value, qrInk(o.primary))}</div><div class="logo">${o.logo ? `<img src="${esc(o.logo)}"/>` : tazdanMarkSvg(qrInk(o.primary), 60, '#FFFFFF')}</div></div>
      ${o.till ? `<div class="till">${esc(o.till)}</div>` : ''}
    </div>
    <div class="foot${t.rtl ? ' rtl' : ''}">${tazdanMarkSvg(ink, Math.round(22 * u), brand)}<span${t.rtl ? ' dir="rtl"' : ''}>${esc(t.accepted)}</span></div>
  </div></body></html>`;
}

/** A note when the brand colour is too light for the QR (it prints in navy instead). */
export function contrastWarning(hex: string): string | null {
  if (qrInk(hex) === brandOr(hex)) return null;
  return 'This colour is too light for a scanner, so the QR itself prints in navy. Your colour still frames the plaque.';
}
