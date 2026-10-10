/**
 * Official sanctions lists: parsing the publishers' real formats, refreshing
 * a list in place, refusing a truncated download, and screening recall
 * (aliases, OFAC wallet addresses, very common names). Runs in its own schema
 * because loaded lists change screening for every other suite.
 */
import { execSync } from 'child_process';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const SCHEMA = `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
if (RUN_DB) {
  const u = new URL(process.env.DATABASE_URL ?? '');
  u.searchParams.set('schema', SCHEMA);
  process.env.DATABASE_URL = u.toString();
}
// Nothing listens on port 9: the download fails fast.
process.env.SANCTIONS_UN_URL = 'http://127.0.0.1:9/consolidated.xml';

const UN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CONSOLIDATED_LIST dateGenerated="2026-10-07T23:00:03.504Z"><INDIVIDUALS>
  <INDIVIDUAL><DATAID>6907995</DATAID><FIRST_NAME>GASTON</FIRST_NAME><SECOND_NAME>IYAMUREMYE</SECOND_NAME>
    <REFERENCE_NUMBER>CDi.003</REFERENCE_NUMBER><NATIONALITY><VALUE>Rwanda</VALUE></NATIONALITY>
    <INDIVIDUAL_ALIAS><QUALITY>Good</QUALITY><ALIAS_NAME>Byiringiro Victor Rumuli</ALIAS_NAME></INDIVIDUAL_ALIAS>
    <INDIVIDUAL_DATE_OF_BIRTH><TYPE_OF_DATE>EXACT</TYPE_OF_DATE><YEAR>1948</YEAR></INDIVIDUAL_DATE_OF_BIRTH>
  </INDIVIDUAL></INDIVIDUALS><ENTITIES>
  <ENTITY><DATAID>6908024</DATAID><FIRST_NAME>BUTEMBO AIRLINES (BAL)</FIRST_NAME><REFERENCE_NUMBER>CDe.002</REFERENCE_NUMBER>
    <ENTITY_ALIAS><QUALITY/><ALIAS_NAME/></ENTITY_ALIAS><ENTITY_ADDRESS><COUNTRY>Democratic Republic of the Congo</COUNTRY></ENTITY_ADDRESS></ENTITY>
</ENTITIES></CONSOLIDATED_LIST>`;

const OFAC_SDN = [
  '2676,"AL ZAWAHIRI, Dr. Ayman","individual","SDGT","Leader",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"DOB 19 Jun 1951; POB Giza, Egypt; nationality Egypt."',
  '4632,"BANK MARKAZI JOMHOURI ISLAMI IRAN",-0- ,"IRAN",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - TRX TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81; alt. Digital Currency Address - ETH 0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c."',
  '9999,"OCEAN STAR","vessel","SDGT",-0- ,-0- ,"Cargo",-0- ,-0- ,-0- ,-0- ,"Vessel Registration Identification IMO 1234567."',
].join('\n');
const OFAC_ALT = '2676,1,"aka","SALIM, Ahmad Fuad",-0- \n4632,2,"aka","CENTRAL BANK OF IRAN",-0- ';
const OFAC_ADD = '4632,10,"Ferdowsi Avenue","Tehran","Iran",-0- ';

const UK_CSV = '﻿Report Date: 07-Oct-2026\r\n'
  + 'Last Updated,Unique ID,Name 6,Name 1,Name 2,Name type,Name non-latin script,Designation Type,D.O.B,Nationality(/ies),Address Country,Other Information\r\n'
  + '04/08/2026,AFG0006,AKHUND,MOHAMMAD,HASSAN,Primary Name,,Individual,,Afghanistan,,"Line one\r\nline two"\r\n'
  + '04/08/2026,AFG0006,,,,,,Individual,dd/mm/1947,Afghanistan,,\r\n'
  + '04/08/2026,AFG0006,AKHUND,MULLAH,MOHAMMAD,Alias,محمد حسن آخوند,Individual,,,,\r\n'
  + '04/08/2026,LIB0001,LIBYAN ARMS CO,,,Primary name,,Entity,,,Libya,\r\n';

