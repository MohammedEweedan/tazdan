// Stills of the current app (Expo web build on :8081, fictional persona from
// client/scripts/app-media/fixtures.mjs) for the Nov 2026 investor PDFs.
// Usage: node capture.mjs en|ar [ids]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, bootSignedIn, nav, sleep, setStore } from '../../client/scripts/app-media/harness.mjs';

const locale = process.argv[2] === 'ar' ? 'ar' : 'en';
const only = process.argv[3]?.split(',');
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', locale);
await fs.mkdir(out, { recursive: true });
const AR = locale === 'ar';

// [id, route, settle ms, optional action, text that must be on screen]
const pay = (page, digits) => (async () => { for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click(); await sleep(400); });
const scenes = (page) => [
  ['home', '/', 1800],
  ['pay', '/pay', 1600, null, AR ? 'امسح للدفع' : 'Scan to pay'],
  ['pay-merchant', '/pay/olivelane?currency=LYD&amount=18.500&ref=T-14', 1800, null, AR ? 'مقهى درب الزيتون' : 'Olive Lane Café'],
  ['pay-receipt', '/pay/olivelane?currency=LYD&amount=18.500&ref=T-14', 1800, async () => {
    await page.getByRole('button', { name: AR ? 'مراجعة' : 'Review', exact: true }).click();
    await sleep(700);
    await page.getByRole('dialog').getByRole('button').filter({ hasText: AR ? 'دفع' : 'Pay' }).last().click();
    await page.getByText(AR ? 'تم الدفع' : 'Paid', { exact: true }).first().waitFor({ timeout: 8000 });
    await sleep(900);
  }],
  ['pay-person', '/pay/yusuf.m', 1600, pay(page, '120')],
  ['business-qr', '/business/qr', 2200, null, AR ? 'امسح للدفع عبر tazdan' : 'Scan to pay with tazdan'],
  ['business-home', '/business', 1800],
  ['send', '/send?to=usr_omar&handle=omar.benali&name=Omar%20Ben%20Ali', 1600, pay(page, '250')],
  ['messages', '/messages', 1600],
  ['wallet', '/wallet', 1800],
  ['exchange', '/exchange', 2200],
  ['remit', '/remit', 2000],
  ['budgets', '/budgets', 1800],
  ['p2p', '/p2p', 2000],
  ['kyc', '/kyc', 1800],
  ['devices', '/settings/devices', 1600],
];

const { browser, page, errors, unmatched } = await launch({ locale, theme: 'dark', dsf: 2 });
const report = [];
try {
  await bootSignedIn(page, { locale });
  await setStore(page, 'authStore', { biometricEnabled: true });
  for (const [id, route, wait, action, mustSee] of scenes(page)) {
    if (only && !only.includes(id)) continue;
    try {
      await nav(page, '/profile', 300);
      await nav(page, route, wait);
      await page.evaluate(() => document.fonts.ready);
      if (action) await action();
      const body = await page.locator('body').innerText();
      if (/Unmatched Route|This screen does not exist|Something went wrong/.test(body)) throw Error('Unavailable route: ' + body.slice(0, 160));
      if (mustSee && !body.includes(mustSee)) throw Error(`Missing "${mustSee}"`);
      await page.screenshot({ path: path.join(out, id + '.png'), animations: 'allow', caret: 'hide' });
      report.push({ id, ok: true });
    } catch (e) { report.push({ id, ok: false, error: String(e).slice(0, 300) }); }
    console.log(JSON.stringify(report.at(-1)));
  }
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ report, errors: errors.slice(0, 40), unmatched: [...unmatched] }, null, 2));
  await browser.close();
}
