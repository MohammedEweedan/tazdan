/**
 * "Near me" P2P discovery: coordinate parsing, coarsening and the rounded
 * distance viewers are shown.
 */
import { coarsenCoord, displayDistanceKm, haversineKm, isValidLatLng, parseNear } from '../utils/geo';

describe('parseNear', () => {
  it('parses and coarsens a lat,lng pair to ~1 km', () => {
    expect(parseNear('32.88721,13.19134')).toEqual({ lat: 32.89, lng: 13.19 });
  });

  it.each([undefined, '', 'abc', '32.8', '91,13', '32,181', 'NaN,1', '1,2,3'.repeat(20), 42])('rejects %p', (raw) => {
    expect(parseNear(raw)).toBeNull();
  });
});

describe('isValidLatLng', () => {
  it('accepts the bounds and rejects outside them', () => {
    expect(isValidLatLng(-90, 180)).toBe(true);
    expect(isValidLatLng(90.01, 0)).toBe(false);
    expect(isValidLatLng(0, -180.01)).toBe(false);
    expect(isValidLatLng('1' as unknown, 2)).toBe(false);
  });
});

describe('haversineKm', () => {
  it('measures Tripoli → Benghazi at roughly 650 km', () => {
    const km = haversineKm({ lat: 32.89, lng: 13.19 }, { lat: 32.12, lng: 20.09 });
    expect(km).toBeGreaterThan(630);
    expect(km).toBeLessThan(670);
  });

  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBe(0);
  });
});

describe('displayDistanceKm', () => {
  it('never shows less than 1 km', () => {
    expect(displayDistanceKm(0)).toBe(1);
    expect(displayDistanceKm(1.2)).toBe(1);
  });

  it('gets coarser with distance', () => {
    expect(displayDistanceKm(3.4)).toBe(3);
    expect(displayDistanceKm(23)).toBe(25);
    expect(displayDistanceKm(647)).toBe(650);
  });
});

describe('coarsenCoord', () => {
  it('rounds to 2 decimals', () => {
    expect(coarsenCoord(13.19634)).toBe(13.2);
    expect(coarsenCoord(-0.004)).toBe(-0);
  });
});
