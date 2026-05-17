/**
 * Country catalogue — primary source: REST Countries
 * (https://restcountries.com/v3.1/all). On boot or first call we fetch
 * a slimmed-down version, cache in memory for 24h, and surface it via
 * `listCountries()` / `getCountry(cca2)`.
 *
 * When the upstream is unreachable we fall back to the bundled JSON
 * snapshot at `../../data/countries.fallback.json`, which is generated
 * from REST Countries and committed to the repo. The country list must
 * be available for the deposit / withdraw / signup flows to render, so
 * we trade a few KB of bundled data for offline reliability.
 */
import fs from 'fs';
import path from 'path';

export interface Country {
  cca2: string;        // ISO 3166-1 alpha-2
  cca3: string;        // ISO 3166-1 alpha-3
  name: string;
  flag: string;        // emoji
  region?: string;
  currencies: string[]; // ISO 4217 codes
  dialCode?: string;    // E.164 dial code (no leading +)
}

const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,currencies,flag,region,idd';
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { fetchedAt: number; countries: Country[] } | null = null;
let inflight: Promise<Country[]> | null = null;

function normalize(raw: any): Country | null {
  const cca2 = String(raw?.cca2 ?? '').toUpperCase();
  if (cca2.length !== 2) return null;
  const currencies = raw?.currencies && typeof raw.currencies === 'object'
    ? Object.keys(raw.currencies)
    : [];
  const idd = raw?.idd;
  let dialCode: string | undefined;
  if (idd?.root) {
    const suffix = Array.isArray(idd?.suffixes) && idd.suffixes.length === 1 ? idd.suffixes[0] : '';
    dialCode = (String(idd.root) + String(suffix)).replace(/[^0-9]/g, '');
  }
  return {
    cca2,
    cca3: String(raw?.cca3 ?? '').toUpperCase(),
    name: typeof raw?.name?.common === 'string' ? raw.name.common : String(raw?.name ?? cca2),
    flag: typeof raw?.flag === 'string' ? raw.flag : '',
    region: typeof raw?.region === 'string' ? raw.region : undefined,
    currencies,
    dialCode,
  };
}

function readFallback(): Country[] {
  // Resolve the fallback JSON via two candidate paths so it works both in
  // dev (ts-node-dev → src/data) and in prod (compiled dist → src/data
  // sibling). We don't copy the JSON to dist on build, so always read
  // from the source tree.
  const candidates = [
    path.join(__dirname, '..', '..', 'data', 'countries.fallback.json'),
    path.join(process.cwd(), 'src', 'data', 'countries.fallback.json'),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) return json as Country[];
    } catch { /* try next */ }
  }
  console.warn('[countryProvider] fallback read failed — both candidate paths missing');
  return [];
}

async function fetchFromUpstream(): Promise<Country[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(REST_COUNTRIES_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('bad upstream payload');
    const list = (json as any[]).map(normalize).filter((c): c is Country => c !== null);
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  } finally {
    clearTimeout(t);
  }
}

export async function listCountries(): Promise<Country[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.countries;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const list = await fetchFromUpstream();
      cache = { fetchedAt: Date.now(), countries: list };
      return list;
    } catch (e) {
      console.warn('[countryProvider] upstream failed, falling back to bundled data', e);
      const list = readFallback();
      cache = { fetchedAt: Date.now(), countries: list };
      return list;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getCountry(cca2: string): Promise<Country | null> {
  const list = await listCountries();
  const u = cca2.toUpperCase();
  return list.find((c) => c.cca2 === u) ?? null;
}

/** Force a re-fetch on the next call. */
export function invalidateCountriesCache() {
  cache = null;
}
