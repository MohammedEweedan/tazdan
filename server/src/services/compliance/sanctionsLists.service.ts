/**
 * Official sanctions lists, downloaded and kept current automatically.
 *
 *   UN       UN Security Council Consolidated List (XML)
 *   OFAC-SDN US Treasury OFAC Specially Designated Nationals (CSV + aliases
 *            + addresses), including the digital currency addresses OFAC
 *            publishes in its remarks (screened as WALLET entries)
 *   UK       UK Sanctions List published by the FCDO (CSV). It replaced the
 *            OFSI Consolidated List, which stopped updating in 2026.
 *
 * Each refresh replaces one list's entries in place: entries keep their id
 * (keyed by the list's own identifier), changed entries are updated, new ones
 * created and delisted ones deactivated. A download that parses to far fewer
 * entries than are loaded (truncated file, format change) is rejected rather
 * than allowed to wipe coverage. Results are recorded per list in
 * PlatformSettings (`sanctions_list.<NAME>`) and the audit log.
 *
 * Runs daily on the scheduler worker (SANCTIONS_AUTO_REFRESH=0 turns it off),
 * and on demand from the cockpit. The EU list needs a registration token and
 * PEP data needs a vendor; both can still be imported through the cockpit.
 */
import axios from 'axios';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { CsvParser, parseCsv } from '../../utils/csv';
import { invalidateTokenWeights, normalizeName } from './screening.service';
import countries from '../../data/countries.fallback.json';

export type ListName = 'UN' | 'OFAC-SDN' | 'UK';
export const LIST_NAMES: ListName[] = ['UN', 'OFAC-SDN', 'UK'];

export const SOURCES = {
  UN: process.env.SANCTIONS_UN_URL ?? 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
  OFAC_SDN: process.env.SANCTIONS_OFAC_SDN_URL ?? 'https://www.treasury.gov/ofac/downloads/sdn.csv',
  OFAC_ALT: process.env.SANCTIONS_OFAC_ALT_URL ?? 'https://www.treasury.gov/ofac/downloads/alt.csv',
  OFAC_ADD: process.env.SANCTIONS_OFAC_ADD_URL ?? 'https://www.treasury.gov/ofac/downloads/add.csv',
  UK: process.env.SANCTIONS_UK_URL ?? 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
};

export interface ListRecord {
  identifier: string;
  entityType: 'PERSON' | 'ORGANISATION' | 'VESSEL' | 'AIRCRAFT' | 'WALLET';
  name: string;
  aliases: string[];
  country: string | null;
  dateOfBirth: string | null;
  walletAddress: string | null;
}

// ── Countries (list names → ISO 3166 alpha-2) ──────────────────────────
const COUNTRY_ALIASES: Record<string, string> = {
  'iran islamic republic of': 'IR', iran: 'IR', 'syrian arab republic': 'SY', syria: 'SY',
  'russian federation': 'RU', russia: 'RU', 'democratic peoples republic of korea': 'KP', 'north korea': 'KP',
  'korea democratic peoples republic of': 'KP', 'republic of korea': 'KR', 'south korea': 'KR',
  'democratic republic of the congo': 'CD', 'congo democratic republic of the': 'CD', 'congo': 'CG',
  'libyan arab jamahiriya': 'LY', libya: 'LY', 'united states': 'US', 'united states of america': 'US', usa: 'US',
  'united kingdom': 'GB', uk: 'GB', 'viet nam': 'VN', 'lao peoples democratic republic': 'LA', laos: 'LA',
  'bolivia plurinational state of': 'BO', 'venezuela bolivarian republic of': 'VE', venezuela: 'VE',
  'tanzania united republic of': 'TZ', 'moldova republic of': 'MD', turkiye: 'TR', turkey: 'TR',
  'palestinian territory': 'PS', palestine: 'PS', 'state of palestine': 'PS', 'west bank': 'PS', gaza: 'PS',
  'burma': 'MM', myanmar: 'MM', 'cote divoire': 'CI', 'ivory coast': 'CI', 'czech republic': 'CZ',
  'north macedonia': 'MK', 'the former yugoslav republic of macedonia': 'MK', 'kosovo': 'XK', 'crimea': 'UA',
};
const ISO_BY_NAME = new Map<string, string>();
const simplify = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
for (const c of countries as Array<{ cca2: string; name: string }>) ISO_BY_NAME.set(simplify(c.name), c.cca2);
for (const [k, v] of Object.entries(COUNTRY_ALIASES)) ISO_BY_NAME.set(simplify(k), v);

