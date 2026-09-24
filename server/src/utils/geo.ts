/**
 * Coarse geolocation for "near me" P2P discovery.
 *
 * Privacy model: a listing's coordinates are rounded to 2 decimals (~1.1 km)
 * before they are stored, never leave the server, and only surface as a
 * rounded distance from the viewer. Viewer coordinates are used for the one
 * request and never stored or logged.
 */

export interface LatLng { lat: number; lng: number }

const EARTH_RADIUS_KM = 6371;

/** Round to 2 decimals (~1.1 km at the equator). */
export function coarsenCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Parse a `lat,lng` query value. Returns null for anything malformed. */
export function parseNear(raw: unknown): LatLng | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const [a, b] = raw.split(',');
  const lat = Number(a);
  const lng = Number(b);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat: coarsenCoord(lat), lng: coarsenCoord(lng) };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The distance a viewer is shown. Coarser the further out, and never below
 * 1 km, so repeated queries from different spots can't pin a seller down
 * more precisely than their already-rounded coordinates.
 */
export function displayDistanceKm(km: number): number {
  if (km < 1.5) return 1;
  if (km < 10) return Math.round(km);
  if (km < 50) return Math.round(km / 5) * 5;
  return Math.round(km / 10) * 10;
}
