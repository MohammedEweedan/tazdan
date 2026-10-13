// Shared Playwright harness for tazdan marketing captures.
// - fictional persona served via network interception (fixtures.mjs)
// - socket.io + Binance websockets stubbed
// - locale/theme injected into localStorage (AsyncStorage on web)
// Install playwright-core in this directory, or point PLAYWRIGHT_MODULE at an
// existing package. No browser session or production credentials are reused.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
import { handleApi, handleExternal, createWorld, setWorld } from './fixtures.mjs';

export const EXE = process.env.CHROME_BIN || process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
export const APP_URL = process.env.APP_URL || 'http://localhost:8081';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const HIDE_CSS = `
  *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  html, body { overscroll-behavior: none !important; }
  /* Expo / RN-web dev overlays */
  #expo-dev-overlay, [data-testid="dev-loading-view"], iframe#webpack-dev-server-client-overlay { display: none !important; }
  input, textarea { caret-color: transparent; }
  *:focus, *:focus-visible { outline: none !important; }
`;

export async function launch({ locale = 'en', theme = 'dark', hidden = false, dsf = 3, log = false, extraStorage = {}, headless = true, recordVideo } = {}) {
  const browser = await chromium.launch({ executablePath: EXE, headless, args: ['--hide-scrollbars', '--font-render-hinting=none'] });
  const context = await browser.newContext({
    ...(recordVideo ? { recordVideo } : {}),
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: dsf,
    colorScheme: theme === 'light' ? 'light' : 'dark',
    isMobile: true,
    hasTouch: true,
    locale: locale === 'ar' ? 'ar-LY' : 'en-GB',
    timezoneId: 'Africa/Tripoli',
    geolocation: { latitude: 32.8872, longitude: 13.1913 }, // Tripoli city centre (coarse)
    permissions: ['geolocation'],
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const storage = {
    'tazdan.locale': locale,
    'tazdan.theme': theme,
    'ui.balancesHidden': hidden ? '1' : '0',
    '@announcements_opted_out': 'true',
    'review.asked': '1',
    ...extraStorage,
  };
  await context.addInitScript(({ storage, css }) => {
    try { for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v); } catch {}
    const add = () => {
      if (document.getElementById('__cap_css')) return;
      const s = document.createElement('style'); s.id = '__cap_css'; s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
    // Silence native alert() dialogs that RN-web maps to window.alert
    window.alert = () => {};
  }, { storage, css: HIDE_CSS });

  const world = createWorld(locale);
  setWorld(world);
  await context.addInitScript(statusBarScript, { theme });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  const unmatched = new Set();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  // Only the local Expo bundle and image/font assets may pass through. Every
  // API operation is handled below; an unexpected API host is never contacted.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (['fetch', 'xhr'].includes(request.resourceType()) && url.origin !== new URL(APP_URL).origin) {
      unmatched.add(`BLOCKED ${request.method()} ${url.origin}${url.pathname}`);
      await route.abort();
    } else await route.continue();
  });

  await context.route('http://localhost:5001/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    const res = handleApi(req.method(), url.pathname.replace(/^\/api/, ''), url.searchParams, body, { unmatched });
    if (log) console.log(`[api] ${req.method()} ${url.pathname}${url.search} -> ${res.status ?? 200}`);
    if (res.delay) await sleep(res.delay);
    await route.fulfill({
      status: res.status ?? 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      body: JSON.stringify(res.json ?? {}),
    });
  });
  // External market data → deterministic fixtures. Images pass through.
  await context.route(/https:\/\/(api\.binance\.com|api\.coingecko\.com)\/.*/, async (route) => {
    const res = handleExternal(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
  });
  // Socket.IO (websocket transport): minimal Engine.IO v4 handshake so the
  // client sees a healthy connection and never errors.
  await context.routeWebSocket(/localhost:5001\/socket\.io/, (ws) => {
    ws.send('0' + JSON.stringify({ sid: 'cap' + Math.random().toString(36).slice(2), upgrades: [], pingInterval: 25000, pingTimeout: 60000, maxPayload: 1000000 }));
    ws.onMessage((m) => {
      const s = String(m);
      if (s.startsWith('40')) ws.send('40' + JSON.stringify({ sid: 'sock' + Math.random().toString(36).slice(2) }));
      else if (s === '2') ws.send('3');
    });
  });
  await context.routeWebSocket(/stream\.binance\.com/, (ws) => { /* hold open, never tick */ });

  return { browser, context, page, errors, unmatched, world, cdp };
}

/** Client-side navigation inside the SPA (keeps the in-memory session). */
export async function nav(page, path, wait = 1800) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, path);
  await sleep(wait);
}

export async function textVisible(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

export async function clickText(page, text, opts = {}) {
  const loc = page.getByText(text, { exact: opts.exact ?? false }).first();
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 10000 });
  await loc.click({ force: opts.force ?? false });
}