export function countryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = simplify(raw.split(/[;,(]/)[0] ?? '');
  if (!s) return null;
  if (/^[a-z]{2}$/.test(s)) return s.toUpperCase();
  return ISO_BY_NAME.get(s) ?? ISO_BY_NAME.get(simplify(raw)) ?? null;
}

// ── Dates of birth → YYYY-MM-DD or YYYY ────────────────────────────────
const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
export function normaliseDob(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^'/, '');
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/); // 10 Dec 1948
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  m = t.match(/(\d{4})/);
  return m ? m[1] : null;
}

/** All distinct birth dates, ';'-joined (screening compares every listed year). */
const joinDobs = (values: Array<string | null | undefined>): string | null => {
  const out = [...new Set(values.map(normaliseDob).filter((v): v is string => !!v))];
  return out.length ? out.join(';').slice(0, 120) : null;
};

// ── UN (XML) ───────────────────────────────────────────────────────────
const decodeXml = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');
const tag = (block: string, name: string): string | null => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) || null : null;
};
const blocks = (xml: string, name: string): string[] => xml.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, 'g')) ?? [];

export function parseUn(xml: string): ListRecord[] {
  const out: ListRecord[] = [];
  for (const b of blocks(xml, 'INDIVIDUAL')) {
    const name = ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME'].map((n) => tag(b, n)).filter(Boolean).join(' ');
    const aliases = blocks(b, 'INDIVIDUAL_ALIAS').map((a) => tag(a, 'ALIAS_NAME')).filter((a): a is string => !!a);
    const original = tag(b, 'NAME_ORIGINAL_SCRIPT');
    if (original) aliases.push(original);
    const dob = joinDobs(blocks(b, 'INDIVIDUAL_DATE_OF_BIRTH').map((d) => tag(d, 'DATE') ?? tag(d, 'YEAR')));
    const nationality = blocks(b, 'NATIONALITY').map((n) => tag(n, 'VALUE')).find(Boolean) ?? null;
    const id = tag(b, 'REFERENCE_NUMBER') ?? tag(b, 'DATAID');
    if (!name || !id) continue;
    out.push({ identifier: id, entityType: 'PERSON', name, aliases, country: countryCode(nationality), dateOfBirth: dob, walletAddress: null });
  }
  for (const b of blocks(xml, 'ENTITY')) {
    const name = tag(b, 'FIRST_NAME');
    const id = tag(b, 'REFERENCE_NUMBER') ?? tag(b, 'DATAID');
    if (!name || !id) continue;
    const aliases = blocks(b, 'ENTITY_ALIAS').map((a) => tag(a, 'ALIAS_NAME')).filter((a): a is string => !!a);
    const country = blocks(b, 'ENTITY_ADDRESS').map((a) => tag(a, 'COUNTRY')).find(Boolean) ?? null;
    out.push({ identifier: id, entityType: 'ORGANISATION', name, aliases, country: countryCode(country), dateOfBirth: null, walletAddress: null });
  }
  return out;
}

// ── OFAC SDN (CSV) ─────────────────────────────────────────────────────
const nil = (v: string | undefined) => (!v || v.trim() === '-0-' ? null : v.trim());
/** OFAC writes individuals as "LAST, First"; screen them as "First LAST". */
const personName = (n: string) => {
  const i = n.indexOf(', ');
  return i > 0 ? `${n.slice(i + 2)} ${n.slice(0, i)}`.trim() : n;
};

