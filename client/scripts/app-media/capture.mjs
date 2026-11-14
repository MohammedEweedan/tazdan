#!/usr/bin/env node
// Capture real Expo web interaction using fictional, network-intercepted data.
// node capture.mjs [en-dark,ar-dark,en-light] [comma,separated,screen,ids]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launch, bootSignedIn, nav, sleep, setStore } from './harness.mjs';

const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT = path.dirname(CLIENT);
const TEMP = process.env.CAPTURE_TEMP || path.join(PROJECT, 'output/app-media-capture');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const variants = (process.argv[2] || 'en-dark,ar-dark,en-light').split(',');
const selected = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
fs.mkdirSync(TEMP, { recursive: true });

const dictSource = fs.readFileSync(path.join(PROJECT, 'mobile/src/store/i18nStore.ts'), 'utf8');
const dictSection = (name, next) => dictSource.slice(dictSource.indexOf(`\n  ${name}: {\n`), dictSource.indexOf(`\n  ${next}: {\n`));
const parseDict = (txt) => Object.fromEntries([...txt.matchAll(/(['"])([\w.]+)\1:\s*(['"])((?:\\.|(?!\3).)*)\3/g)].map(m => [m[2], m[4].replace(/\\(['"])/g, '$1')]));
const en = parseDict(dictSection('en', 'ar')), ar = parseDict(dictSection('ar', 'fr'));
const designSource = fs.readFileSync(path.join(PROJECT, 'mobile/src/theme/copy.ts'), 'utf8');
const designSplit = designSource.indexOf('export const designAr');
Object.assign(en, parseDict(designSource.slice(0, designSplit))); Object.assign(ar, parseDict(designSource.slice(designSplit)));
const confirmSource = fs.readFileSync(path.join(PROJECT, 'mobile/src/theme/confirmCopy.ts'), 'utf8');
const confirmAr = confirmSource.indexOf('\n  ar: {'), confirmFr = confirmSource.indexOf('\n  fr: {');
Object.assign(en, parseDict(confirmSource.slice(0, confirmAr))); Object.assign(ar, parseDict(confirmSource.slice(confirmAr, confirmFr)));
const translated = (locale, label, key) => locale === 'ar' ? ar[key || Object.keys(en).find(k => en[k] === label)] || label : label;

let capturePaused = false, captureBusy = null;
async function interact(action) {
  capturePaused = true;
  if (captureBusy) await captureBusy;
  try { return await action(); } finally { capturePaused = false; }
}
// Pause the screenshot compositor during target measurement and the click, so
// retina surface capture cannot transiently change the pointer coordinates.
async function text(page, label, exact = true) { return interact(async () => { const target = page.getByText(label, { exact }).filter({ visible: true }).first(); await target.waitFor({ state: 'visible', timeout: 5000 }); await target.click({ force: true, timeout: 5000 }); }); }
async function button(page, label) { return interact(async () => { const target = page.getByRole('button', { name: label, exact: true }).first(); await target.waitFor({ state: 'visible', timeout: 5000 }); await target.click({ force: true, timeout: 5000 }); }); }
async function aria(page, label) { return interact(async () => { const target = page.locator(`[aria-label="${label}"]`).first(); await target.waitFor({ state: 'visible', timeout: 5000 }); await target.click({ force: true, timeout: 5000 }); }); }
async function typeAmount(page, amount) { for (const digit of amount) { await button(page, digit); await sleep(240); } }
async function clearAmount(page, count) { for (let i = 0; i < count; i++) { await button(page, 'Backspace'); await sleep(100); } }
async function slide(page, label) {
  const box = await interact(() => page.getByRole('button', { name: label, exact: true }).boundingBox());
  if (!box) throw Error(`No slider for ${label}`);
  await page.mouse.move(box.x + 48, box.y + box.height / 2); await page.mouse.down();
  for (let i = 1; i <= 36; i++) { await page.mouse.move(box.x + 48 + (box.width - 80) * i / 36, box.y + box.height / 2); await sleep(23); }
  await page.mouse.up();
}
async function home(page, route) { await nav(page, route, 450); }

