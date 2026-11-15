/**
 * Statement parsing for LyPay, OnePay and bank exports.
 *
 * Exports differ by rail and bank, so columns are found by header name in
 * Arabic or English (or set explicitly with `mapping`). Text files may be
 * UTF-8 or Windows-1256 (common in Libyan bank exports); digits may be
 * Arabic-Indic; dates are day-first, as written in Libya, or Excel serials;
 * amounts may use either decimal convention and carry three decimals.
 */
import { createHash } from 'crypto';
import { isXlsx, readXlsxRows } from './xlsx';

export type Direction = 'CREDIT' | 'DEBIT';
export const FIELDS = ['date', 'amount', 'credit', 'debit', 'direction', 'reference', 'narration', 'name', 'account', 'bank', 'currency'] as const;
export type Field = (typeof FIELDS)[number];

export interface ParsedLine {
  row: number;
  direction: Direction;
  amount: string;
  currency: string;
  valueDate: Date;
  railRef: string | null;
  narration: string | null;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  counterpartyBank: string | null;
  raw: Record<string, string>;
}

export interface ParseOptions {
  /** Used when the file has no direction, sign or credit/debit columns (e.g. an incoming-only LyPay report). */
  defaultDirection?: Direction;
  currency?: string;
  /** Header text for a field, when automatic detection picks the wrong column. */
  mapping?: Partial<Record<Field, string>>;
}

export interface ParseResult {
  format: 'CSV' | 'XLSX';
  headerRow: number;
  headers: string[];
  columns: Partial<Record<Field, string>>;
  lines: ParsedLine[];
  skipped: Array<{ row: number; reason: string }>;
}

// ── Text helpers ─────────────────────────────────────────────────────

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
export function westernDigits(s: string): string {
  return s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10)).replace(/٫/g, '.').replace(/٬/g, ',');
}

function normHeader(s: string): string {
  return westernDigits(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    // eslint-disable-next-line no-misleading-character-class -- deliberately strips Arabic tatweel and harakat (combining marks)
    .replace(/[آأإ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\u0640\u064B-\u065F]/g, '')
    .toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
}

/** UTF-8 unless that produces replacement characters; then Windows-1256 (Arabic Windows). */
export function decodeText(buf: Buffer): string {
  const utf8 = buf.toString('utf8').replace(/^\uFEFF/, '');
  if (!utf8.includes('�')) return utf8;
  try { return new TextDecoder('windows-1256').decode(buf); } catch { return utf8; }
}

/** RFC 4180 CSV with the delimiter (comma, semicolon or tab) detected from the first lines. */
export function parseCsv(text: string): string[][] {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t'].map((d) => [d, sample.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

export function rowsFromFile(buf: Buffer): { rows: string[][]; format: 'CSV' | 'XLSX' } {
  if (isXlsx(buf)) return { rows: readXlsxRows(buf), format: 'XLSX' };
  if (buf.length >= 8 && buf.readUInt32LE(0) === 0xe011cfd0) throw new Error('Old .xls files are not supported. Save the statement as .xlsx or CSV and upload it again.');
  return { rows: parseCsv(decodeText(buf)), format: 'CSV' };
}

/** Decimal string (no sign) and whether the value was negative, or null. */
export function parseAmount(input: string): { value: string; negative: boolean } | null {
  let s = westernDigits(String(input ?? '')).replace(/LYD|د\.?\s?ل\.?|دينار|dinars?/gi, '').replace(/\s/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); } else if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  const value = `${int.replace(/^0+(?=\d)/, '')}${frac ? `.${frac.slice(0, 8)}` : ''}`;
  return { value, negative };
}

/** Libya is UTC+2 all year; statement times are local. */
const TRIPOLI_OFFSET_MS = 2 * 3600_000;
function localDate(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi, s) - TRIPOLI_OFFSET_MS;
  const check = new Date(t + TRIPOLI_OFFSET_MS);
  return check.getUTCDate() === d ? new Date(t) : null;
}

export function parseDate(input: string): Date | null {
  const s = westernDigits(String(input ?? '')).trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Excel serial date (days since 1899-12-30), fraction = time of day.
    const serial = Number(s);
    if (serial < 20_000 || serial > 80_000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000) - TRIPOLI_OFFSET_MS);
  }
  const time = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i);
  let h = time ? Number(time[1]) : 0;
  const mi = time ? Number(time[2]) : 0;
  const sec = time?.[3] ? Number(time[3]) : 0;
  if (time?.[4] && /pm|م/i.test(time[4]) && h < 12) h += 12;
  if (time?.[4] && /am|ص/i.test(time[4]) && h === 12) h = 0;
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) return localDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), h, mi, sec);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) return localDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), h, mi, sec);
  return null;
}

