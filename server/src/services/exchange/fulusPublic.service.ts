/** Fulus's public cash-rate cards are PNGs, not text. Read only those cards;
 * never parse the example prices or update counters elsewhere on the page. */
import axios from 'axios';
import { createHash } from 'crypto';
import { createWorker, PSM, type Worker } from 'tesseract.js';

export interface PublicFulusRate { currency: string; rate: number; publishedAt: number; checkedAt: number }
interface RateCard { currency: string; image: Buffer; publishedAt: number }

const REFRESH_MS = 60_000;
let nextCheck = 0;
let pending: Promise<PublicFulusRate[]> | null = null;
let latest: PublicFulusRate[] = [];
const decoded = new Map<string, { hash: string; rate: number }>();

export function parseFulusRateCards(html: string, now = Date.now()): RateCard[] {
  const cards: RateCard[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const currency = match[0].match(/\balt=["'](USD|EUR) Rate["']/i)?.[1]?.toUpperCase();
    const encoded = match[0].match(/\bsrc=["']data:image\/png;base64,([A-Za-z0-9+/=]+)["']/i)?.[1];
    if (!currency || !encoded || encoded.length > 100_000) continue;
    const following = html.slice(match.index! + match[0].length, match.index! + match[0].length + 250);
    const age = following.match(/>\s*(\d+|a|an)\s+(second|minute|hour|day)s?\s+ago\s*</i);
    if (!age) continue; // No published time: don't silently present it as fresh.
    const amount = /^a(n)?$/i.test(age[1]) ? 1 : Number(age[1]);
    const unit = { second: 1000, minute: 60_000, hour: 3600_000, day: 86400_000 }[age[2].toLowerCase()];
    const image = Buffer.from(encoded, 'base64');
    // Bound decoder work to the small, expected PNG cards.
    if (image.length < 24 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') continue;
    const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
    if (!width || !height || width > 1200 || height > 600) continue;
    cards.push({ currency, image, publishedAt: now - amount * unit! });
  }
  return cards;
}

/** Confidence validates the reading, never the size or movement of the rate. */
export function parseFulusCardReading(text: string, confidence: number): number | null {
  const value = text.trim();
  if (!Number.isFinite(confidence) || confidence < 85 || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function refresh(): Promise<PublicFulusRate[]> {
  let worker: Worker | undefined;
  try {
    const response = await axios.get<string>('https://fulus.ly/', {
      responseType: 'text', timeout: 5000, maxContentLength: 512_000,
      headers: { Accept: 'text/html', 'Accept-Language': 'en' },
      ...({ insecureHTTPParser: true } as Record<string, unknown>),
    });
    if (typeof response.data !== 'string') return latest;
    const checkedAt = Date.now();
    const result: PublicFulusRate[] = [];
    for (const card of parseFulusRateCards(response.data, checkedAt)) {
      const hash = createHash('sha256').update(card.image).digest('hex');
      const previous = decoded.get(card.currency);
      let rate = previous?.hash === hash ? previous.rate : null;
      if (rate == null) {
        if (!worker) {
          // Bundled language data: no runtime CDN download or writable cache.
          const { langPath } = require('@tesseract.js-data/eng') as { langPath: string };
          worker = await createWorker('eng', 1, { langPath, cacheMethod: 'none' });
          await worker.setParameters({ tessedit_char_whitelist: '0123456789.', tessedit_pageseg_mode: PSM.SINGLE_LINE });
        }
        const { data } = await worker.recognize(card.image);
        rate = parseFulusCardReading(data.text, data.confidence);
        if (rate != null) decoded.set(card.currency, { hash, rate });
      }
      if (rate != null) result.push({ currency: card.currency, rate, publishedAt: card.publishedAt, checkedAt });
    }
    if (result.length) latest = result;
    return latest;
  } catch {
    return latest; // Preserve the last observation and its original timestamp.
  } finally {
    await worker?.terminate();
  }
}

/** One request per minute per server, shared across currencies and callers. */
export async function getPublicFulusRates(): Promise<PublicFulusRate[]> {
  if (pending) return pending;
  if (Date.now() < nextCheck) return latest;
  nextCheck = Date.now() + REFRESH_MS;
  pending = refresh();
  try { return await pending; } finally { pending = null; }
}