export function parseOfac(sdnCsv: string, altCsv: string, addCsv: string): ListRecord[] {
  const aliases = new Map<string, string[]>();
  for (const r of parseCsv(altCsv)) {
    const [ent, , , altName] = r;
    if (nil(ent) && nil(altName)) aliases.set(ent.trim(), [...(aliases.get(ent.trim()) ?? []), altName.trim()]);
  }
  const country = new Map<string, string>();
  for (const r of parseCsv(addCsv)) {
    const ent = nil(r[0]);
    const c = countryCode(nil(r[4]));
    if (ent && c && !country.has(ent)) country.set(ent, c);
  }
  const out: ListRecord[] = [];
  for (const r of parseCsv(sdnCsv)) {
    const ent = nil(r[0]);
    const rawName = nil(r[1]);
    if (!ent || !rawName || !/^\d+$/.test(ent)) continue;
    const kind = (nil(r[2]) ?? '').toLowerCase();
    const remarks = nil(r[11]) ?? '';
    const entityType: ListRecord['entityType'] = kind === 'individual' ? 'PERSON' : kind === 'vessel' ? 'VESSEL' : kind === 'aircraft' ? 'AIRCRAFT' : 'ORGANISATION';
    const name = entityType === 'PERSON' ? personName(rawName) : rawName;
    const alts = (aliases.get(ent) ?? []).map((a) => (entityType === 'PERSON' ? personName(a) : a));
    const nationality = remarks.match(/(?:nationality|Nationality) ([A-Z][A-Za-z ]+?)(?:;|\.|$)/)?.[1] ?? null;
    const dob = joinDobs([...remarks.matchAll(/DOB ([^;]+)/g)].map((m) => m[1]));
    out.push({
      identifier: ent, entityType, name, aliases: alts,
      country: countryCode(nationality) ?? country.get(ent) ?? null, dateOfBirth: dob, walletAddress: null,
    });
    for (const m of remarks.matchAll(/Digital Currency Address - ([A-Z0-9]+) ([A-Za-z0-9]+)/g)) {
      out.push({ identifier: `${ent}:${m[1]}:${m[2]}`, entityType: 'WALLET', name, aliases: [], country: null, dateOfBirth: null, walletAddress: m[2] });
    }
  }
  return out;
}

// ── UK Sanctions List (CSV, one row per name variant) ──────────────────
export function createUkParser(): { push: (chunk: string) => void; end: () => ListRecord[] } {
  let header: string[] | null = null;
  const byId = new Map<string, { kind: string; primary: string | null; names: Set<string>; dobs: string[]; country: string | null }>();
  const parser = new CsvParser((row) => {
    if (!header) {
      if (row.includes('Unique ID')) header = row;
      return; // "Report Date: …" line and the header row
    }
    const col = (n: string) => row[header!.indexOf(n)]?.trim() ?? '';
    const id = col('Unique ID');
    if (!id) return;
    const rec = byId.get(id) ?? { kind: col('Designation Type'), primary: null, names: new Set<string>(), dobs: [], country: null };
    const name = ['Name 1', 'Name 2', 'Name 3', 'Name 4', 'Name 5', 'Name 6'].map(col).filter(Boolean).join(' ');
    if (name) {
      if (!rec.primary && /^primary name$/i.test(col('Name type'))) rec.primary = name;
      rec.names.add(name);
    }
    const nonLatin = col('Name non-latin script');
    if (nonLatin) rec.names.add(nonLatin);
    if (col('D.O.B')) rec.dobs.push(col('D.O.B'));
    rec.country ??= countryCode(col('Nationality(/ies)')) ?? countryCode(col('Address Country'));
    byId.set(id, rec);
  });
  return {
    push: (chunk) => parser.push(chunk),
    end: () => {
      parser.end();
      const out: ListRecord[] = [];
      for (const [id, r] of byId) {
        const name = r.primary ?? [...r.names][0];
        if (!name) continue;
        const kind = r.kind.toLowerCase();
        out.push({
          identifier: id, entityType: kind === 'individual' ? 'PERSON' : kind === 'ship' ? 'VESSEL' : 'ORGANISATION',
          name, aliases: [...r.names].filter((n) => n !== name), country: r.country, dateOfBirth: joinDobs(r.dobs), walletAddress: null,
        });
      }
      return out;
    },
  };
}

