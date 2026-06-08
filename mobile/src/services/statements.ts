/**
 * Statement service — pulls JSON from /api/export/json and turns it
 * into a print-ready HTML document. expo-print renders the HTML to
 * PDF on-device; expo-sharing surfaces the system share sheet so the
 * user can save, email, or send the file.
 *
 * Keeping HTML composition in JS (not a designer-controlled template
 * server-side) makes branding tweaks two-line changes and avoids
 * shipping a templating engine on the server.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';
import { api } from '@/lib/api';
import { formatMoney } from '@/utils/format';
import { CURRENCY_META } from '@/constants';
import type { Currency } from '@/types';
import { translateLiteral, useI18n, type Locale } from '@/store/i18nStore';

export interface StatementFilter {
  /** Inclusive start (ISO date 'YYYY-MM-DD'). */
  from?: string;
  /** Inclusive end. */
  to?: string;
  /** Transaction type filter (DEPOSIT, WITHDRAWAL, BUY, SELL, …). */
  type?: string;
  /** Currency filter — restricts to wallets/transactions in this currency. */
  currency?: Currency;
}

export interface StatementJson {
  user: { firstName: string; lastName: string; email: string; createdAt: string; baseCurrency?: string };
  summary: {
    totalTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalFees: number;
    totalTransfersIn?: number;
    totalTransfersOut?: number;
    totalBuys?: number;
    totalSells?: number;
    totalRecurringBuys?: number;
    totalAccountValueUsd?: number;
    totalFrozenUsd?: number;
    byCurrency?: Record<string, { debit: number; credit: number; fees: number; count: number }>;
  };
  wallets: Array<{
    currency: string;
    balance: string;
    frozen?: string;
    source?: string;
    priceUsd?: string;
    valueUsd?: string;
    frozenValueUsd?: string;
  }>;
  recurringBuys?: Array<{
    id: string;
    asset: string;
    network: string;
    fiatCurrency: string;
    fiatAmount: string;
    frequency: string;
    sourceType: string;
    sourceId?: string | null;
    status: string;
    nextRunAt?: string | null;
    lastRunAt?: string | null;
    runCount: number;
    failureCount: number;
    lastError?: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    category?: string;
    currency: string;
    amount: string;
    debit?: string;
    credit?: string;
    fee: string;
    balanceBefore: string;
    balanceAfter: string;
    valueUsd?: string;
    balanceAfterValueUsd?: string;
    reference: string | null;
    description: string | null;
    source?: 'MANUAL' | 'RECURRING_BUY' | string;
    metadata?: Record<string, any> | null;
    createdAt: string;
  }>;
  valuation?: {
    currency: string;
    totalAccountValueUsd: string;
    totalFrozenUsd: string;
    prices: Record<string, number>;
    pricedAt: string;
  };
  generatedAt: string;
}

export async function fetchStatementJson(filter: StatementFilter): Promise<StatementJson> {
  const { data } = await api.get('/export/json', { params: filter });
  return data as StatementJson;
}

/* ── PDF rendering ───────────────────────────────────────────────── */

// `Image.resolveAssetSource` only exists on native — on react-native-web it's
// undefined and throws at import time, crashing the whole app. Guard it so the
// module loads everywhere; the PDF/statements feature is native-only anyway.
function assetUri(mod: number): string {
  try {
    const resolve = (Image as any)?.resolveAssetSource;
    return typeof resolve === 'function' ? (resolve(mod)?.uri ?? '') : '';
  } catch {
    return '';
  }
}

const brandIconUri = assetUri(require('../../assets/icon-white.png'));
const outfitRegularUri = assetUri(require('@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf'));
const outfitBoldUri = assetUri(require('@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf'));
const cairoRegularUri = assetUri(require('@expo-google-fonts/cairo/400Regular/Cairo_400Regular.ttf'));
const cairoBoldUri = assetUri(require('@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf'));

