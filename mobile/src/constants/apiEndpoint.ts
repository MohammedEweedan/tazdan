/** Pure endpoint policy shared by HTTP, uploads and Socket.IO. */
export interface ApiEnvironment {
  development: boolean;
  platform: string;
  isDevice?: boolean;
  metroHost?: string | null;
  webHostname?: string;
  developmentBase?: string;
  localTestBuild?: boolean;
  localTestBase?: string;
  productionBase?: string;
  legacyBase?: string;
  port?: string;
}
const PRODUCTION_API = 'https://api.promrkts.com';

function hostname(value: string): string {
  try { return new URL(value.includes('://') ? value : `http://${value}`).hostname; }
  catch { throw new Error('Invalid API or Metro hostname. Check the mobile environment configuration.'); }
}
function localHost(host: string): boolean {
  return /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)
    || host === '[::1]' || host === '[::]' || /^\[f[cd]/i.test(host)
    || /^\[fe[89ab]/i.test(host) || host.endsWith('.local') || !host.includes('.');
}
export function normalizeApiBase(base: string, development: boolean): string {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('API base must be an HTTP(S) URL without credentials, query or fragment.');
  }
  if (!development && (url.protocol !== 'https:' || localHost(url.hostname))) {
    throw new Error('Release builds require a public HTTPS API. Set EXPO_PUBLIC_PROD_API_BASE.');
  }
  // Existing production proxy exposes /auth, /wallets, etc. at the root.
  if (url.hostname === 'api.promrkts.com') return url.origin;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path.endsWith('/api') ? path : `${path}/api`}`;
}
export function resolveApiBase(env: ApiEnvironment): string {
  if (env.localTestBuild) {
    if (!env.localTestBase) throw new Error('Local iOS test builds require EXPO_PUBLIC_LOCAL_TEST_API_BASE.');
    const testUrl = new URL(env.localTestBase);
    if (!localHost(testUrl.hostname)) throw new Error('Local iOS test builds require a LAN API host.');
    return normalizeApiBase(env.localTestBase, true);
  }
  // Standard release builds ignore development overrides.
  const override = env.development
    ? env.developmentBase || env.legacyBase
    : env.productionBase || env.legacyBase || PRODUCTION_API;
  if (override) return normalizeApiBase(override, env.development);
  const port = env.port || '5001';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid EXPO_PUBLIC_DEV_API_PORT.');
  let host = env.platform === 'web' && env.webHostname
    ? env.webHostname : env.metroHost ? hostname(env.metroHost) : 'localhost';
  // Android emulators cannot reach the host machine through localhost.
  if (env.platform === 'android' && env.isDevice === false) host = '10.0.2.2';
  else if (env.platform === 'android' && /^(localhost|127\.0\.0\.1)$/.test(host)) host = '10.0.2.2';
  return normalizeApiBase(`http://${host}:${port}`, true);
}