describeDb('official sanctions lists', () => {
  let prisma: any;
  let sl: typeof import('../services/compliance/sanctionsLists.service');
  let screening: typeof import('../services/compliance/screening.service');

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { env: process.env, stdio: 'pipe' });
    ({ prisma } = await import('../utils/prisma'));
    sl = await import('../services/compliance/sanctionsLists.service');
    screening = await import('../services/compliance/screening.service');
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('parses the UN, OFAC and UK formats', () => {
    const un = sl.parseUn(UN_XML);
    expect(un).toEqual([
      expect.objectContaining({ identifier: 'CDi.003', entityType: 'PERSON', name: 'GASTON IYAMUREMYE', aliases: ['Byiringiro Victor Rumuli'], country: 'RW', dateOfBirth: '1948' }),
      expect.objectContaining({ identifier: 'CDe.002', entityType: 'ORGANISATION', name: 'BUTEMBO AIRLINES (BAL)', aliases: [], country: 'CD' }),
    ]);

    const ofac = sl.parseOfac(OFAC_SDN, OFAC_ALT, OFAC_ADD);
    expect(ofac.find((r) => r.identifier === '2676')).toEqual(expect.objectContaining({ entityType: 'PERSON', name: 'Dr. Ayman AL ZAWAHIRI', aliases: ['Ahmad Fuad SALIM'], dateOfBirth: '1951-06-19', country: 'EG' }));
    expect(ofac.find((r) => r.identifier === '4632')).toEqual(expect.objectContaining({ entityType: 'ORGANISATION', country: 'IR', aliases: ['CENTRAL BANK OF IRAN'] }));
    expect(ofac.filter((r) => r.entityType === 'WALLET').map((r) => r.walletAddress)).toEqual(['TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81', '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c']);
    expect(ofac.find((r) => r.identifier === '9999')?.entityType).toBe('VESSEL');

    const uk = sl.createUkParser();
    for (let i = 0; i < UK_CSV.length; i += 37) uk.push(UK_CSV.slice(i, i + 37)); // arbitrary chunk boundaries
    const ukRecords = uk.end();
    expect(ukRecords).toEqual([
      expect.objectContaining({ identifier: 'AFG0006', entityType: 'PERSON', name: 'MOHAMMAD HASSAN AKHUND', aliases: ['MULLAH MOHAMMAD AKHUND', 'محمد حسن آخوند'], dateOfBirth: '1947', country: 'AF' }),
      expect.objectContaining({ identifier: 'LIB0001', entityType: 'ORGANISATION', name: 'LIBYAN ARMS CO', country: 'LY' }),
    ]);
  });

  it('refreshes a list in place: stable ids, changes applied, delistings deactivated', async () => {
    const records = sl.parseOfac(OFAC_SDN, OFAC_ALT, OFAC_ADD);
    const first = await sl.syncList('OFAC-SDN', records, 'test');
    expect(first).toEqual(expect.objectContaining({ ok: true, active: 5, added: 5, updated: 0, removed: 0 }));
    const before = await prisma.watchlistEntry.findFirst({ where: { listName: 'OFAC-SDN', identifier: '2676' } });

    const next = records.filter((r) => r.identifier !== '9999').map((r) => (r.identifier === '2676' ? { ...r, aliases: [...r.aliases, 'Abu Muhammad'] } : r));
    next.push({ identifier: '12345', entityType: 'PERSON', name: 'Newly Listed Person', aliases: [], country: 'LY', dateOfBirth: null, walletAddress: null });
    const second = await sl.syncList('OFAC-SDN', next, 'test');
    expect(second).toEqual(expect.objectContaining({ active: 5, added: 1, updated: 1, removed: 1 }));
    const after = await prisma.watchlistEntry.findFirst({ where: { listName: 'OFAC-SDN', identifier: '2676' } });
    expect(after.id).toBe(before.id);
    expect(after.aliases).toContain('muhammad');
    expect((await prisma.watchlistEntry.findFirst({ where: { listName: 'OFAC-SDN', identifier: '9999' } })).active).toBe(false);
    const status = (await sl.sanctionsListStatus()).find((s) => s.list === 'OFAC-SDN')!;
    expect(status.last).toEqual(expect.objectContaining({ ok: true, added: 1, removed: 1 }));
  });

  it('refuses a download that would shrink a loaded list sharply', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ identifier: `X${i}`, entityType: 'PERSON' as const, name: `Person Number ${i}`, aliases: [], country: null, dateOfBirth: null, walletAddress: null }));
    await sl.syncList('UK', many, 'test');
    await expect(sl.syncList('UK', many.slice(0, 10), 'test')).rejects.toThrow(/refusing to shrink coverage/);
    expect(await prisma.watchlistEntry.count({ where: { listName: 'UK', active: true } })).toBe(60);
  });

  it('records a failed download without touching the loaded entries', async () => {
    const [r] = await sl.refreshSanctionsLists({ lists: ['UN'] });
    expect(r).toEqual(expect.objectContaining({ list: 'UN', ok: false }));
    const status = (await sl.sanctionsListStatus()).find((s) => s.list === 'UN')!;
    expect(status.last.ok).toBe(false);
    expect(status.last.error).toBeTruthy();
  });

  it('scores names so partial names of listed people match and common words do not', () => {
    const common = new Set(['muhammad', 'ali', 'ahmad', 'hasan', 'islam', 'abd', 'ibrahim']);
    const w = (t: string) => (common.has(t) ? 2 : 8);
    expect(screening.nameScore('Mohammed Ali', 'Ali Muhammad', w)).toBe(1); // order and spelling
    expect(screening.nameScore('Saif Qadhafi', 'Saif al-Islam Gaddafi', w)).toBeGreaterThanOrEqual(0.88); // partial name
    expect(screening.nameScore('Moammar Qaddafi', 'Muammar QADHAFI', w)).toBe(1); // transliteration
    expect(screening.nameScore('Fatima Zahra Benali', 'Zahra', w)).toBeLessThan(0.88); // one-word alias
    expect(screening.nameScore('Abdulrahman Mohammed', 'Abdurrahman', w)).toBeLessThan(0.88);
    expect(screening.nameScore('Mohammed Ali', 'Ali Mohammed Rage', w)).toBeLessThan(0.88); // rare part unmatched
    expect(screening.nameScore('Khalifa Haftar', 'Khalifa Ghawail', w)).toBeLessThan(0.88);
  });

  it('a birth year that rules the listed person out clears the match; a reviewed false positive is not raised again', async () => {
    await prisma.watchlistEntry.create({ data: { listName: 'INTERNAL', entityType: 'PERSON', name: 'Tarek Shalabi Mansour', normalizedName: 'tarek shalabi mansour', dateOfBirth: '1961;1963', source: 'test' } });
    expect((await screening.screenSubject({ name: 'Tarek Shalabi Mansour', dateOfBirth: '1962-05-01' })).status).toBe('POTENTIAL_MATCH');
    const other = await screening.screenSubject({ name: 'Tarek Shalabi Mansour', dateOfBirth: '1994-05-01' });
    expect(other.status).toBe('CLEAR');

    const first = await screening.screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: 'ben-1', subject: { name: 'Tarek Shalabi Mansour' } });
    expect(first.status).toBe('POTENTIAL_MATCH');
    await prisma.screeningResult.update({ where: { id: first.resultId }, data: { status: 'FALSE_POSITIVE', reviewedAt: new Date(Date.now() + 1000) } });
    const again = await screening.screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: 'ben-1', subject: { name: 'Tarek Shalabi Mansour' } });
    expect(again.status).toBe('CLEAR');
    expect(((await prisma.screeningResult.findUnique({ where: { id: again.resultId } })).matches as any).suppressed).toHaveLength(1);
    // A different subject with the same name is still flagged.
    expect((await screening.screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: 'ben-2', subject: { name: 'Tarek Shalabi Mansour' } })).status).toBe('POTENTIAL_MATCH');
    // If the list entry changes after the review, the match is raised again.
    await new Promise((r) => setTimeout(r, 1100));
    await prisma.watchlistEntry.updateMany({ where: { normalizedName: 'tarek shalabi mansour' }, data: { aliases: ['tareq mansour'] } });
    expect((await screening.screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: 'ben-1', subject: { name: 'Tarek Shalabi Mansour' } })).status).toBe('POTENTIAL_MATCH');
  });

  it('matches on aliases, on OFAC wallet addresses, and finds a real match among many common names', async () => {
    const byAlias = await screening.screenSubject({ name: 'Ahmad Fuad Salim' });
    expect(byAlias.status).toBe('POTENTIAL_MATCH');
    expect(byAlias.matches[0]).toEqual(expect.objectContaining({ listName: 'OFAC-SDN', matchedName: 'ahmad fuad salim' }));

    const wallet = await screening.screenSubject({ name: '', walletAddress: 'TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81' });
    expect(wallet.matches[0]).toEqual(expect.objectContaining({ score: 1, reason: 'Exact wallet address match' }));

    // 2,500 entries share the given name; the listed person must still be found.
    await prisma.watchlistEntry.createMany({
      data: Array.from({ length: 2500 }, (_, i) => ({ listName: 'INTERNAL', entityType: 'PERSON', name: `Mohammed Decoy${i} Person${i}`, normalizedName: `mohammed decoy${i} person${i}`, source: 'test' })),
    });
    await prisma.watchlistEntry.create({ data: { listName: 'INTERNAL', entityType: 'PERSON', name: 'Mohammed Khalifa Ramadan', normalizedName: 'mohammed khalifa ramadan', source: 'test' } });
    const common = await screening.screenSubject({ name: 'Mohammed Khalifa Ramadan' });
    expect(common.matches.map((m) => m.matchedName)).toContain('Mohammed Khalifa Ramadan');

    const clear = await screening.screenSubject({ name: 'Fatima Zahra Benali' });
    expect(clear.status).toBe('CLEAR');
  });
});