function cssFor(locale: Locale): string {
  const face = locale === 'ar'
    ? "'Cairo', 'Arial', sans-serif"
    : "'Outfit', 'Arial', sans-serif";
  return `
    ${outfitRegularUri ? `@font-face { font-family: 'Outfit'; font-weight: 400; src: url('${outfitRegularUri}'); }` : ''}
    ${outfitBoldUri ? `@font-face { font-family: 'Outfit'; font-weight: 700 900; src: url('${outfitBoldUri}'); }` : ''}
    ${cairoRegularUri ? `@font-face { font-family: 'Cairo'; font-weight: 400; src: url('${cairoRegularUri}'); }` : ''}
    ${cairoBoldUri ? `@font-face { font-family: 'Cairo'; font-weight: 700 900; src: url('${cairoBoldUri}'); }` : ''}
    @page { size: A4; margin: 24px; }
    * { box-sizing: border-box; color: #000 !important; font-family: ${face}; }
    body { margin: 0; background: #fff; color: #000; font-size: 9.5px; line-height: 1.35; }
    .page { position: relative; min-height: 1040px; padding: 22px 20px 28px; border: 1px solid #000; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 2px solid #000; padding-bottom: 14px; }
    .brand-copy { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 7px; }
    .title { font-size: 26px; line-height: 1; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
    .subtitle { font-size: 10px; font-weight: 700; margin-top: 8px; }
    .brand-mark { width: 58px; height: 58px; background: #000; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
    .brand-mark img { width: 42px; height: 42px; object-fit: contain; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .grid.two { grid-template-columns: repeat(2, 1fr); }
    .box { border: 1px solid #000; padding: 9px 10px; min-height: 52px; break-inside: avoid; }
    .label { font-size: 7.5px; font-weight: 900; letter-spacing: 0.9px; text-transform: uppercase; margin-bottom: 5px; }
    .value { font-size: 13px; font-weight: 900; line-height: 1.15; }
    .small { font-size: 8px; font-weight: 700; line-height: 1.35; }
    h2 { font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1.5px solid #000; margin: 18px 0 7px; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { border-bottom: 1.5px solid #000; padding: 6px 5px; font-size: 7.2px; line-height: 1.15; font-weight: 900; letter-spacing: 0.65px; text-transform: uppercase; text-align: left; }
    td { border-bottom: 1px solid #000; padding: 6px 5px; font-size: 8px; line-height: 1.25; vertical-align: top; overflow-wrap: anywhere; }
    tr { break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
    .type { font-weight: 900; letter-spacing: 0.4px; }
    .note { border-top: 1.5px solid #000; margin-top: 18px; padding-top: 10px; font-size: 8px; font-weight: 700; line-height: 1.45; }
    .muted { font-weight: 700; }
    .nowrap { white-space: nowrap; }
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoneyCell(amount: string, currency: string): string {
  try {
    const c = currency as Currency;
    if (!CURRENCY_META[c]) return `${amount} ${escapeHtml(currency)}`;
    return escapeHtml(formatMoney(amount, c, { showSymbol: true }));
  } catch {
    return `${amount} ${escapeHtml(currency)}`;
  }
}

function fmtSignedMoneyCell(amount: string | number, currency: string): string {
  try {
    const c = currency as Currency;
    if (!CURRENCY_META[c]) return `${Number(amount).toLocaleString('en-US')} ${escapeHtml(currency)}`;
    return escapeHtml(formatMoney(amount, c, { showSymbol: true, signed: true }));
  } catch {
    return `${escapeHtml(String(amount))} ${escapeHtml(currency)}`;
  }
}

function usd(amount: string | number): string {
  return escapeHtml(formatMoney(Number(amount), 'USD', { showSymbol: true }));
}

function date(iso?: string | null, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit' }): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', opts) : '-';
}

function dateTime(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function statementTitle(filter: StatementFilter, tr: (s: string) => string): string {
  const parts: string[] = [];
  if (filter.from && filter.to) parts.push(`${filter.from} → ${filter.to}`);
  else if (filter.from)         parts.push(`since ${filter.from}`);
  else if (filter.to)           parts.push(`through ${filter.to}`);
  if (filter.currency) parts.push(`${filter.currency} only`);
  if (filter.type) parts.push(`${filter.type} only`);
  return parts.length ? parts.join(' · ') : tr('All transactions');
}

function stat(label: string, value: string | number, sub?: string): string {
  return `<div class="box"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value))}</div>${sub ? `<div class="small">${escapeHtml(sub)}</div>` : ''}</div>`;
}

export function renderStatementHtml(data: StatementJson, filter: StatementFilter, locale: Locale = 'en'): string {
  const tr = (text: string) => translateLiteral(text, locale) ?? text;
  const fullName = `${data.user.firstName} ${data.user.lastName}`.trim();
  const generated = dateTime(data.generatedAt);
  const opened = date(data.user.createdAt, { year: 'numeric', month: 'long', day: 'numeric' });
  const period = statementTitle(filter, tr);

  const rows = data.transactions.map((t) => {
    return `
      <tr>
        <td style="width: 10%">${escapeHtml(dateTime(t.createdAt))}</td>
        <td style="width: 8%" class="type">${escapeHtml(t.type)}</td>
        <td style="width: 19%">${escapeHtml(t.description ?? '')}${t.source === 'RECURRING_BUY' ? `<br><span class="muted">${tr('Recurring buy execution')}</span>` : ''}</td>
        <td style="width: 12%">${escapeHtml(t.reference ?? '')}</td>
        <td style="width: 7%" class="center">${escapeHtml(t.currency)}</td>
        <td style="width: 10%" class="num">${Number(t.debit ?? 0) ? fmtMoneyCell(t.debit ?? '0', t.currency) : '-'}</td>
        <td style="width: 10%" class="num">${Number(t.credit ?? 0) ? fmtMoneyCell(t.credit ?? '0', t.currency) : '-'}</td>
        <td style="width: 8%" class="num">${fmtMoneyCell(t.fee, t.currency)}</td>
        <td style="width: 8%" class="num">${fmtMoneyCell(t.balanceAfter, t.currency)}</td>
        <td style="width: 8%" class="num">${usd(t.balanceAfterValueUsd ?? 0)}</td>
      </tr>
    `;
  }).join('');

  const balances = data.wallets
    .filter((w) => Number(w.balance) !== 0 || Number(w.frozen ?? 0) !== 0)
    .sort((a, b) => Number(b.valueUsd ?? 0) - Number(a.valueUsd ?? 0))
    .map((w) => `
      <tr>
        <td>${escapeHtml(w.currency)}</td>
        <td>${escapeHtml(w.source ?? 'wallet')}</td>
        <td class="num">${fmtMoneyCell(w.balance, w.currency)}</td>
        <td class="num">${fmtMoneyCell(w.frozen ?? '0', w.currency)}</td>
        <td class="num">${usd(w.priceUsd ?? 0)}</td>
        <td class="num">${usd(w.valueUsd ?? 0)}</td>
      </tr>
    `)
    .join('');

  const currencyRows = Object.entries(data.summary.byCurrency ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, r]) => `
      <tr>
        <td>${escapeHtml(currency)}</td>
        <td class="num">${r.count}</td>
        <td class="num">${fmtMoneyCell(String(r.debit), currency)}</td>
        <td class="num">${fmtMoneyCell(String(r.credit), currency)}</td>
        <td class="num">${fmtMoneyCell(String(r.fees), currency)}</td>
      </tr>
    `).join('');

  const recurringRows = (data.recurringBuys ?? []).map((r) => `
    <tr>
      <td>${escapeHtml(r.asset)} / ${escapeHtml(r.network)}</td>
      <td class="num">${fmtMoneyCell(r.fiatAmount, r.fiatCurrency)}</td>
      <td>${escapeHtml(r.frequency)}</td>
      <td>${escapeHtml(r.sourceType)}${r.sourceId ? ` · ${escapeHtml(r.sourceId)}` : ''}</td>
      <td>${escapeHtml(r.status)}</td>
      <td class="num">${r.runCount}</td>
      <td>${escapeHtml(date(r.lastRunAt))}</td>
      <td>${escapeHtml(date(r.nextRunAt))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="${escapeHtml(locale)}"><head><meta charset="utf-8" />
<title>${tr('tazdan Account Statement')}</title>
<style>${cssFor(locale)}</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div>
      <div class="brand-copy">tazdan</div>
      <h1 class="title">${tr('Statement of Account')}</h1>
      <div class="subtitle">${tr('Cash ledger, asset balances, recurring schedules, and current account valuation')}</div>
    </div>
    <div class="brand-mark">${brandIconUri ? `<img src="${escapeHtml(brandIconUri)}" />` : ''}</div>
  </div>

  <div class="grid">
    ${stat(tr('Account holder'), fullName)}
    ${stat(tr('Email'), data.user.email)}
    ${stat(tr('Account opened'), opened)}
    ${stat(tr('Generated'), generated)}
  </div>
  <div class="grid two">
    ${stat(tr('Statement period'), period)}
    ${stat(tr('Valuation basis'), tr('Estimated USD mark-to-market at generation time'))}
  </div>

  <h2>${tr('Accounting summary')}</h2>
  <div class="grid">
    ${stat(tr('Transactions'), data.summary.totalTransactions)}
    ${stat(tr('Current account value'), usd(data.valuation?.totalAccountValueUsd ?? data.summary.totalAccountValueUsd ?? 0))}
    ${stat(tr('Frozen value'), usd(data.valuation?.totalFrozenUsd ?? data.summary.totalFrozenUsd ?? 0))}
    ${stat(tr('Fees paid'), usd(data.summary.totalFees))}
  </div>
  <div class="grid">
    ${stat(tr('Transfers in'), usd(data.summary.totalTransfersIn ?? 0))}
    ${stat(tr('Transfers out'), usd(data.summary.totalTransfersOut ?? 0))}
    ${stat(tr('Buy funding'), usd(data.summary.totalBuys ?? 0))}
    ${stat(tr('Sell proceeds'), usd(data.summary.totalSells ?? 0))}
  </div>

  <h2>${tr('Currency activity control')}</h2>
  ${currencyRows ? `<table>
    <thead><tr><th>${tr('Currency')}</th><th class="num">${tr('Rows')}</th><th class="num">${tr('Debits')}</th><th class="num">${tr('Credits')}</th><th class="num">${tr('Fees')}</th></tr></thead>
    <tbody>${currencyRows}</tbody>
  </table>` : `<div class="small">${tr('No currency activity in this period.')}</div>`}

  <h2>${tr('Current holdings and account values')}</h2>
  ${balances ? `<table>
    <thead><tr><th>${tr('Asset')}</th><th>${tr('Account')}</th><th class="num">${tr('Units')}</th><th class="num">${tr('Frozen')}</th><th class="num">${tr('USD price')}</th><th class="num">${tr('USD value')}</th></tr></thead>
    <tbody>${balances}</tbody>
  </table>` : `<div class="small">${tr('No balances held at generation time.')}</div>`}

  <h2>${tr('Recurring buys')}</h2>
  ${recurringRows ? `<table>
    <thead><tr><th>${tr('Asset')}</th><th class="num">${tr('Amount')}</th><th>${tr('Frequency')}</th><th>${tr('Funding source')}</th><th>${tr('Status')}</th><th class="num">${tr('Runs')}</th><th>${tr('Last run')}</th><th>${tr('Next run')}</th></tr></thead>
    <tbody>${recurringRows}</tbody>
  </table>` : `<div class="small">${tr('No active recurring buy schedules.')}</div>`}

  <h2>${tr('Full transaction ledger')} (${data.transactions.length})</h2>
  ${data.transactions.length === 0
    ? `<p class="small">${tr('No transactions match this filter.')}</p>`
    : `<table>
        <thead>
          <tr>
            <th>${tr('Posted')}</th>
            <th>${tr('Type')}</th>
            <th>${tr('Narrative')}</th>
            <th>${tr('Reference')}</th>
            <th class="center">${tr('Ccy')}</th>
            <th class="num">${tr('Debit')}</th>
            <th class="num">${tr('Credit')}</th>
            <th class="num">${tr('Fee')}</th>
            <th class="num">${tr('Balance')}</th>
            <th class="num">${tr('Value')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}

  <div class="note">
    ${tr('This statement is produced from tazdan ledger records as of the generation time shown above. Debits reduce the stated wallet balance; credits increase it. Current account values are estimated USD mark-to-market values and may differ from execution prices, settlement proceeds, bank values, tax lots, or future liquidation values. For audit support, contact support@tazdan.com referencing your account email.')}
  </div>
</div>
</body></html>`;
}

/**
 * Generate a PDF of a statement and present the system share sheet.
 * Returns the file URI written to the cache directory.
 */
export async function exportStatementPdf(filter: StatementFilter, options?: { locale?: Locale }): Promise<string> {
  const data = await fetchStatementJson(filter);
  const locale = options?.locale ?? useI18n.getState().locale;
  const html = renderStatementHtml(data, filter, locale);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Rename to a sensible filename so the OS share sheet displays a
  // human-readable title and the resulting file is recognisable in
  // the user's downloads / mail attachments.
  const filename = `tazdan-statement${filter.from ? `-${filter.from}` : ''}${filter.to ? `_to_${filter.to}` : ''}${filter.currency ? `-${filter.currency}` : ''}.pdf`;
  let outUri = uri;
  try {
    const src = new File(uri);
    const dest = new File(Paths.cache, filename);
    if (dest.exists) dest.delete();
    src.move(dest);
    outUri = dest.uri;
  } catch {
    // If the move fails (older expo-file-system on some platforms),
    // fall through with the original print URI — sharing still works.
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(outUri, { mimeType: 'application/pdf', dialogTitle: 'Save statement' });
  }
  return outUri;
}