// ── Download ───────────────────────────────────────────────────────────
const http = axios.create({ timeout: 180_000, maxContentLength: 200 * 1024 * 1024, headers: { 'User-Agent': 'Tazdan-Compliance/1.0 (sanctions screening)' } });
const getText = async (url: string) => (await http.get<string>(url, { responseType: 'text', transformResponse: (d) => d })).data;

async function fetchList(name: ListName): Promise<{ records: ListRecord[]; source: string }> {
  if (name === 'UN') return { records: parseUn(await getText(SOURCES.UN)), source: SOURCES.UN };
  if (name === 'OFAC-SDN') {
    const [sdn, alt, add] = await Promise.all([getText(SOURCES.OFAC_SDN), getText(SOURCES.OFAC_ALT), getText(SOURCES.OFAC_ADD)]);
    return { records: parseOfac(sdn, alt, add), source: SOURCES.OFAC_SDN };
  }
  const res = await http.get(SOURCES.UK, { responseType: 'stream' });
  const uk = createUkParser();
  await new Promise<void>((resolve, reject) => {
    res.data.setEncoding('utf8');
    res.data.on('data', (c: string) => uk.push(c));
    res.data.on('end', () => resolve());
    res.data.on('error', reject);
  });
  return { records: uk.end(), source: SOURCES.UK };
}

// ── Sync ───────────────────────────────────────────────────────────────
export interface SyncResult { list: ListName; ok: boolean; active: number; added: number; updated: number; removed: number; error?: string; syncedAt: string; source?: string }

const MIN_RATIO = () => Number(process.env.SANCTIONS_MIN_RATIO ?? '0.7');

/** Replace one list's entries with `records`. Exported for tests. */
export async function syncList(list: ListName, records: ListRecord[], source: string, actorId: string | null = null): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sanctions:${list}`}))`;
    const existing = await tx.watchlistEntry.findMany({ where: { listName: list, source: { startsWith: 'auto:' } } });
    const activeBefore = existing.filter((e) => e.active).length;
    // De-duplicate by identifier (a list can repeat an id across rows).
    const fresh = new Map<string, ListRecord>();
    for (const r of records) if (r.name || r.walletAddress) fresh.set(r.identifier, r);
    if (!fresh.size) throw new Error(`${list}: download parsed to no entries`);
    if (activeBefore >= 50 && fresh.size < activeBefore * MIN_RATIO()) {
      throw new Error(`${list}: download has ${fresh.size} entries against ${activeBefore} loaded; refusing to shrink coverage (check the source)`);
    }

    const byId = new Map(existing.map((e) => [e.identifier ?? '', e]));
    const toCreate: any[] = [];
    let updated = 0;
    for (const r of fresh.values()) {
      const data = {
        entityType: r.entityType, name: r.name, normalizedName: normalizeName(r.name),
        aliases: [...new Set(r.aliases.map((a) => normalizeName(a)).filter(Boolean))],
        country: r.country, dateOfBirth: r.dateOfBirth, walletAddress: r.walletAddress, active: true,
      };
      const prev = byId.get(r.identifier);
      if (!prev) {
        toCreate.push({ ...data, listName: list, identifier: r.identifier, source: `auto:${source}`, addedById: actorId });
        continue;
      }
      const changed = !prev.active || prev.name !== data.name || prev.normalizedName !== data.normalizedName
        || prev.country !== data.country || prev.dateOfBirth !== data.dateOfBirth || prev.walletAddress !== data.walletAddress
        || prev.entityType !== data.entityType || prev.aliases.join('|') !== data.aliases.join('|');
      if (changed) { await tx.watchlistEntry.update({ where: { id: prev.id }, data }); updated++; }
    }
    for (let i = 0; i < toCreate.length; i += 1000) await tx.watchlistEntry.createMany({ data: toCreate.slice(i, i + 1000) });
    const delisted = existing.filter((e) => e.active && !fresh.has(e.identifier ?? '')).map((e) => e.id);
    for (let i = 0; i < delisted.length; i += 1000) await tx.watchlistEntry.updateMany({ where: { id: { in: delisted.slice(i, i + 1000) } }, data: { active: false } });

    const result: SyncResult = { list, ok: true, active: fresh.size, added: toCreate.length, updated, removed: delisted.length, syncedAt, source };
    await tx.platformSettings.upsert({
      where: { key: `sanctions_list.${list}` },
      create: { key: `sanctions_list.${list}`, value: JSON.stringify(result), description: 'Last automatic sanctions list refresh' },
      update: { value: JSON.stringify(result) },
    });
    await tx.auditLog.create({ data: { userId: actorId, action: 'SANCTIONS_LIST_REFRESHED', entity: 'WatchlistEntry', entityId: list, newValues: result as any } });
    return result;
  }, { timeout: 300_000, maxWait: 30_000 }).finally(() => invalidateTokenWeights());
}

