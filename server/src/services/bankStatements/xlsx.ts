/**
 * Minimal .xlsx reader: the first worksheet as rows of strings.
 *
 * Bank and rail portals export statements as Excel files. An .xlsx file is a
 * ZIP of XML parts, so Node's zlib is enough to read the cell values; no
 * spreadsheet dependency is needed. Formulas, styles and dates-as-styles are
 * ignored: a date cell comes back as its Excel serial number, which the
 * statement parser converts.
 *
 * Old binary .xls files are not supported (save them as .xlsx or CSV).
 */
import { inflateRawSync } from 'zlib';

const MAX_PART_BYTES = 64 * 1024 * 1024;

function zipEntries(buf: Buffer): Map<string, { method: number; size: number; offset: number }> {
  // End of central directory: the last 0x06054b50 in the final 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not an .xlsx file (no ZIP directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, { method: number; size: number; offset: number }>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('Corrupt .xlsx file');
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const offset = buf.readUInt32LE(at + 42);
    out.set(buf.toString('utf8', at + 46, at + 46 + nameLen), { method, size, offset });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function readPart(buf: Buffer, entries: ReturnType<typeof zipEntries>, name: string): string | null {
  const e = entries.get(name);
  if (!e) return null;
  if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw new Error('Corrupt .xlsx file');
  const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
  // The central directory's size: the local header's is 0 when the writer
  // used a trailing data descriptor.
  const data = buf.subarray(start, start + e.size);
  if (e.method === 0) return data.toString('utf8');
  if (e.method !== 8) throw new Error('Unsupported .xlsx compression');
  return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString('utf8');
}

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Concatenated text of every <t> inside a fragment (rich text has several runs). */
function textOf(fragment: string): string {
  let s = '';
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += decodeXml(m[1]);
  return s;
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function isXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
}

export function readXlsxRows(buf: Buffer): string[][] {
  const entries = zipEntries(buf);
  const shared: string[] = [];
  const sst = readPart(buf, entries, 'xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));

  // First sheet in workbook order, resolved through the workbook relations.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = readPart(buf, entries, 'xl/workbook.xml');
  const rels = readPart(buf, entries, 'xl/_rels/workbook.xml.rels');
  const firstId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (firstId && rels) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${firstId}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheet = readPart(buf, entries, sheetPath);
  if (!sheet) throw new Error('The workbook has no worksheet');

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (v !== undefined) value = decodeXml(v);
      const col = ref ? columnIndex(ref) : row.length;
      while (row.length < col) row.push('');
      row[col] = value;
    }
    rows.push(row);
  }
  return rows;
}