/** Animate the actual ScrollView, easing once at each end instead of wheel jumps. */
async function glide(page, { amount = 340, horizontal = false, at, ms = 1200 } = {}) {
  const moved = await page.evaluate(({ amount, horizontal, at, ms }) => {
    const candidates = [...document.querySelectorAll('*')].filter(el => {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      return rect.width > 150 && rect.height > 30 && rect.y < 810 && rect.bottom > 100 &&
        (horizontal ? el.scrollWidth > el.clientWidth + 12 && /(auto|scroll)/.test(style.overflowX) : el.scrollHeight > el.clientHeight + 12 && /(auto|scroll)/.test(style.overflowY));
    });
    let el;
    if (at) { el = document.elementFromPoint(...at); while (el && !candidates.includes(el)) el = el.parentElement; }
    el ||= candidates.sort((a, b) => horizontal ? b.clientWidth - a.clientWidth : b.clientHeight - a.clientHeight)[0];
    if (!el) return false;
    const from = horizontal ? el.scrollLeft : el.scrollTop;
    const max = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    const to = Math.max(0, Math.min(max, from + amount));
    const previousSnap = el.style.scrollSnapType; el.style.scrollSnapType = 'none';
    const started = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - started) / ms);
        const ease = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        if (horizontal) el.scrollLeft = from + (to - from) * ease; else el.scrollTop = from + (to - from) * ease;
        el.dispatchEvent(new Event('scroll'));
        if (t < 1) requestAnimationFrame(tick); else el.style.scrollSnapType = previousSnap;
      }; requestAnimationFrame(tick);
    return Math.abs(to - from) > 5;
  }, { amount, horizontal, at, ms });
  // Let the animation run independently in the renderer. Awaiting its promise
  // through Runtime.callFunctionOn stalls surface screenshots between endpoints.
  await sleep(ms + 80);
  return moved;
}
async function scrollLoop(page, amount = 360) { await glide(page, { amount }); await sleep(1200); await glide(page, { amount: -10000 }); await sleep(700); }

async function capture(cdp, action) {
  const frames = [];
  // Chrome's screencast protocol emits CSS-sized393px frames even on a2x
  // device. Explicit metrics + surface screenshots retain the native786px
  // raster. Capture continuously, with no Playwright screenshot stabilization
  // waits, and preserve actual capture times rather than speeding the flow up.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
  await sleep(150);
  let recording = true;
  const stream = (async () => {
    while (recording) {
      if (capturePaused) { await sleep(15); continue; }
      const started = Date.now();
      captureBusy = Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 393, height: 852, scale: 1 } }),
        sleep(3000).then(() => { throw Error('Retina screenshot timed out'); }),
      ]);
      const frame = await captureBusy; captureBusy = null;
      frames.push({ data: frame.data, t: (started + Date.now()) / 2 });
      await sleep(Math.max(0, 1000 / 30 - (Date.now() - started)));
    }
  })();
  try { await sleep(900); await action(); await sleep(1200); }
  finally { recording = false; await stream; }
  return { frames, ended: Date.now() };
}