/**
 * Account identity for matching: digits only, the account part of a Libyan
 * IBAN, leading zeros dropped. Phone-number wallets (OnePay) reduce the same
 * way, so 0912345678 and 912345678 agree; +218… is caught by suffix matching.
 */
export function accountKey(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = westernDigits(String(input)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^LY\d{23}$/.test(s)) s = s.slice(-15);
  else if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) s = s.slice(4);
  const digits = s.replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 6 ? digits : null;
}

export function accountsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 8 && long.endsWith(short);
}

// ── Column detection ─────────────────────────────────────────────────

const SYNONYMS: Record<Field, string[]> = {
  date: ['date', 'value date', 'transaction date', 'posting date', 'trans date', 'تاريخ', 'التاريخ', 'تاريخ العمليه', 'تاريخ القيمه', 'تاريخ الحركه', 'تاريخ التحويل'],
  amount: ['amount', 'value', 'transaction amount', 'المبلغ', 'القيمه', 'قيمه العمليه', 'مبلغ العمليه', 'مبلغ التحويل'],
  credit: ['credit', 'credit amount', 'deposit', 'deposits', 'money in', 'incoming', 'دائن', 'ايداع', 'الايداع', 'وارد', 'المبلغ الدائن'],
  debit: ['debit', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'outgoing', 'مدين', 'سحب', 'السحب', 'صادر', 'المبلغ المدين'],
  direction: ['type', 'direction', 'dr cr', 'cr dr', 'transaction type', 'نوع العمليه', 'النوع', 'نوع الحركه', 'الاتجاه'],
  reference: ['reference', 'ref', 'reference number', 'transaction id', 'txn id', 'rrn', 'trace number', 'الرقم المرجعي', 'رقم المرجع', 'رقم العمليه', 'رقم الحركه', 'المرجع', 'رقم الاشاره'],
  narration: ['description', 'narration', 'details', 'remarks', 'memo', 'purpose', 'البيان', 'الوصف', 'التفاصيل', 'ملاحظات', 'الغرض'],
  name: ['sender', 'sender name', 'beneficiary', 'beneficiary name', 'counterparty', 'counterparty name', 'name', 'payer', 'payer name', 'customer name', 'اسم المرسل', 'المرسل', 'اسم المستفيد', 'المستفيد', 'الاسم', 'اسم صاحب الحساب', 'اسم العميل', 'اسم الطرف الاخر'],
  account: ['account', 'account number', 'account no', 'iban', 'sender account', 'beneficiary account', 'wallet', 'phone', 'mobile', 'رقم الحساب', 'حساب المرسل', 'حساب المستفيد', 'الايبان', 'رقم المحفظه', 'رقم الهاتف'],
  bank: ['bank', 'bank name', 'sender bank', 'beneficiary bank', 'المصرف', 'البنك', 'مصرف المرسل', 'مصرف المستفيد', 'اسم المصرف'],
  currency: ['currency', 'ccy', 'العمله'],
};
const NOT_AMOUNT = /balance|رصيد/;

function detectColumns(headers: string[], mapping?: Partial<Record<Field, string>>): Partial<Record<Field, number>> {
  const norm = headers.map(normHeader);
  const out: Partial<Record<Field, number>> = {};
  const taken = new Set<number>();
  for (const f of FIELDS) {
    const wanted = mapping?.[f];
    if (!wanted) continue;
    const at = norm.indexOf(normHeader(wanted));
    if (at < 0) throw new Error(`Column "${wanted}" (${f}) is not in the file`);
    out[f] = at; taken.add(at);
  }
  // Exact header names first, then headers that contain a known name.
  for (const pass of ['exact', 'contains'] as const) {
    for (const f of FIELDS) {
      if (out[f] !== undefined) continue;
      const syns = SYNONYMS[f].map(normHeader);
      const at = norm.findIndex((h, i) => !taken.has(i) && h !== '' && !(['amount', 'credit', 'debit'].includes(f) && NOT_AMOUNT.test(h))
        && (pass === 'exact' ? syns.includes(h) : syns.some((s) => s.length >= 3 && (h.includes(s) || (h.length >= 4 && s.includes(h))))));
      if (at >= 0) { out[f] = at; taken.add(at); }
    }
  }
  return out;
}

function findHeaderRow(rows: string[][], mapping?: Partial<Record<Field, string>>): number {
  let best = -1;
  let bestHits = 0;
  let mappingError: Error | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    let cols: Partial<Record<Field, number>>;
    try { cols = detectColumns(rows[i], mapping); } catch (e) { mappingError ??= e as Error; continue; }
    const hasAmount = cols.amount !== undefined || cols.credit !== undefined || cols.debit !== undefined;
    const hits = Object.keys(cols).length;
    if (hasAmount && cols.date !== undefined && hits > bestHits) { best = i; bestHits = hits; }
  }
  if (best < 0 && mappingError) throw mappingError;
  if (best < 0) throw new Error('Could not find the header row: the file needs a date column and an amount (or credit/debit) column. Set the column names manually.');
  return best;
}

