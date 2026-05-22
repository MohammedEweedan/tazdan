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
import { api } from '@/lib/api';
import { formatMoney } from '@/utils/format';
import { CURRENCY_META } from '@/constants';
import type { Currency } from '@/types';

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
  user: { firstName: string; lastName: string; email: string; createdAt: string };
  summary: { totalTransactions: number; totalDeposits: number; totalWithdrawals: number; totalFees: number };
  wallets: Array<{ currency: string; balance: string }>;
  transactions: Array<{
    id: string;
    type: string;
    currency: string;
    amount: string;
    fee: string;
    balanceBefore: string;
    balanceAfter: string;
    reference: string | null;
    description: string | null;
    createdAt: string;
  }>;
  generatedAt: string;
}

export async function fetchStatementJson(filter: StatementFilter): Promise<StatementJson> {
  const { data } = await api.get('/export/json', { params: filter });
  return data as StatementJson;
}

/* ── PDF rendering ───────────────────────────────────────────────── */

const css = `
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; }
  body { margin: 0; padding: 40px 32px; color: #1a1a1f; font-size: 11px; line-height: 1.45; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 4px; }
  h2 { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
       color: #6b6b75; margin: 28px 0 10px; border-bottom: 1px solid #d8d6cf; padding-bottom: 6px; }
  .brand { color: #0057B8; }
  .meta { color: #6b6b75; font-size: 10.5px; }
  .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
  .stat { flex: 1; min-width: 22%; padding: 14px; border: 1px solid #d8d6cf; border-radius: 12px; background: #fbfaf6; }
  .stat .label { font-size: 9.5px; color: #6b6b75; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; }
  .stat .value { font-size: 16px; font-weight: 800; margin-top: 4px; letter-spacing: -0.3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 9.5px; font-weight: 700; color: #6b6b75;
       letter-spacing: 0.6px; text-transform: uppercase;
       border-bottom: 1px solid #d8d6cf; padding: 8px 6px; }
  td { padding: 9px 6px; border-bottom: 1px solid #ececec; font-size: 10.5px; vertical-align: top; }
  .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .pos { color: #15803d; font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }
  .type-pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px;
               font-weight: 700; letter-spacing: 0.3px; background: #f0eee8; color: #1a1a1f; }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #d8d6cf;
            font-size: 9.5px; color: #6b6b75; line-height: 1.6; }
  .balances-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .balance-pill { padding: 8px 12px; border: 1px solid #d8d6cf; border-radius: 999px;
                  font-size: 11px; font-weight: 700; background: #fff; }
`;

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
    return escapeHtml(formatMoney(amount, c, { showSymbol: true, signed: true }));
  } catch {
    return `${amount} ${escapeHtml(currency)}`;
  }
}

function statementTitle(filter: StatementFilter): string {
  const parts: string[] = [];
  if (filter.from && filter.to) parts.push(`${filter.from} → ${filter.to}`);
  else if (filter.from)         parts.push(`since ${filter.from}`);
  else if (filter.to)           parts.push(`through ${filter.to}`);
  if (filter.currency) parts.push(`${filter.currency} only`);
  if (filter.type) parts.push(`${filter.type} only`);
  return parts.length ? parts.join(' · ') : 'All transactions';
}

export function renderStatementHtml(data: StatementJson, filter: StatementFilter): string {
  const fullName = `${data.user.firstName} ${data.user.lastName}`.trim();
  const generated = new Date(data.generatedAt).toLocaleString('en-US', {
    dateStyle: 'long', timeStyle: 'short',
  });
  const fmtUsd = (n: number) => formatMoney(n, 'USD', { showSymbol: true });

  const rows = data.transactions.map((t) => {
    const amt = Number(t.amount);
    const isOut = amt < 0;
    return `
      <tr>
        <td>${new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</td>
        <td><span class="type-pill">${escapeHtml(t.type)}</span></td>
        <td>${escapeHtml(t.description ?? '')}</td>
        <td>${escapeHtml(t.reference ?? '')}</td>
        <td class="num ${isOut ? 'neg' : 'pos'}">${fmtMoneyCell(t.amount, t.currency)}</td>
        <td class="num">${fmtMoneyCell(t.fee, t.currency)}</td>
        <td class="num">${fmtMoneyCell(t.balanceAfter, t.currency)}</td>
      </tr>
    `;
  }).join('');

  const balances = data.wallets
    .filter((w) => Number(w.balance) > 0)
    .map((w) => `<span class="balance-pill">${fmtMoneyCell(w.balance, w.currency)}</span>`)
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>fortuni Statement</title>
<style>${css}</style>
</head>
<body>
  <h1><span class="brand">fortuni</span> Account Statement</h1>
  <div class="meta">${escapeHtml(fullName)} · ${escapeHtml(data.user.email)}</div>
  <div class="meta">Period: ${escapeHtml(statementTitle(filter))} · Generated ${escapeHtml(generated)}</div>

  <h2>Summary</h2>
  <div class="summary">
    <div class="stat"><div class="label">Transactions</div><div class="value">${data.summary.totalTransactions}</div></div>
    <div class="stat"><div class="label">Total deposits</div><div class="value">${escapeHtml(fmtUsd(data.summary.totalDeposits))}</div></div>
    <div class="stat"><div class="label">Total withdrawals</div><div class="value">${escapeHtml(fmtUsd(data.summary.totalWithdrawals))}</div></div>
    <div class="stat"><div class="label">Total fees paid</div><div class="value">${escapeHtml(fmtUsd(data.summary.totalFees))}</div></div>
  </div>

  ${balances ? `<h2>Current balances</h2><div class="balances-row">${balances}</div>` : ''}

  <h2>Transactions (${data.transactions.length})</h2>
  ${data.transactions.length === 0
    ? '<p class="meta">No transactions match this filter.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Reference</th>
            <th class="num">Amount</th>
            <th class="num">Fee</th>
            <th class="num">Balance after</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}

  <div class="footer">
    This statement was generated from fortuni records on the date shown above. All amounts
    are settled in the corresponding wallet currency. For audit support, contact
    support@promrkts.app referencing your account email.
  </div>
</body></html>`;
}

/**
 * Generate a PDF of a statement and present the system share sheet.
 * Returns the file URI written to the cache directory.
 */
export async function exportStatementPdf(filter: StatementFilter): Promise<string> {
  const data = await fetchStatementJson(filter);
  const html = renderStatementHtml(data, filter);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Rename to a sensible filename so the OS share sheet displays a
  // human-readable title and the resulting file is recognisable in
  // the user's downloads / mail attachments.
  const filename = `fortuni-statement${filter.from ? `-${filter.from}` : ''}${filter.to ? `_to_${filter.to}` : ''}${filter.currency ? `-${filter.currency}` : ''}.pdf`;
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
