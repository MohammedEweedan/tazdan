/**
 * Sanctions / PEP / internal watchlist screening.
 *
 * Screens people, organisations and wallet addresses against WatchlistEntry
 * rows, imported automatically from official sources or by compliance staff.
 * When no list is loaded the result says so (listsChecked = []), and the risk
 * engine treats missing coverage as a review condition in production — the
 * absence of a list is never reported as "clear".
 *
 * Name matching: normalised (case, diacritics, Arabic letter variants,
 * honorifics, common transliterations), then rarity-weighted token alignment
 * (see nameScore); a birth year that rules the listed person out lowers the
 * score below the threshold. A match reviewed as a false positive for the
 * same subject is not raised again.
 * Wallet addresses match exactly (case-insensitive for EVM).
 *
 * UN, OFAC SDN and UK lists are downloaded and refreshed daily
 * (sanctionsLists.service). PEP data and the EU list still need a vendor or a
 * registration token — EXTERNAL PROVIDER ACTIVATION REQUIRED for those.
 */
import { prisma } from '../../utils/prisma';
import type { ScreeningMatch, ScreeningSubject } from '../providers/types';

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'dr', 'sheikh', 'shaikh', 'haj', 'hajj', 'al', 'el', 'bin', 'ibn', 'abu']);

export function normalizeName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Arabic: unify alef/ya/ta-marbuta variants, drop tatweel and harakat.
    .replace(/[آأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ـً-ٟ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ')
    .trim();
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0; let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Common transliterations of the same Arabic name, folded to one form for
// matching (Mohammed/Muhammad, Gaddafi/Qadhafi …). Stored data is untouched.
const NAME_VARIANTS: string[][] = [
  ['muhammad', 'mohammed', 'mohamed', 'mohammad', 'muhammed', 'mohamad', 'mohamud', 'muhamed', 'mohd'],
  ['ahmad', 'ahmed', 'ahmet'], ['abd', 'abdul', 'abdel', 'abdal', 'abdi'], ['husayn', 'hussein', 'husain', 'hussain', 'hosein', 'hossein', 'husein'],
  ['hasan', 'hassan'], ['mahmud', 'mahmoud', 'mahmood'], ['umar', 'omar', 'omer'], ['usama', 'osama', 'oussama'],
  ['yusuf', 'yousef', 'youssef', 'yousif', 'yousuf', 'yosef'], ['qadhafi', 'gaddafi', 'qaddafi', 'kadhafi', 'gadhafi', 'kaddafi', 'qadafi'],
  ['abdulrahman', 'abdurrahman', 'abdelrahman', 'abdalrahman'], ['abdullah', 'abdallah', 'abdulla'], ['mustafa', 'mostafa', 'moustafa'],
  ['khalid', 'khaled'], ['salih', 'saleh', 'salah'], ['ibrahim', 'ebrahim', 'brahim'], ['ismail', 'ismael', 'esmail'],
  ['sulayman', 'suleiman', 'sulaiman', 'soliman', 'suleyman'], ['abubakr', 'abubakar', 'boubaker'], ['ali', 'aly'],
  ['muammar', 'moammar', 'moamar'], ['said', 'saeed', 'saed', 'saaid'], ['jamal', 'gamal'], ['faisal', 'faysal'],
  ['ayman', 'aiman', 'aymen', 'aimen'], ['senussi', 'senoussi', 'sanusi', 'senusi'], ['zawahiri', 'zawahri'],
];
const CANON = new Map<string, string>();
const VARIANTS = new Map<string, string[]>();
for (const group of NAME_VARIANTS) for (const v of group) { CANON.set(v, group[0]); VARIANTS.set(v, group); }

/** Distinct canonical tokens of a name. */
export function nameTokens(raw: string): string[] {
  return [...new Set(normalizeName(raw).split(' ').filter(Boolean).map((t) => CANON.get(t) ?? t))];
}

/** Spelling variants of a token, for the candidate pre-filter. */
export function tokenVariants(t: string): string[] {
  return VARIANTS.get(t) ?? [t];
}

export type TokenWeight = (token: string) => number;

/**
 * Name similarity, 0–1. Tokens are aligned (exact, or Jaro-Winkler ≥ 0.9 for
 * small spelling differences), each weighted by rarity, and the score is
 *   0.7 × (share of the shorter name found in the longer)
 * + 0.3 × (share of the longer name found in the shorter)
 * so a partial name (Saif Gaddafi ↔ Saif al-Islam Gaddafi) still scores high,
 * while a list name that is one common word (Zahra) or that leaves a rare part
 * unmatched (Ali Mohammed Rage) does not match every customer containing it.
 */
export function nameScore(a: string, b: string, weight: TokenWeight = () => 1): number {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.length || !B.length) return 0;
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  const used = new Set<number>();
  let matched = 0;
  for (const t of short) {
    let best = 0;
    let at = -1;
    long.forEach((u, i) => {
      if (used.has(i)) return;
      const sim = t === u ? 1 : jaroWinkler(t, u);
      if (sim > best) { best = sim; at = i; }
    });
    if (at >= 0 && best >= 0.9) { used.add(at); matched += best * Math.min(weight(t), weight(long[at])); }
  }
  const ws = short.reduce((n, t) => n + weight(t), 0);
  const wl = long.reduce((n, t) => n + weight(t), 0);
  // A one-word name only matches a longer name in proportion to how much of
  // the longer name it covers: a listed alias "Abdurrahman" must not flag
  // every "Abdulrahman <anything>".
  let score = short.length === 1 && long.length > 1 ? matched / wl : 0.7 * (matched / ws) + 0.3 * (matched / wl);
  // Names written as one word in one source and two in the other (Abdulrahman ↔ Abd Rahman).
  if (A.length !== B.length) {
    const joined = jaroWinkler(A.join(''), B.join(''));
    if (joined >= 0.96) score = Math.max(score, joined);
  }
  return Math.min(1, score);
}

// Rarity weights from the loaded lists (inverse document frequency), cached.
let weightCache: { at: number; n: number; df: Map<string, number> } | null = null;
export function invalidateTokenWeights(): void { weightCache = null; }
async function tokenWeights(): Promise<TokenWeight> {
  if (!weightCache || Date.now() - weightCache.at > 3600_000) {
    const rows = await prisma.$queryRaw<Array<{ token: string; df: number }>>`
      SELECT token, COUNT(DISTINCT id)::int AS df FROM (
        SELECT "id", unnest(string_to_array(COALESCE("normalizedName", '') || ' ' || array_to_string("aliases", ' '), ' ')) AS token
        FROM "WatchlistEntry" WHERE "active" AND "entityType" IN ('PERSON', 'ORGANISATION', 'BANK')
      ) t WHERE token <> '' GROUP BY token
    `;
    const total = await prisma.watchlistEntry.count({ where: { active: true, entityType: { in: ['PERSON', 'ORGANISATION', 'BANK'] } } });
    const df = new Map<string, number>();
    for (const r of rows) {
      const c = CANON.get(r.token) ?? r.token;
      df.set(c, (df.get(c) ?? 0) + r.df);
    }
    weightCache = { at: Date.now(), n: total, df };
  }
  const { n, df } = weightCache;
  return (t) => 1 + Math.log((n + 1) / ((df.get(t) ?? 0) + 1));
}

/** Years in a stored date-of-birth value ("1951-06-19" or "1947;1945;1948"). */
function birthYears(v: string | null | undefined): number[] {
  return (v ?? '').split(';').map((x) => Number(x.trim().slice(0, 4))).filter((y) => y > 1800);
}

const MATCH_THRESHOLD = () => Number(process.env.SCREENING_MATCH_THRESHOLD ?? 0.88);
/** Applied when both sides have a birth date and no listed year is within a year of the subject's. */
const DOB_MISMATCH_PENALTY = () => Number(process.env.SCREENING_DOB_MISMATCH_PENALTY ?? 0.3);

export interface ScreeningOutcome {
  status: 'CLEAR' | 'POTENTIAL_MATCH' | 'NO_COVERAGE';
  matches: ScreeningMatch[];
  listsChecked: string[];
}

export async function screenSubject(subject: ScreeningSubject): Promise<ScreeningOutcome> {
  const lists = await prisma.watchlistEntry.groupBy({ by: ['listName'], where: { active: true } });
  const listsChecked = lists.map((l) => l.listName);
  const matches: ScreeningMatch[] = [];

  if (subject.walletAddress) {
    const addr = subject.walletAddress.trim();
    const hits = await prisma.watchlistEntry.findMany({
      where: { active: true, walletAddress: { equals: addr, mode: 'insensitive' } },
      take: 10,
    });
    for (const h of hits) matches.push({ listName: h.listName, entryId: h.id, matchedName: h.name ?? addr, score: 1, reason: 'Exact wallet address match' });
  }

  if (subject.name?.trim()) {
    const tokens = nameTokens(subject.name).filter((t) => t.length >= 3);
    if (tokens.length) {
      // Candidate pre-filter: any significant token in the primary name or in
      // any alias (aliases are full names, so this is a substring test, not
      // array membership). Ranked by how many tokens hit, so a very common
      // given name cannot push the real match out of the candidate set.
      const patterns = [...new Set(tokens.flatMap(tokenVariants))].map((t) => `%${t}%`);
      const ids = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT w."id" FROM (
          SELECT "id", COALESCE("normalizedName", '') || ' | ' || array_to_string("aliases", ' | ') AS hay
          FROM "WatchlistEntry"
          WHERE "active" AND "entityType" IN ('PERSON', 'ORGANISATION', 'BANK')
        ) w
        WHERE w.hay LIKE ANY(${patterns})
        ORDER BY (SELECT COUNT(*) FROM unnest(${patterns}::text[]) p WHERE w.hay LIKE p) DESC
        LIMIT 2000
      `;
      const candidates = ids.length ? await prisma.watchlistEntry.findMany({ where: { id: { in: ids.map((r) => r.id) } } }) : [];
      const weight = candidates.length ? await tokenWeights() : () => 1;
      const subjectYear = subject.dateOfBirth ? Number(subject.dateOfBirth.slice(0, 4)) : null;
      for (const c of candidates) {
        const names = [c.name ?? '', ...c.aliases].filter(Boolean);
        let best = 0;
        let bestName = '';
        for (const n of names) {
          const s = nameScore(subject.name, n, weight);
          if (s > best) { best = s; bestName = n; }
        }
        const notes: string[] = [];
        // Birth year that rules the listed person out lowers confidence sharply;
        // a matching country raises it slightly.
        const years = birthYears(c.dateOfBirth);
        if (subjectYear && years.length && !years.some((y) => Math.abs(y - subjectYear) <= 1)) { best -= DOB_MISMATCH_PENALTY(); notes.push('birth year differs'); }
        if (subject.country && c.country && subject.country.toUpperCase() === c.country.toUpperCase()) { best += 0.02; notes.push('same country'); }
        if (best >= MATCH_THRESHOLD()) {
          matches.push({ listName: c.listName, entryId: c.id, matchedName: bestName, score: Math.min(1, Math.round(best * 1000) / 1000), reason: `Name similarity ${(Math.min(1, best) * 100).toFixed(1)}%${notes.length ? ` (${notes.join(', ')})` : ''}` });
        }
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const status = matches.length ? 'POTENTIAL_MATCH' : listsChecked.length ? 'CLEAR' : 'NO_COVERAGE';
  return { status, matches: matches.slice(0, 20), listsChecked };
}

/** Screen and persist the result (ScreeningResult row). */
export async function screenAndRecord(input: { subjectType: 'USER' | 'BENEFICIARY' | 'WALLET_ADDRESS' | 'BUSINESS'; subjectId: string; userId?: string | null; subject: ScreeningSubject }) {
  const outcome = await screenSubject(input.subject);
  // A match compliance already reviewed as a false positive for this subject
  // is not raised again, unless the list entry changed after that review.
  let suppressed: ScreeningMatch[] = [];
  if (outcome.matches.length) {
    const cleared = await prisma.screeningResult.findMany({
      where: { subjectType: input.subjectType, subjectId: input.subjectId, status: 'FALSE_POSITIVE' },
      select: { matches: true, reviewedAt: true },
    });
    const clearedAt = new Map<string, Date>();
    for (const r of cleared) {
      for (const m of ((r.matches as any)?.matches ?? []) as ScreeningMatch[]) {
        if (m.entryId && r.reviewedAt && (!clearedAt.has(m.entryId) || clearedAt.get(m.entryId)! < r.reviewedAt)) clearedAt.set(m.entryId, r.reviewedAt);
      }
    }
    if (clearedAt.size) {
      const entries = await prisma.watchlistEntry.findMany({ where: { id: { in: [...clearedAt.keys()] } }, select: { id: true, updatedAt: true } });
      const unchanged = new Set(entries.filter((e) => e.updatedAt <= clearedAt.get(e.id)!).map((e) => e.id));
      suppressed = outcome.matches.filter((m) => m.entryId && unchanged.has(m.entryId));
      if (suppressed.length) {
        outcome.matches = outcome.matches.filter((m) => !suppressed.includes(m));
        if (!outcome.matches.length) outcome.status = 'CLEAR';
      }
    }
  }
  const row = await prisma.screeningResult.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      userId: input.userId ?? null,
      status: outcome.status === 'NO_COVERAGE' ? 'CLEAR' : outcome.status,
      matches: { matches: outcome.matches, suppressed, coverage: outcome.listsChecked.length ? 'LISTS_LOADED' : 'NO_LISTS_LOADED' } as any,
      listsChecked: outcome.listsChecked,
    },
  });
  return { ...outcome, resultId: row.id };
}

/** Import watchlist rows (e.g. parsed from an official CSV export). */
export async function importWatchlist(rows: Array<{ listName: string; entityType: string; name?: string; aliases?: string[]; country?: string; dateOfBirth?: string; walletAddress?: string; identifier?: string }>, source: string, actorId: string) {
  let created = 0;
  for (const r of rows) {
    if (!r.name && !r.walletAddress) continue;
    await prisma.watchlistEntry.create({
      data: {
        listName: r.listName.toUpperCase(), entityType: r.entityType.toUpperCase(), name: r.name ?? null,
        normalizedName: r.name ? normalizeName(r.name) : null,
        aliases: (r.aliases ?? []).map((a) => normalizeName(a)).filter(Boolean),
        country: r.country?.toUpperCase() ?? null, dateOfBirth: r.dateOfBirth ?? null,
        walletAddress: r.walletAddress ?? null, identifier: r.identifier ?? null, source, addedById: actorId,
      },
    });
    created++;
  }
  return { created };
}
