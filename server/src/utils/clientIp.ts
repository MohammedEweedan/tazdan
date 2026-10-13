/**
 * The key per-IP rate limits and IP bans count against.
 *
 * - IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is the same client as `1.2.3.4`.
 * - IPv6 is keyed on its /64: one subscriber (home router, phone) is
 *   normally handed a whole /64, so keying on the full 128-bit address let a
 *   single client rotate addresses and get a fresh limit (and dodge bans)
 *   on every request. express-rate-limit 7 does not mask IPv6 by itself.
 */
function expandIPv6(addr: string): string[] | null {
  if (addr.includes('.')) return null;
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.map((g) => g.toLowerCase().padStart(4, '0'));
}

export function clientIpKey(ip: string | undefined | null): string {
  if (!ip) return 'unknown';
  let a = ip.trim().split('%')[0];
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(a)) a = a.slice(7);
  if (!a.includes(':')) return a;
  const groups = expandIPv6(a);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : a.toLowerCase();
}
