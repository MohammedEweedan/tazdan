/**
 * Statement parsing: LyPay / OnePay / bank exports in Arabic or English,
 * UTF-8 or Windows-1256, CSV or .xlsx.
 */
import { deflateRawSync } from 'zlib';
import { accountKey, accountsMatch, dedupeKey, parseAmount, parseDate, parseStatementFile } from '../services/bankStatements/parse';

/** A minimal .xlsx (ZIP of XML parts) with shared strings and one sheet. */
function makeXlsx(rows: Array<Array<string | number>>): Buffer {
  const strings: string[] = [];
  const sid = (s: string) => { const i = strings.indexOf(s); return i >= 0 ? i : strings.push(s) - 1; };
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (typeof v === 'number'
    ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>`
    : `<c r="${col(ci)}${ri + 1}" t="s"><v>${sid(v)}</v></c>`)).join('')}</row>`).join('');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts: Record<string, string> = {
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Statement" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const data = deflateRawSync(Buffer.from(text, 'utf8'));
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22); local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(Buffer.byteLength(text), 24); cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(parts).length, 8); eocd.writeUInt16LE(Object.keys(parts).length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

describe('amounts, dates and accounts', () => {
  it('reads both decimal conventions, Arabic-Indic digits, signs and dinar labels', () => {
    expect(parseAmount('1,250.500')).toEqual({ value: '1250.500', negative: false });
    expect(parseAmount('1.250,500')).toEqual({ value: '1250.500', negative: false });
    expect(parseAmount('١٬٢٥٠٫٥')).toEqual({ value: '1250.5', negative: false });
    expect(parseAmount('(300.000)')).toEqual({ value: '300.000', negative: true });
    expect(parseAmount('-75 د.ل')).toEqual({ value: '75', negative: true });
    expect(parseAmount('2,000')).toEqual({ value: '2000', negative: false });
    expect(parseAmount('abc')).toBeNull();
  });

  it('reads Libyan day-first dates as Tripoli time, ISO dates and Excel serials', () => {
    expect(parseDate('14/11/2026 10:30')!.toISOString()).toBe('2026-11-14T08:30:00.000Z');
    expect(parseDate('٠٣/٠٢/٢٠٢٦')!.toISOString()).toBe('2026-02-02T22:00:00.000Z');
    expect(parseDate('2026-11-14')!.toISOString()).toBe('2026-11-13T22:00:00.000Z');
    expect(parseDate('46340')!.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(parseDate('31/02/2026')).toBeNull();
  });

  it('treats an IBAN, the plain account number and a wallet phone number as the same account', () => {
    expect(accountKey('LY83 0020 4800 0020 1001 2036 1')).toBe('20100120361');
    expect(accountKey('020100120361')).toBe('20100120361');
    expect(accountsMatch(accountKey('0912345678'), accountKey('+218 91 234 5678'))).toBe(true);
    expect(accountsMatch(accountKey('12345678901'), accountKey('99945678901'))).toBe(false);
    expect(accountKey('12')).toBeNull();
  });
});

describe('statement files', () => {
  it('finds Arabic columns below a title row and keeps money in and out apart', () => {
    const csv = [
      'كشف حساب - مصرف الجمهورية',
      'التاريخ,البيان,اسم المرسل,رقم الحساب,دائن,مدين,الرصيد',
      '14/11/2026,DEP-MH2X9A-7F3C1B2A,محمد علي الورفلي,LY83002048000020100120361,"1,500.000",,9000',
      '14/11/2026,سحب,سالم,,,250.500,8749.5',
      'الإجمالي,,,,1500,250.5,',
    ].join('\n');
    const r = parseStatementFile(Buffer.from(csv, 'utf8'));
    expect(r.headerRow).toBe(2);
    expect(r.columns).toMatchObject({ date: 'التاريخ', narration: 'البيان', name: 'اسم المرسل', account: 'رقم الحساب', credit: 'دائن', debit: 'مدين' });
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ direction: 'CREDIT', amount: '1500.000', counterpartyName: 'محمد علي الورفلي', currency: 'LYD' });
    expect(r.lines[1]).toMatchObject({ direction: 'DEBIT', amount: '250.500' });
    expect(r.skipped).toEqual([{ row: 5, reason: 'Unreadable date "الإجمالي"' }]);
  });

  it('decodes Windows-1256 exports (common for Libyan banks)', () => {
    const text = 'التاريخ;المبلغ;اسم المرسل\n01/11/2026;300;أحمد\n';
    // Encode to Windows-1256 by mapping each Arabic letter to its code page byte.
    const cp1256: Record<string, number> = { 'ا': 0xc7, 'ل': 0xe1, 'ت': 0xca, 'ر': 0xd1, 'ي': 0xed, 'خ': 0xce, 'م': 0xe3, 'ب': 0xc8, 'غ': 0xdb, 'س': 0xd3, 'أ': 0xc3, 'ح': 0xcd, 'د': 0xcf };
    const bytes = Buffer.from([...text].map((ch) => cp1256[ch] ?? ch.charCodeAt(0)));
    const r = parseStatementFile(bytes, { defaultDirection: 'CREDIT' });
    expect(r.lines[0]).toMatchObject({ amount: '300', counterpartyName: 'أحمد', direction: 'CREDIT' });
  });

  it('uses signs, a direction column or the chosen default to tell money in from money out', () => {
    const signed = parseStatementFile(Buffer.from('Date,Amount,Description\n2026-11-01,500,in\n2026-11-02,-200,out\n'));
    expect(signed.lines.map((l) => l.direction)).toEqual(['CREDIT', 'DEBIT']);
    const typed = parseStatementFile(Buffer.from('Date,Amount,Type\n2026-11-01,500,وارد\n2026-11-02,200,تحويل صادر\n'));
    expect(typed.lines.map((l) => l.direction)).toEqual(['CREDIT', 'DEBIT']);
    const unknown = parseStatementFile(Buffer.from('Date,Amount\n2026-11-01,500\n'));
    expect(unknown.lines).toHaveLength(0);
    expect(unknown.skipped[0].reason).toMatch(/default direction/);
    expect(parseStatementFile(Buffer.from('Date,Amount\n2026-11-01,500\n'), { defaultDirection: 'CREDIT' }).lines[0].direction).toBe('CREDIT');
  });

  it('honours a manual column mapping and refuses a missing column', () => {
    const csv = 'When,How much,Who\n01/11/2026,90,Ali\n';
    const r = parseStatementFile(Buffer.from(csv), { mapping: { date: 'When', amount: 'How much', name: 'Who' }, defaultDirection: 'CREDIT' });
    expect(r.lines[0]).toMatchObject({ amount: '90', counterpartyName: 'Ali' });
    expect(() => parseStatementFile(Buffer.from(csv), { mapping: { date: 'Nope' } })).toThrow(/not in the file/);
  });

  it('reads .xlsx statements, including Excel date serials', () => {
    const buf = makeXlsx([
      ['OnePay transactions'],
      ['Transaction Date', 'Amount', 'Type', 'Sender Name', 'Wallet', 'Reference'],
      [46340.5, '1000', 'Credit', 'Omar Salem', '0912345678', 'OP-77812'],
    ]);
    const r = parseStatementFile(buf);
    expect(r.format).toBe('XLSX');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ direction: 'CREDIT', amount: '1000', counterpartyName: 'Omar Salem', counterpartyAccount: '0912345678', railRef: 'OP-77812' });
  });

  it('refuses old binary .xls files with a clear message', () => {
    const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(() => parseStatementFile(xls)).toThrow(/\.xls files are not supported/);
  });

  it('de-duplicates by rail reference, or by content and position among identical rows', () => {
    const base = { direction: 'CREDIT' as const, amount: '50', valueDate: new Date('2026-11-01T08:00:00Z'), narration: 'x', counterpartyAccount: null };
    expect(dedupeKey('LYPAY', { ...base, railRef: 'R1' }, 0)).toBe(dedupeKey('LYPAY', { ...base, railRef: 'R1', amount: '51' }, 3));
    expect(dedupeKey('LYPAY', { ...base, railRef: null }, 0)).not.toBe(dedupeKey('LYPAY', { ...base, railRef: null }, 1));
    expect(dedupeKey('LYPAY', { ...base, railRef: 'R1' }, 0)).not.toBe(dedupeKey('ONEPAY', { ...base, railRef: 'R1' }, 0));
  });
});