function encode(recording, variant, id) {
  const nativeFrameCount = recording.frames.length;
  recording.frames = recording.frames.filter((frame, i, frames) => !i || frame.data !== frames[i - 1].data);
  if (recording.frames.length < 8) throw Error(`Only ${recording.frames.length} changed frames; refusing a static loop`);
  const dir = path.join(TEMP, variant, id); fs.mkdirSync(dir, { recursive: true });
  const files = recording.frames.map((frame, i) => {
    const file = path.join(dir, `${String(i).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(frame.data, 'base64'));
    return { file, t: frame.t };
  });
  // CDP only sends changed frames. Preserve presentation timestamps so idle
  // screens hold, while scrolling/gestures retain every captured source frame.
  const durations = files.map((frame, i) => Math.max(.016, (i + 1 < files.length ? files[i + 1].t - frame.t : recording.ended - frame.t) / 1000));
  const list = files.map((frame, i) => `file '${frame.file}'\nduration ${durations[i].toFixed(6)}\n`).join('') + `file '${files.at(-1).file}'\n`;
  const concat = path.join(dir, 'frames.txt'); fs.writeFileSync(concat, list);
  const duration = durations.reduce((a, b) => a + b, 0);
  const output = path.join(CLIENT, 'public/app/loops', variant); fs.mkdirSync(output, { recursive: true });
  const mp4 = path.join(dir, 'encoded.mp4'), webm = path.join(dir, 'encoded.webm'), poster = path.join(dir, 'poster.jpg');
  // A short dissolve into the opening frame avoids a flash if the final app
  // state differs slightly (live quote timer, spring settling, etc.).
  const transition = .55;
  const sourceDimensions = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-of', 'json', files[0].file], { encoding: 'utf8' })).streams[0];
  if (sourceDimensions.width < 720 || sourceDimensions.height < 1560) throw Error(`Source was ${sourceDimensions.width}x${sourceDimensions.height}; refusing to upscale a non-retina capture`);
  const filter = `[0:v]fps=30,scale=720:1560:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p,setsar=1[main];[1:v]fps=30,scale=720:1560:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p,setsar=1[first];[main][first]xfade=transition=fade:duration=${transition}:offset=${Math.max(.1, duration - transition).toFixed(3)}[loop]`;
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concat, '-loop', '1', '-i', files[0].file, '-filter_complex', filter, '-map', '[loop]', '-t', duration.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart', '-an', mp4]);
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '35', '-deadline', 'good', '-cpu-used', '5', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-an', webm]);
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', mp4, '-frames:v', '1', '-q:v', '2', poster]);
  const gifOutput = path.join(CLIENT, 'public/app/gif', variant); fs.mkdirSync(gifOutput, { recursive: true });
  const gif = path.join(dir, 'encoded.gif');
  let gifWidth = 300;
  for (const width of [300, 260, 220, 190]) {
    gifWidth = width;
    execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', mp4, '-vf', `fps=20,scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', gif]);
    if (fs.statSync(gif).size < 1_500_000) break;
  }
  const info = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4], { encoding: 'utf8' }));
  const intervals = recording.frames.slice(1).map((frame, i) => frame.t - recording.frames[i].t).filter(ms => ms > 0 && ms < 100);
  const median = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
  const report = { variant, id, durationSec: +info.format.duration, sourceWidth: sourceDimensions.width, sourceHeight: sourceDimensions.height, nativeFrameCount, sourceChangedFrames: files.length, sourceMotionFps: median ? +(1000 / median).toFixed(1) : 0, fps: info.streams[0].r_frame_rate, width: info.streams[0].width, height: info.streams[0].height, pixFmt: info.streams[0].pix_fmt, colorRange: info.streams[0].color_range, mp4Bytes: fs.statSync(mp4).size, webmBytes: fs.statSync(webm).size, gifBytes: fs.statSync(gif).size, gifWidth };
  // Install complete assets only, keeping the previous version readable while
  // encoding. The registry requires all three loop formats before inclusion.
  for (const [file, target] of [[mp4, path.join(output, `${id}.mp4`)], [webm, path.join(output, `${id}.webm`)], [poster, path.join(output, `${id}.jpg`)], [gif, path.join(gifOutput, `${id}.gif`)]]) fs.renameSync(file, target);
  // Individual source frames are temporary QA data, never website payload.
  if (!process.env.KEEP_CAPTURE_FRAMES) fs.rmSync(dir, { recursive: true, force: true });
  return report;
}