/**
 * Boot to the signed-in home screen through the real login UI.
 * Returns once the home screen has rendered.
 */
export async function bootSignedIn(page, { locale = 'en', onboardingShot = null } = {}) {
  await page.goto(APP_URL + '/', { waitUntil: 'load', timeout: 180000 });
  await patchRuntime(page);
  // Onboarding (fresh web session always lands here)
  await page.waitForFunction(() => location.pathname.includes('onboarding') || location.pathname.includes('login'), null, { timeout: 60000 });
  await sleep(2500);
  if (onboardingShot) await onboardingShot(page);
  if (page.url().includes('onboarding')) {
    const loginLabel = locale === 'ar' ? null : 'I already have an account';
    // Click the "have account" button: it's the last pressable at the bottom.
    const btn = await page.evaluateHandle(() => {
      const els = [...document.querySelectorAll('[role="button"]')];
      return els[els.length - 1];
    });
    await btn.asElement().click();
    await page.waitForFunction(() => location.pathname.includes('login'), null, { timeout: 20000 });
    await sleep(1200);
  }
  // Fill login form
  const inputs = page.locator('input');
  await inputs.first().waitFor({ timeout: 20000 });
  await inputs.nth(0).fill('amira@example.com');
  await inputs.nth(1).fill('illustrative-only-1');
  const cta = locale === 'ar' ? 'تسجيل الدخول' : 'Log in';
  await page.locator(`[aria-label="${cta}"]`).first().click();
  await page.waitForFunction(() => !location.pathname.includes('login') && !location.pathname.includes('onboarding'), null, { timeout: 30000 });
  await sleep(3500);
}

export async function shot(page, path, { fullPage = false } = {}) {
  await page.screenshot({ path, fullPage, animations: 'allow', caret: 'hide' });
}

/* iOS-style status bar + home indicator drawn over the 59px / 34px safe areas.
   Ink follows the theme; call setInk(page,'light'|'dark') to override per screen. */
