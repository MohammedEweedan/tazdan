#!/usr/bin/env node
/* i18n coverage check for the public website.
 *
 *   node scripts/i18n-check.mjs            summary per locale
 *   node scripts/i18n-check.mjs --list     also print every problem key
 *   node scripts/i18n-check.mjs --locale fr --list
 *
 * Collects every translation key the public pages use (literal t("…") calls
 * plus any string literal shaped like a site key, e.g. "partners.hero.title"),
 * then checks each locale (base src/i18n/<l>.json merged with the site
 * namespaces src/i18n/site/<ns>/<l>.json, exactly as i18n/tolgee.ts does) for:
 *   missing      key absent (Tolgee would fall back to English)
 *   english      value identical to English (likely untranslated)
 *   emphasis     *emphasis* marker count differs from English
 * Exits 1 when any locale has missing keys or broken emphasis markers. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const LOCALES = ["en", "ar", "fr", "de", "es", "nl", "ru", "tr", "pt", "cn"];
const NAMESPACES = fs.readdirSync(path.join(src, "i18n/site")).filter((d) => !d.startsWith("_") && fs.statSync(path.join(src, "i18n/site", d)).isDirectory());

const args = process.argv.slice(2);
const list = args.includes("--list");
const only = args.includes("--locale") ? args[args.indexOf("--locale") + 1] : null;

/* ── files that make up the public site ── */
const SCAN_DIRS = ["app", "components/site", "components/pages"];
const SCAN_FILES = ["components/ui/WaitlistModal.tsx", "components/ui/LegalPage.tsx", "components/ui/LanguageSwitcher.tsx", "components/ui/FeeCalculator.tsx"];
const SKIP = [/^app\/admin\b/, /^app\/api\b/, /^app\/kit-preview\b/];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(src, full);
    if (SKIP.some((re) => re.test(rel))) continue;
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}
const files = [
  ...SCAN_DIRS.flatMap((d) => (fs.existsSync(path.join(src, d)) ? walk(path.join(src, d)) : [])),
  ...SCAN_FILES.map((f) => path.join(src, f)).filter((f) => fs.existsSync(f)),
];

const nsAlt = NAMESPACES.join("|");
const keyCall = /\b(?:t|tr|translate)\(\s*["'`]([A-Za-z0-9_.-]+)["'`]/g;
const siteLiteral = new RegExp(`["'\`]((?:${nsAlt})\\.[A-Za-z0-9_.-]+)["'\`]`, "g");

const used = new Map(); // key → first file
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const re of [keyCall, siteLiteral]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const k = m[1];
      if (k.endsWith(".") || k.includes("${")) continue;
      if (!used.has(k)) used.set(k, path.relative(src, f));
    }
  }
}
// Keys built dynamically inside the kit.
for (const s of ["inApp", "pilot", "planned", "inProgress", "discussion", "pipeline", "notBuilt", "signed", "licensed", "live"]) used.set(`common.status.${s}`, "components/site/primitives.tsx");

/* ── load locales the way tolgee.ts merges them ── */
function load(l) {
  const base = JSON.parse(fs.readFileSync(path.join(src, `i18n/${l}.json`), "utf8"));
  const site = {};
  for (const ns of NAMESPACES) {
    const p = path.join(src, `i18n/site/${ns}/${l}.json`);
    if (fs.existsSync(p)) Object.assign(site, JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return { ...base, ...site };
}
const data = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));
const en = data.en;

// Values allowed to equal English (brand names, codes, figures).
const SAME_OK = /^(?:[\d\s.,:%+\-–—/×$€£₺]+|tazdan|Visa|Banxa|Crypto\.com|USDT|API|KYC|KYB|P2P|LYD|USD|EUR|GBP|BTC|ETH|SOL|TRY|EGP|AED|TND|2FA|TOTP|QR|FAQ|OK|Email|E-mail|SMS|iPhone|Android|WhatsApp|X|Instagram|LinkedIn)$/i;
const stars = (s) => (String(s).match(/\*/g) || []).length;

let failed = false;
const usedKeys = [...used.keys()].sort();
console.log(`Scanned ${files.length} files · ${usedKeys.length} keys in use · namespaces: ${NAMESPACES.join(", ")}\n`);
for (const l of LOCALES) {
  if (only && l !== only) continue;
  const d = data[l];
  const missing = usedKeys.filter((k) => d[k] === undefined || d[k] === "");
  const english = l === "en" ? [] : usedKeys.filter((k) => d[k] !== undefined && d[k] === en[k] && /[A-Za-z]{3}/.test(String(en[k])) && !SAME_OK.test(String(en[k]).trim()));
  const emphasis = l === "en" ? [] : usedKeys.filter((k) => d[k] !== undefined && en[k] !== undefined && stars(d[k]) !== stars(en[k]));
  if (missing.length || emphasis.length) failed = true;
  console.log(`${l.padEnd(3)} missing ${String(missing.length).padStart(4)} · english ${String(english.length).padStart(4)} · emphasis ${String(emphasis.length).padStart(3)}`);
  if (list) {
    for (const k of missing) console.log(`    missing   ${k}   (${used.get(k)})`);
    for (const k of english) console.log(`    english   ${k}`);
    for (const k of emphasis) console.log(`    emphasis  ${k}`);
  }
}
process.exit(failed ? 1 : 0);
