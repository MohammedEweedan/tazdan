/**
 * Minimal RFC 4180 CSV parser that works on a stream of text chunks, so a
 * large file (the UK sanctions list is ~50 MB) never has to sit in memory as
 * one string. Handles quoted fields, escaped quotes ("") and newlines inside
 * quotes. Rows are emitted as string arrays.
 */
export class CsvParser {
  private field = '';
  private row: string[] = [];
  private inQuotes = false;
  private pendingQuote = false; // saw a quote inside a quoted field; next char decides
  private bom = true;

  constructor(private readonly onRow: (row: string[]) => void) {}

  push(chunk: string): void {
    let start = 0;
    if (this.bom && chunk.charCodeAt(0) === 0xfeff) start = 1;
    this.bom = false;
    for (let i = start; i < chunk.length; i++) {
      const c = chunk[i];
      if (this.pendingQuote) {
        this.pendingQuote = false;
        if (c === '"') { this.field += '"'; continue; } // escaped quote
        this.inQuotes = false; // closing quote; fall through to handle c
      }
      if (this.inQuotes) {
        if (c === '"') this.pendingQuote = true;
        else this.field += c;
        continue;
      }
      if (c === '"' && this.field === '') { this.inQuotes = true; continue; }
      if (c === ',') { this.row.push(this.field); this.field = ''; continue; }
      if (c === '\n') { this.endRow(); continue; }
      if (c === '\r') continue;
      this.field += c;
    }
  }

  end(): void {
    if (this.pendingQuote) { this.pendingQuote = false; this.inQuotes = false; }
    if (this.field !== '' || this.row.length) this.endRow();
  }

  private endRow(): void {
    this.row.push(this.field);
    this.field = '';
    const r = this.row;
    this.row = [];
    if (r.length === 1 && r[0] === '') return; // blank line
    this.onRow(r);
  }
}

/** Parse a whole CSV string (small files). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const p = new CsvParser((r) => rows.push(r));
  p.push(text);
  p.end();
  return rows;
}
