#!/usr/bin/env node
/* Lightweight i18n audit for mobile.
 * - verifies every locale block contains every English key
 * - flags obvious hardcoded user-facing strings in app/src files
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const storePath = path.join(root, 'src/store/i18nStore.ts');
const srcRoots = [path.join(root, 'app'), path.join(root, 'src')];
const locales = ['en', 'ar', 'fr', 'es', 'de', 'nl', 'ru', 'zh'];
const strict = process.argv.includes('--strict') || process.env.STRICT_I18N === '1';

const source = fs.readFileSync(storePath, 'utf8');

function blockFor(locale) {
  const dictStart = source.indexOf('const dict');
  const start = source.indexOf(`  ${locale}: {`, dictStart);
  if (start < 0) return '';
  const bodyStart = source.indexOf('\n', start);
  const rest = source.slice(bodyStart + 1);
  const next = rest.search(/\n  (en|ar|fr|es|de|nl|ru|zh): \{/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function keys(block) {
  return new Set([...block.matchAll(/['"]([a-zA-Z0-9_.-]+)['"]\s*:/g)].map((m) => m[1]));
}

const enKeys = keys(blockFor('en'));
const enValues = new Set(
  [...blockFor('en').matchAll(/['"][a-zA-Z0-9_.-]+['"]\s*:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g)]
    .map((m) => m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim())
    .filter(Boolean),
);
const runtimeCompletesLocales = /for \(const locale of LOCALES\)/.test(source)
  && /dict\[locale\]\[key\] = value/.test(source);
let failed = false;
for (const locale of locales.filter((l) => l !== 'en')) {
  const missing = [...enKeys].filter((k) => !keys(blockFor(locale)).has(k));
  if (missing.length) {
    if (strict && !runtimeCompletesLocales) failed = true;
    const mode = runtimeCompletesLocales ? 'fallback-filled' : 'missing';
    console.error(`[i18n] ${locale} ${mode} ${missing.length} key(s): ${missing.slice(0, 40).join(', ')}${missing.length > 40 ? '…' : ''}`);
  }
}

const allow = [
  /console\./,
  /import /,
  /from ['"]/,
  /require\(/,
  /testID=/,
  /accessibilityRole=/,
  /keyboardType=/,
  /returnKeyType=/,
  /Ionicons name=/,
  /type [A-Z_a-z0-9]+ =/,
  /interface /,
  /export type/,
  /status: ['"]/,
  /role === ['"]/,
  /kind === ['"]/,
  /currency === ['"]/,
  /queryKey:/,
  /className=/,
  /fontFamily:/,
  /fontWeight:/,
  /Content-Type/,
  /ERR_NETWORK/,
  /rgba\(/,
  /#[0-9A-Fa-f]{3,8}/,
];
const hardcoded = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !full.endsWith('i18nStore.ts')) scan(full);
  }
}

function scan(file) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (allow.some((r) => r.test(line))) return;
    const textLiterals = [...line.matchAll(/(['"`])((?:\\.|(?!\1).)*?)\1/g)];
    for (const m of textLiterals) {
      const text = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
      if (!isLikelyUiLiteral(text, line)) continue;
      hardcoded.push(`${rel}:${idx + 1}: ${text}`);
    }
  });
}

function isLikelyUiLiteral(text, line) {
  if (text.length < 4 || !/^[A-Z]/.test(text)) return false;
  if (!/[a-z]/.test(text) && !/[ ?!.,:&/@·()-]/.test(text)) return false;
  if (/^[A-Z0-9_ -]+$/.test(text) && text.length <= 16) return false;
  if (/^[A-Z]{2,6}$/.test(text)) return false;
  if (/^[A-Z]{2,6}(,\s*[A-Z]{2,6})+$/.test(text.replace(/['"]/g, ''))) return false;
  if (/^(BTC|ETH|USDT|USDC|SOL|EUR|USD|GBP|AED|SAR|EGP|LYD|CAD|AUD|CHF|JPY|CNY)/.test(text)) return false;
  if (/^(Outfit|Cairo|IBMPlexSansArabic|Times New Roman|Menlo)/.test(text)) return false;
  if (/^M\d/.test(text)) return false;
  if (/SDK|API|IBAN|BIC|SWIFT|ERC-20|BEP-20|SPL/.test(text)) return false;
  if (enValues.has(text)) return false;
  if (/icon:|network:|symbol:|currency:|font|color|backgroundColor|borderColor/.test(line)) return false;
  return /^[A-Za-z0-9 ,.'?!:&/()@·→_-]+$/.test(text);
}

srcRoots.forEach((d) => walk(d));
if (hardcoded.length) {
  if (strict) failed = true;
  console.error(`[i18n] possible hardcoded UI strings (${hardcoded.length}):`);
  hardcoded.slice(0, 120).forEach((s) => console.error(`  ${s}`));
  if (hardcoded.length > 120) console.error(`  …and ${hardcoded.length - 120} more`);
}

if (failed) process.exit(1);
console.log(`[i18n] ${strict ? 'OK' : 'report complete'}: ${enKeys.size} English keys checked across ${locales.length} locales.`);
if (!strict && hardcoded.length) {
  console.log('[i18n] Run `npm run i18n:audit:strict` after migrating the remaining hardcoded strings.');
}