/** Download and sync the given lists (all by default). One failing list does not stop the others. */
export async function refreshSanctionsLists(opts: { lists?: ListName[]; actorId?: string | null } = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const list of opts.lists ?? LIST_NAMES) {
    try {
      const { records, source } = await fetchList(list);
      results.push(await syncList(list, records, source, opts.actorId ?? null));
      logger.info('[sanctions] list refreshed', results[results.length - 1]);
    } catch (e) {
      const error = (e as Error).message.slice(0, 500);
      const failed: SyncResult = { list, ok: false, active: 0, added: 0, updated: 0, removed: 0, error, syncedAt: new Date().toISOString() };
      const prev = await prisma.platformSettings.findUnique({ where: { key: `sanctions_list.${list}` } });
      const last = prev ? JSON.parse(prev.value) : null;
      await prisma.platformSettings.upsert({
        where: { key: `sanctions_list.${list}` },
        create: { key: `sanctions_list.${list}`, value: JSON.stringify(failed), description: 'Last automatic sanctions list refresh' },
        // Keep the last good sync visible alongside the failure.
        update: { value: JSON.stringify({ ...(last?.ok ? { lastGood: { syncedAt: last.syncedAt, active: last.active } } : last?.lastGood ? { lastGood: last.lastGood } : {}), ...failed }) },
      }).catch(() => {});
      logger.error('[sanctions] list refresh failed', { list, error });
      results.push(failed);
    }
  }
  return results;
}

/** Per-list status for the cockpit. */
export async function sanctionsListStatus() {
  const [settings, counts] = await Promise.all([
    prisma.platformSettings.findMany({ where: { key: { startsWith: 'sanctions_list.' } } }),
    prisma.watchlistEntry.groupBy({ by: ['listName', 'entityType'], where: { active: true }, _count: true }),
  ]);
  const lists = [...new Set([...LIST_NAMES, ...counts.map((c) => c.listName)])];
  return lists.map((l) => {
    const s = settings.find((x) => x.key === `sanctions_list.${l}`);
    const last = s ? JSON.parse(s.value) : null;
    const byType = Object.fromEntries(counts.filter((c) => c.listName === l).map((c) => [c.entityType, c._count]));
    return { list: l, automatic: (LIST_NAMES as string[]).includes(l), activeEntries: Object.values(byType).reduce((a: number, b: any) => a + b, 0), byType, last };
  });
}

let started = false;
/** Daily refresh on the scheduler worker; first run soon after boot when lists are missing or stale. */
export function startSanctionsRefresh(intervalMs = Number(process.env.SANCTIONS_REFRESH_MS ?? 24 * 3600_000)): void {
  if (started || process.env.SANCTIONS_AUTO_REFRESH === '0') return;
  started = true;
  const run = () => { void refreshSanctionsLists().catch((e) => logger.error('[sanctions] refresh threw', { err: e })); };
  setTimeout(async () => {
    const status = await sanctionsListStatus().catch(() => []);
    const stale = !status.length || status.some((s) => s.automatic && (!s.last?.ok || Date.now() - Date.parse(s.last.syncedAt) > 20 * 3600_000));
    if (stale) run();
  }, 60_000).unref?.();
  setInterval(run, intervalMs).unref?.();
  logger.info('[sanctions] daily list refresh scheduled');
}