const specs = [
  ['home', '/', async (p, T) => { await glide(p, { amount: 393, horizontal: true, at: [196, 190], ms: 1200 }); await sleep(1100); await glide(p, { amount: -393, horizontal: true, at: [196, 190], ms: 1200 }); await text(p, T('Activity', 'home.activity')); await sleep(1500); await text(p, T('Assets')); await sleep(500); await scrollLoop(p, 310); }],
  ['balances', '/', async p => { for (let i = 0; i < 2; i++) { await glide(p, { amount: 393, horizontal: true, at: [196, 190], ms: 1100 }); await sleep(1300); } await glide(p, { amount: -786, horizontal: true, at: [196, 190], ms: 1600 }); }],
  ['privacy-hidden', '/', async (p, T) => { await button(p, T('Hide balances')); await sleep(1800); await button(p, T('Show balances')); await sleep(1000); await glide(p, { amount: 320 }); await sleep(1000); await glide(p, { amount: -10000 }); }],
  ['messages', '/messages', async (p, T, L) => { await text(p, L('Omar Ben Ali', 'عمر بن علي')); await sleep(1700); await p.locator('textarea').pressSequentially(L('Of course. I will send it now.', 'أكيد، سأرسلها الآن.'), { delay: 65 }); await sleep(1600); await p.locator('textarea').fill(''); await p.evaluate(() => history.back()); await sleep(1000); }],
  ['chat-payment', '/messages/usr_omar', async (p, T, L) => { await aria(p, T('Send a payment', 'chat.sendPayment')); await sleep(900); const sheet = p.getByRole('dialog').last(); await interact(() => sheet.getByText(/USDT/).first().click({ force: true })); await interact(() => sheet.locator('input[placeholder="0.00"]').pressSequentially('50', { delay: 180 })); await interact(() => sheet.locator('textarea').last().pressSequentially(L('Flowers for the family', 'ورد للعائلة'), { delay: 60 })); await sleep(1000); await interact(() => sheet.getByText(L('Send 50 USDT', 'إرسال 50 USDT'), { exact: true }).click({ force: true })); await sheet.waitFor({ state: 'hidden', timeout: 6000 }); await p.getByText('50 USDT', { exact: false }).first().waitFor({ timeout: 5000 }); await sleep(1900); await scrollLoop(p, -180); }],
  ['buy', '/buy', async (p, T) => { await typeAmount(p, '500'); await sleep(1700); await text(p, T('Total you pay', 'buy.totalYouPay'), false); await sleep(1500); await text(p, T('Total you pay', 'buy.totalYouPay'), false); await clearAmount(p, 3); await sleep(800); }],
  ['sell', '/sell', async p => { await typeAmount(p, '0.005'); await sleep(1700); await clearAmount(p, 5); await sleep(800); }],
  ['send', '/send', async (p, T, L) => { await p.locator('input').first().pressSequentially('omar', { delay: 110 }); await sleep(700); await text(p, L('Omar Ben Ali', 'عمر بن علي'), false); await typeAmount(p, '250'); await sleep(1200); await aria(p, 'Add note'); await p.locator('input').last().pressSequentially(L('Dinner with family', 'عشاء مع العائلة'), { delay: 70 }); await sleep(1000); await button(p, T('Review', 'confirm.review')); await sleep(1700); await interact(() => p.getByRole('dialog').getByRole('button').filter({ hasText: L('Send', 'إرسال') }).last().click({ force: true })); await p.getByText(T('Transfer sent!', 'send.sent'), { exact: true }).waitFor({ timeout: 6000 }); await sleep(1700); }],
  ['confirm', '/send', async (p, T, L) => { await p.locator('input').first().fill('omar'); await sleep(700); await text(p, L('Omar Ben Ali', 'عمر بن علي'), false); await typeAmount(p, '75'); await sleep(2000); await clearAmount(p, 2); }],
  ['topup', '/topup', async (p, T) => { await typeAmount(p, '1000'); await sleep(1000); await text(p, T('Peer-to-peer (P2P)')); await sleep(1800); await text(p, T('Cash via tazdan Agent')); await sleep(900); await clearAmount(p, 4); }],
  ['asset', '/asset/BTC', async p => { await text(p, '7D'); await sleep(1600); await text(p, '30D'); await sleep(1600); await text(p, '24H'); await sleep(700); await scrollLoop(p, 250); }],
  ['wallet', '/wallet', async (p, T) => { await text(p, T('Crypto')); await sleep(1600); await text(p, T('Fiat')); await sleep(1400); await text(p, T('All')); await sleep(600); await scrollLoop(p, 380); }],
  ['portfolio', '/portfolio/crypto', async p => scrollLoop(p, 370)],
  ['cards', '/cards', async (p, T) => { await text(p, T('Activity')); await sleep(1400); await scrollLoop(p, 430); await text(p, T('Activity')); await sleep(700); }],
  ['p2p', '/p2p', async (p, T) => { await text(p, T('Near me', 'p2p.nearMe')); await sleep(1500); await scrollLoop(p, 440); await text(p, T('Near me', 'p2p.nearMe')); await sleep(600); }],
  ['budgets', '/budgets', async (p, T, L) => { await text(p, L('Hajj 2027', 'حج 2027')); await sleep(1400); await scrollLoop(p, 380); await button(p, T('Back', 'common.back')); await sleep(900); }],
  ['remit', '/remit', async (p, T, L) => { await button(p, T('New transfer', 'remit.new')); await sleep(800); await text(p, 'Libya → United Kingdom'); await sleep(700); await text(p, L('Omar Ben Ali', 'عمر بن علي')); await interact(() => p.locator('input[placeholder="0.00"]').pressSequentially('1500', { delay: 150 })); await p.getByText(T('Total you pay', 'remit.totalToPay'), { exact: true }).waitFor({ timeout: 6000 }); await sleep(1300); await glide(p, { amount: 500 }); await button(p, T('Continue', 'common.continue')); await sleep(1800); await button(p, T('Back', 'common.back')); await sleep(800); }],
  ['remit-track', '/remit/rmt_omar', async p => scrollLoop(p, 280)],
  ['business-home', '/business', async (p, T) => { await text(p, T('Team')); await sleep(1400); await button(p, T('Back', 'common.back')); await sleep(500); await text(p, T('Bulk Pay')); await sleep(800); await p.locator('input').nth(0).pressSequentially('leila.h', { delay: 70 }); await p.locator('input').nth(1).pressSequentially('420', { delay: 150 }); await sleep(800); await button(p, T('Back', 'common.back')); await sleep(500); await text(p, T('Payouts')); await sleep(1400); await text(p, T('Approve')); await sleep(2200); await button(p, T('Back', 'common.back')); await sleep(600); }],
  ['business-team', '/business/team', async p => scrollLoop(p, 320)],
  ['business-keys', '/business/api-keys', async (p, T) => { await button(p, T('Back')); await sleep(700); await text(p, T('API Keys')); await sleep(1200); await scrollLoop(p, 260); }],
  ['business-bulk', '/business/bulk-pay', async p => { await text(p, 'Add recipient'); await sleep(1200); await scrollLoop(p, 260); }],
  ['business-payouts', '/business/invoices', async (p, T) => { await text(p, T('Completed')); await sleep(1400); await text(p, T('All')); await sleep(700); await scrollLoop(p, 320); }],
  ['business-approval', '/business/invoices', async (p, T) => { await text(p, T('Approve')); await sleep(2500); await scrollLoop(p, 300); }],
  ['settings', '/settings', async (p, T) => { await glide(p, { amount: 440 }); await sleep(800); await button(p, T('Trusted devices')); await sleep(1400); await scrollLoop(p, 300); await button(p, T('Back', 'common.back')); await sleep(600); await text(p, T('Two-factor authentication')); await sleep(1700); await button(p, T('Back', 'common.back')); await glide(p, { amount: -10000 }); await sleep(600); }],
  ['devices', '/settings/devices', async p => scrollLoop(p, 340)],
  ['kyc', '/kyc', async p => scrollLoop(p, 340)],
  ['twofa', '/settings/2fa', async (p, T) => { await button(p, T('Back')); await sleep(600); await text(p, T('Two-factor authentication')); await sleep(1400); await scrollLoop(p, 280); }],
  ['history', '/history', async p => scrollLoop(p, 450)],
  ['statements', '/statements', async p => scrollLoop(p, 440)],
  ['referrals', '/referral', async p => scrollLoop(p, 270)],
  ['receive', '/receive', async (p, T) => { await text(p, T('Copy')); await sleep(1600); await scrollLoop(p, 260); }],
  ['claim', '/claim/demo-token', async p => { await p.locator('[role="button"]').filter({ hasText: '50.00' }).first().click(); await sleep(2000); await scrollLoop(p, 220); }],
  ['recurring', '/recurring', async p => { await text(p, '$25'); await sleep(1100); await text(p, '$50'); await sleep(1500); await scrollLoop(p, 250); }],
  ['linked', '/linked-accounts', async (p, T) => { await text(p, T('Bank Accounts')); await sleep(1600); await text(p, T('Cards')); await sleep(1400); }],
  ['contact', '/contact/usr_omar', async p => scrollLoop(p, 360)],
  ['exchange', '/exchange', async p => { await typeAmount(p, '250'); await sleep(1800); await clearAmount(p, 3); await sleep(800); }],
  ['withdraw', '/withdraw', async p => scrollLoop(p, 380)],
];

