/**
 * LYD rate jump guard: a feed switch must not move a quote silently.
 */
import { guardRateJump, noteAcceptedRate, resetRateJumpGuard } from '../services/exchange/fxRateProvider.service';

describe('LYD rate jump guard', () => {
  beforeEach(() => resetRateJumpGuard());
  const t0 = Date.UTC(2026, 9, 8, 10, 0, 0);

  it('accepts normal moves and holds a large jump for 15 minutes, then pauses quotes', () => {
    expect(guardRateJump('USD/LYD', 9.30, 'fulus', t0)).toEqual({ mid: 9.30, held: false });
    expect(guardRateJump('USD/LYD', 9.45, 'fulus', t0 + 60_000)).toEqual({ mid: 9.45, held: false }); // +1.6%
    // The fallback feed reports the official-like rate: −32%.
    expect(guardRateJump('USD/LYD', 6.42, 'scraper', t0 + 120_000)).toEqual({ mid: 9.45, held: true });
    expect(() => guardRateJump('USD/LYD', 6.42, 'scraper', t0 + 60_000 + 16 * 60_000)).toThrow(/paused until treasury confirms/);
  });

  it('a confirmed override becomes the reference, and a long gap resets it', () => {
    guardRateJump('USD/LYD', 6.42, 'fulus', t0);
    noteAcceptedRate('USD/LYD', 9.30, t0 + 60_000); // treasury-approved override
    expect(guardRateJump('USD/LYD', 9.36, 'scraper', t0 + 120_000)).toEqual({ mid: 9.36, held: false });
    expect(guardRateJump('USD/LYD', 12.0, 'scraper', t0 + 3 * 3600_000)).toEqual({ mid: 12.0, held: false }); // after the 2 h window
  });

  it('guards each pair separately', () => {
    guardRateJump('USD/LYD', 9.3, 'fulus', t0);
    expect(guardRateJump('EUR/LYD', 10.4, 'fulus', t0)).toEqual({ mid: 10.4, held: false });
  });
  it('accepts every finite positive Fulus move without holding an older price', () => {
    noteAcceptedRate('USD/LYD', 9.3, t0);
    expect(guardRateJump('USD/LYD', 93, 'fulus', t0 + 1)).toEqual({ mid: 93, held: false });
    expect(guardRateJump('USD/LYD', .5, 'fulus', t0 + 2)).toEqual({ mid: .5, held: false });
    for (const invalid of [0, -1, NaN, Infinity]) expect(() => guardRateJump('USD/LYD', invalid, 'fulus', t0 + 3)).toThrow('Invalid FX rate');
  });

});