function statusBarScript({ theme }) {
  const ink0 = theme === 'light' ? '#0B0B0C' : '#FFFFFF';
  const svg = (ink) => `
    <div style="position:absolute;left:0;top:0;width:139px;height:59px;display:flex;align-items:center;justify-content:center;padding-top:4px;box-sizing:border-box">
      <span style="font-family:-apple-system,'SF Pro Text','SF Pro Display',system-ui,'Helvetica Neue',sans-serif;font-size:17px;font-weight:600;letter-spacing:-0.2px;color:${ink}">9:41</span>
    </div>
    <div style="position:absolute;right:0;top:0;width:139px;height:59px;display:flex;align-items:center;justify-content:center;gap:6px;padding-top:4px;box-sizing:border-box">
      <svg width="19" height="12" viewBox="0 0 19 12" fill="${ink}"><rect x="0" y="8" width="3.2" height="4" rx="0.9"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="0.9"/><rect x="10" y="3" width="3.2" height="9" rx="0.9"/><rect x="15" y="0" width="3.2" height="12" rx="0.9"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="${ink}"><path d="M8.5 2.6c2.3 0 4.4.9 6 2.4l1.1-1.1C13.7 2 11.2 1 8.5 1S3.3 2 1.4 3.9L2.5 5c1.6-1.5 3.7-2.4 6-2.4z"/><path d="M8.5 6c1.4 0 2.6.5 3.6 1.4l1.1-1.1C11.9 5.1 10.3 4.4 8.5 4.4S5.1 5.1 3.8 6.3l1.1 1.1C5.9 6.5 7.1 6 8.5 6z"/><path d="M8.5 9.3c.6 0 1.1.2 1.5.6L8.5 11.4 7 9.9c.4-.4.9-.6 1.5-.6z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.6" fill="none" stroke="${ink}" stroke-opacity="0.38"/><rect x="2" y="2" width="20" height="9" rx="2.3" fill="${ink}"/><path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1z" fill="${ink}" fill-opacity="0.4"/></svg>
    </div>`;
  const mount = () => {
    if (document.getElementById('__cap_sb')) return;
    const sb = document.createElement('div'); sb.id = '__cap_sb';
    sb.style.cssText = 'position:fixed;left:0;right:0;top:0;height:59px;z-index:2147483647;pointer-events:none;';
    const hi = document.createElement('div'); hi.id = '__cap_hi';
    hi.style.cssText = 'position:fixed;left:50%;bottom:8px;width:134px;height:5px;margin-left:-67px;border-radius:3px;z-index:2147483647;pointer-events:none;';
    const set = (ink) => { sb.innerHTML = svg(ink); hi.style.background = ink; hi.style.opacity = '0.35'; sb.dataset.ink = ink; };
    window.__capSetInk = (mode) => set(mode === 'light' ? '#FFFFFF' : mode === 'dark' ? '#0B0B0C' : ink0);
    window.__capChrome = (on) => { sb.style.display = on ? '' : 'none'; hi.style.display = on ? '' : 'none'; };
    set(ink0);
    document.documentElement.appendChild(sb); document.documentElement.appendChild(hi);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
}
export async function setInk(page, mode = 'auto') { await page.evaluate((m) => window.__capSetInk?.(m), mode); }

/**
 * Runtime shims via the Metro module registry (dev bundle) — emulate what an
 * iPhone build has and web lacks: Face ID (expo-local-authentication) and
 * native UIAlertController (RN-web's Alert.alert is a no-op). Alerts are drawn
 * as an iOS-style dialog and the confirming button is pressed automatically.
 */
export async function patchRuntime(page, { alertDelay = 1300, biometric = true } = {}) {
  await page.waitForFunction(() => typeof window.__r === 'function', null, { timeout: 60000 });
  await page.evaluate(({ alertDelay, biometric }) => {
    const mods = window.__r.getModules();
    const entries = mods instanceof Map ? [...mods.entries()] : Object.entries(mods);
    const find = (re) => { for (const [k, m] of entries) if (m?.verboseName && re.test(m.verboseName)) { try { return window.__r(Number(k)); } catch { return null; } } return null; };
    window.__capFind = find;
    if (biometric) {
      const la = find(/expo-local-authentication\/build\/ExpoLocalAuthentication\.web\.js$/);
      const obj = la?.default ?? la;
      if (obj) {
        obj.hasHardwareAsync = async () => true;
        obj.isEnrolledAsync = async () => true;
        obj.getEnrolledLevelAsync = async () => 3;
        obj.supportedAuthenticationTypesAsync = async () => [2];
        obj.authenticateAsync = async () => { await new Promise((r) => setTimeout(r, 450)); return { success: true }; };
      }
    }
    const al = find(/react-native-web\/dist\/exports\/Alert\/index\.js$/);
    const A = al?.default ?? al;
    window.__capAlerts = [];
    const draw = (title, message, buttons) => {
      window.__capAlerts.push({ title, message });
      console.log('[capAlert] ' + title + ' :: ' + (message ?? ''));
      const btns = (buttons && buttons.length ? buttons : [{ text: 'OK' }]);
      const dark = (document.documentElement.dataset.capTheme ?? 'dark') !== 'light';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);transition:opacity .18s;opacity:0';
      const box = document.createElement('div');
      box.style.cssText = `width:270px;border-radius:14px;overflow:hidden;background:${dark ? 'rgba(44,44,46,0.94)' : 'rgba(242,242,247,0.96)'};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);font-family:-apple-system,'SF Pro Text',system-ui,sans-serif;text-align:center;transform:scale(1.08);transition:transform .2s`;
      const ink = dark ? '#fff' : '#000';
      box.innerHTML = `<div style="padding:19px 16px 15px"><div style="font-size:17px;font-weight:600;color:${ink};line-height:22px">${title ?? ''}</div>${message ? `<div style="font-size:13px;color:${ink};opacity:.85;margin-top:3px;line-height:17px">${message}</div>` : ''}</div>`;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;border-top:0.5px solid ${dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)'}`;
      const confirm = btns.find((b) => b.style !== 'cancel') ?? btns[0];
      btns.forEach((b, i) => {
        const el = document.createElement('div');
        el.textContent = b.text ?? 'OK';
        el.style.cssText = `flex:1;padding:11px 8px;font-size:17px;color:${b.style === 'destructive' ? '#FF453A' : '#0A84FF'};font-weight:${b === confirm ? 600 : 400};${i ? `border-left:0.5px solid ${dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)'}` : ''};transition:background .12s`;
        el.dataset.confirm = b === confirm ? '1' : '0';
        row.appendChild(el);
      });
      box.appendChild(row); wrap.appendChild(box); document.documentElement.appendChild(wrap);
      requestAnimationFrame(() => { wrap.style.opacity = '1'; box.style.transform = 'scale(1)'; });
      setTimeout(() => {
        const el = row.querySelector('[data-confirm="1"]'); if (el) el.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        setTimeout(() => { wrap.style.opacity = '0'; setTimeout(() => wrap.remove(), 200); try { confirm?.onPress?.(); } catch (e) { console.log('alert cb error', e); } }, 260);
      }, alertDelay);
    };
    if (A) A.alert = draw;
  }, { alertDelay, biometric });
}

/** Zustand store access (dev bundle) — e.g. setStore(page, 'authStore', { biometricEnabled: true }). */
export async function setStore(page, name, patch) {
  await page.evaluate(({ name, patch }) => {
    const m = window.__capFind(new RegExp(`src/store/${name}\\.ts$`));
    const hook = m && Object.values(m).find((v) => typeof v === 'function' && typeof v.setState === 'function');
    hook?.setState(patch);
  }, { name, patch });
}
