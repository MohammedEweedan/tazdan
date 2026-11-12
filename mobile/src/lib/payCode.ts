/**
 * What a scanned code (or a pay deep link) asks for. One parser, so the
 * scanner and the Pay page never read the same code two ways.
 *
 *   Pay:    https://tazdan.com/u/<handle>      (the Receive screen's QR)
 *           https://tazdan.com/pay/<handle>
 *           tazdan://u/<handle> · tazdan://pay/<handle> · @handle
 *           optional ?amount=25.5&currency=LYD&ref=INV-1042 — the amount
 *           only counts together with a currency, never on its own.
 *   Claim:  https://tazdan.com/claim/<token> · tazdan://claim/<token>
 *
 * <handle> may also be a user id: accounts without a handle show their id.
 */
import { CURRENCY_META } from '@/constants';

/** `till`: the business till a code belongs to (attribution for per-till metrics). */
export type PayPreset = { amount?: string; currency?: string; reference?: string; till?: string };
export type ScannedCode =
  | { kind: 'claim'; token: string }
  | ({ kind: 'pay'; payee: string } & PayPreset);

const HOST = '(?:[^/?#]+\\.)?tazdan\\.(?:com|app)';
const PAYEE = '([A-Za-z0-9._-]{1,64})';
// SECURITY: localhost claim links are dev-only. In a release build a QR
// pointing at a local process could have the claim flow credit whatever that
// process answered.
const CLAIM_RE = __DEV__
  ? new RegExp(`(?:tazdan://claim/|https?://${HOST}/claim/|https?://localhost:\\d+/claim/)([a-zA-Z0-9]+)`, 'i')
  : new RegExp(`(?:tazdan://claim/|https?://${HOST}/claim/)([a-zA-Z0-9]+)`, 'i');
// iOS lowercases custom URL schemes it hands back, so match case-insensitively.
const PAY_URL_RE = new RegExp(`^(?:tazdan://|https?://${HOST}/)(?:u|pay)/${PAYEE}`, 'i');
const HANDLE_RE = /^@?([A-Za-z0-9_]{3,30})$/;
const AMOUNT_RE = /^\d{1,12}(?:\.\d{1,8})?$/;

function queryOf(url: string): Record<string, string> {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    const [k, v = ''] = part.split('=');
    if (!k) continue;
    try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { /* skip malformed pair */ }
  }
  return out;
}

/**
 * Validates an amount/currency/reference from a code or route params.
 * Returns null when the code asks for something the app can't honour (e.g. an
 * unknown currency) — paying a different currency than asked must never be
 * the fallback.
 */
export function presetFrom(raw: { amount?: string; currency?: string; ref?: string; till?: string }): PayPreset | null {
  const preset: PayPreset = {};
  const currency = raw.currency?.trim().toUpperCase();
  if (currency) {
    if (!(currency in CURRENCY_META)) return null;
    preset.currency = currency;
  }
  const amount = raw.amount?.trim();
  if (amount && currency) {
    if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) return null;
    preset.amount = amount;
  }
  // Control and bidi-override characters out (a reversed reference could
  // read as something else), length capped: it becomes the transfer note.
  const reference = raw.ref?.replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 40);
  if (reference) preset.reference = reference;
  // A till id is a UUID; anything else is dropped rather than sent on.
  const till = raw.till?.trim();
  if (till && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(till)) preset.till = till;
  return preset;
}

export function parseScannedCode(data: string): ScannedCode | null {
  const text = data.trim();
  const claim = text.match(CLAIM_RE);
  if (claim) return { kind: 'claim', token: claim[1] };

  const url = text.match(PAY_URL_RE);
  if (url) {
    const q = queryOf(text);
    const preset = presetFrom({ amount: q.amount, currency: q.currency, ref: q.ref, till: q.till });
    return preset ? { kind: 'pay', payee: url[1], ...preset } : null;
  }

  const handle = text.match(HANDLE_RE);
  if (handle) return { kind: 'pay', payee: handle[1] };
  return null;
}