const flowFor = { home: 'tour-home', send: 'flow-send', buy: 'flow-buy', budgets: 'flow-budget', remit: 'flow-remit', p2p: 'flow-p2p', 'chat-payment': 'flow-chat-pay', 'privacy-hidden': 'flow-privacy', 'business-home': 'flow-business', settings: 'flow-security' };
const report = [];
for (const variant of variants) {
  const [locale, theme] = variant.split('-');
  const T = (label, key) => translated(locale, label, key), L = (english, arabic) => locale === 'ar' ? arabic : english;
  const { browser, page, cdp, errors, unmatched } = await launch({ locale, theme, dsf: 2 });
  page.setDefaultTimeout(5000);
  await bootSignedIn(page, { locale });
  await setStore(page, 'authStore', { biometricEnabled: true });
  await page.evaluate(t => document.documentElement.dataset.capTheme = t, theme);
  const orderedSpecs = selected ? [...selected].map(id => specs.find(spec => spec[0] === id)).filter(Boolean) : specs;
  for (const [id, route, action] of orderedSpecs) {
    try {
      await nav(page, '/profile', 350); await nav(page, route, 1100);
      await page.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollHeight > el.clientHeight + 12) el.scrollTop = 0; });
      await page.evaluate(() => document.fonts.ready);
      const recording = await capture(cdp, () => action(page, T, L));
      const entry = encode(recording, variant, id); report.push(entry);
      if (flowFor[id]) {
        const dest = path.join(CLIENT, 'public/app/video', variant); fs.mkdirSync(dest, { recursive: true });
        for (const ext of ['mp4', 'webm', 'jpg']) fs.copyFileSync(path.join(CLIENT, 'public/app/loops', variant, `${id}.${ext}`), path.join(dest, `${flowFor[id]}.${ext}`));
      }
      console.log(JSON.stringify(entry));
    } catch (error) { const entry = { variant, id, error: String(error).slice(0, 400), text: (await page.locator('body').innerText().catch(() => '')).slice(0, 2200) }; report.push(entry); console.error(JSON.stringify(entry)); await page.screenshot({ path: path.join(TEMP, `${variant}-${id}-failed.jpg`), type: 'jpeg', quality: 90 }).catch(() => {}); }
    fs.writeFileSync(path.join(TEMP, `report-${variants.join('_')}.json`), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify({ variant, errors: errors.filter(e => !/collapsable|onLayout|transform-origin|%s|%o/.test(e)), unmatched: [...unmatched] }));
  await browser.close();
}
