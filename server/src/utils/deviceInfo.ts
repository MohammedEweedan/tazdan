/**
 * Device + geo helpers for the security screens (trusted devices / sessions).
 *
 * No external deps: the user-agent is parsed with small, well-targeted regexes
 * (we only need a friendly name, type, and OS — not a full UA database), and
 * geo-IP is resolved via a free, no-key lookup (ip-api.com) with an in-memory
 * cache so listing sessions doesn't hammer the upstream.
 */

export interface ParsedDevice {
  name: string;          // e.g. "iPhone", "Chrome on Windows"
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;            // e.g. "iOS 17.4", "Windows", "Android 14"
  browser?: string;      // e.g. "Safari", "Chrome"
}

/** Parse a user-agent into a friendly device descriptor. */
export function parseUserAgent(ua: string | null | undefined): ParsedDevice {
  if (!ua) return { name: 'Unknown device', type: 'unknown', os: 'Unknown' };

  // OS + version
  let os = 'Unknown';
  const iosM = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/i);
  const androidM = ua.match(/Android (\d+(?:\.\d+)?)/i);
  const winM = ua.match(/Windows NT (\d+\.\d+)/i);
  const macM = ua.match(/Mac OS X (\d+)[_.](\d+)/i);
  if (iosM) os = `iOS ${iosM[1]}.${iosM[2]}`;
  else if (androidM) os = `Android ${androidM[1]}`;
  else if (winM) {
    const map: Record<string, string> = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };
    os = map[winM[1]] ?? 'Windows';
  } else if (macM) os = `macOS ${macM[1]}.${macM[2]}`;
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Type
  let type: ParsedDevice['type'] = 'unknown';
  if (/iPad|Tablet/i.test(ua)) type = 'tablet';
  else if (/Mobi|iPhone|Android.*Mobile/i.test(ua)) type = 'mobile';
  else if (/Macintosh|Windows|Linux|X11/i.test(ua)) type = 'desktop';

  // Browser / app
  let browser: string | undefined;
  if (/Tazdan|Expo|okhttp|CFNetwork/i.test(ua)) browser = 'Tazdan App';
  else if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  // Friendly name
  let name: string;
  if (/iPhone/i.test(ua)) name = 'iPhone';
  else if (/iPad/i.test(ua)) name = 'iPad';
  else if (/Android/i.test(ua)) name = type === 'tablet' ? 'Android tablet' : 'Android phone';
  else if (/Macintosh/i.test(ua)) name = browser ? `Mac · ${browser}` : 'Mac';
  else if (/Windows/i.test(ua)) name = browser ? `Windows · ${browser}` : 'Windows PC';
  else if (browser) name = browser;
  else name = 'Unknown device';

  return { name, type, os, browser };
}

interface GeoEntry { at: number; location: string }
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const geoCache = new Map<string, GeoEntry>();

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') ||
    ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') || ip.startsWith('fd') || ip === 'unknown'
  );
}

/**
 * Resolve "City, Country" for an IP. Returns 'Local network' for private IPs
 * and null on failure (callers should fall back gracefully). Cached 24h.
 */
export async function geoLocate(ipRaw: string | null | undefined): Promise<string | null> {
  if (!ipRaw) return null;
  // Normalise IPv6-mapped IPv4 (::ffff:1.2.3.4) and proxy lists ("a, b").
  const ip = ipRaw.replace(/^::ffff:/, '').split(',')[0].trim();
  if (!ip) return null;
  if (isPrivateIp(ip)) return 'Local network';

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.location;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json() as { status?: string; city?: string; country?: string };
    if (d.status !== 'success') return null;
    const location = [d.city, d.country].filter(Boolean).join(', ') || null;
    if (location) geoCache.set(ip, { at: Date.now(), location });
    return location;
  } catch {
    return null;
  }
}