// Matched word by word: JavaScript's \b does not treat Arabic letters as word characters.
const CREDIT_WORDS = new Set(['cr', 'c', 'credit', 'in', 'incoming', 'deposit', 'received', 'دائن', 'ايداع', 'وارد', 'استلام', 'مستلم']);
const DEBIT_WORDS = new Set(['dr', 'd', 'debit', 'out', 'outgoing', 'withdrawal', 'sent', 'مدين', 'سحب', 'صادر', 'مرسل']);
function directionWord(v: string): Direction | null {
  const words = normHeader(v).split(' ').filter(Boolean);
  if (words.some((w) => CREDIT_WORDS.has(w))) return 'CREDIT';
  if (words.some((w) => DEBIT_WORDS.has(w))) return 'DEBIT';
  return null;
}

export function parseStatementRows(rows: string[][], format: 'CSV' | 'XLSX', opts: ParseOptions = {}): ParseResult {
  const headerRow = findHeaderRow(rows, opts.mapping);
  const headers = rows[headerRow];
  const idx = detectColumns(headers, opts.mapping);
  const cell = (r: string[], f: Field) => (idx[f] === undefined ? '' : String(r[idx[f]!] ?? '').trim());
  const lines: ParsedLine[] = [];
  const skipped: ParseResult['skipped'] = [];
  // One signed amount column: if any amount is negative, positive ones are money in.
  const signedFile = idx.amount !== undefined && rows.slice(headerRow + 1).some((r) => parseAmount(cell(r, 'amount'))?.negative);

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 1;
    const raw: Record<string, string> = {};
    headers.forEach((h, c) => { if (h && r[c] !== undefined && r[c] !== '') raw[h] = r[c]; });
    const valueDate = parseDate(cell(r, 'date'));
    if (!valueDate) { skipped.push({ row: rowNo, reason: cell(r, 'date') ? `Unreadable date "${cell(r, 'date')}"` : 'No date (summary or blank row)' }); continue; }

    let direction: Direction | null = null;
    let amount: { value: string; negative: boolean } | null = null;
    const credit = parseAmount(cell(r, 'credit'));
    const debit = parseAmount(cell(r, 'debit'));
    if (credit && Number(credit.value) > 0) { direction = 'CREDIT'; amount = credit; }
    else if (debit && Number(debit.value) > 0) { direction = 'DEBIT'; amount = debit; }
    else {
      amount = parseAmount(cell(r, 'amount'));
      if (amount) {
        direction = directionWord(cell(r, 'direction'))
          ?? (amount.negative ? 'DEBIT' : signedFile ? 'CREDIT' : opts.defaultDirection ?? null);
      }
    }
    if (!amount || Number(amount.value) <= 0) { skipped.push({ row: rowNo, reason: 'No amount' }); continue; }
    if (!direction) { skipped.push({ row: rowNo, reason: 'Money in or out is not shown; choose a default direction for this file' }); continue; }

    const text = (f: Field) => cell(r, f) || null;
    lines.push({
      row: rowNo,
      direction,
      amount: amount.value,
      currency: (text('currency') ?? opts.currency ?? 'LYD').toUpperCase().replace(/^(د\.?ل\.?|دينار.*|434)$/, 'LYD').slice(0, 8),
      valueDate,
      railRef: text('reference'),
      narration: text('narration'),
      counterpartyName: text('name'),
      counterpartyAccount: text('account') ? westernDigits(text('account')!) : null,
      counterpartyBank: text('bank'),
      raw,
    });
  }
  const columns: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) if (idx[f] !== undefined) columns[f] = headers[idx[f]!];
  return { format, headerRow: headerRow + 1, headers, columns, lines, skipped };
}

export function parseStatementFile(buf: Buffer, opts: ParseOptions = {}): ParseResult {
  const { rows, format } = rowsFromFile(buf);
  if (!rows.length) throw new Error('The file is empty');
  return parseStatementRows(rows, format, opts);
}

/**
 * Identity of a statement line across imports, so overlapping statements
 * don't duplicate it. The rail's own reference is used when present; two
 * identical rows in one file are kept apart by their position among equals.
 */
export function dedupeKey(source: string, line: Pick<ParsedLine, 'direction' | 'amount' | 'valueDate' | 'railRef' | 'narration' | 'counterpartyAccount'>, occurrence: number): string {
  const parts = line.railRef
    ? [source, 'ref', line.railRef.trim().toUpperCase()]
    : [source, line.direction, line.amount, line.valueDate.toISOString().slice(0, 10), accountKey(line.counterpartyAccount) ?? '', (line.narration ?? '').trim().toUpperCase(), String(occurrence)];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
