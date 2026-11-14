// LYDT sandbox screens for the CBL proposal (Expo web on :8081, fictional
// persona and sandbox figures from client/scripts/app-media/fixtures.mjs).
// Usage: node capture.mjs en|ar
import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, bootSignedIn, nav, sleep } from '../../client/scripts/app-media/harness.mjs';

const locale = process.argv[2] === 'ar' ? 'ar' : 'en';
const AR = locale === 'ar';
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', locale);
await fs.mkdir(out, { recursive: true });

const keys = (page, digits) => async () => { for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click(); await sleep(400); };
const scenes = (page) => [
  ['lydt-home', '/lydt', 2200, null, AR ? 'الاحتياطي' : 'Reserves'],
  ['lydt-issue', '/lydt/convert?mode=issue', 1600, keys(page, '500')],
  ['lydt-issued', '/lydt/convert?mode=issue', 1600, async () => {
    await keys(page, '500')();
    await page.getByRole('button', { name: AR ? 'مراجعة' : 'Review', exact: true }).click();
    await sleep(700);
    await page.getByRole('dialog').getByRole('button').filter({ hasText: AR ? 'تحويل' : 'Convert' }).last().click();
    await page.getByText('LYDT-I-', { exact: false }).first().waitFor({ timeout: 8000 });
    await sleep(800);
  }],
];

const { browser, page, errors, unmatched } = await launch({ locale, theme: 'dark', dsf: 2 });
const report = [];
try {
  await bootSignedIn(page, { locale });
  for (const [id, route, wait, action, mustSee] of scenes(page)) {
    try {
      await nav(page, '/profile', 300);
      await nav(page, route, wait);
      await page.evaluate(() => document.fonts.ready);
      if (action) await action();
      const body = await page.locator('body').innerText();
      if (/Unmatched Route|This screen does not exist|Something went wrong/.test(body)) throw Error('Unavailable route: ' + body.slice(0, 160));
      if (mustSee && !body.toLowerCase().includes(mustSee.toLowerCase())) throw Error(`Missing "${mustSee}"`);
      await page.screenshot({ path: path.join(out, id + '.png'), animations: 'allow', caret: 'hide' });
      report.push({ id, ok: true });
    } catch (e) { report.push({ id, ok: false, error: String(e).slice(0, 300) }); }
    console.log(JSON.stringify(report.at(-1)));
  }
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ report, errors: errors.slice(0, 40), unmatched: [...unmatched] }, null, 2));
  await browser.close();
}
