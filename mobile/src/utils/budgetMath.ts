/**
 * Budget savings math — powers the "how long will this take / what should I
 * save" calculations on the budget create + detail screens.
 *
 * All amounts are plain numbers in the budget's own currency. Time is modelled
 * in days, then humanised. A "period" is one contribution cadence tick.
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Average days per contribution period (MONTHLY uses 30.44 = 365.25/12). */
export function periodDays(freq: Frequency): number {
  switch (freq) {
    case 'DAILY': return 1;
    case 'WEEKLY': return 7;
    case 'BIWEEKLY': return 14;
    case 'MONTHLY': return 30.44;
  }
}

export function freqAdverb(freq: Frequency): string {
  switch (freq) {
    case 'DAILY': return 'a day';
    case 'WEEKLY': return 'a week';
    case 'BIWEEKLY': return 'every 2 weeks';
    case 'MONTHLY': return 'a month';
  }
}

/** Add `n` periods of `freq` to a date (calendar-correct for months). */
export function addPeriods(from: Date, freq: Frequency, n: number): Date {
  const d = new Date(from);
  switch (freq) {
    case 'DAILY': d.setDate(d.getDate() + n); break;
    case 'WEEKLY': d.setDate(d.getDate() + 7 * n); break;
    case 'BIWEEKLY': d.setDate(d.getDate() + 14 * n); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + n); break;
  }
  return d;
}

export interface GoalEta {
  periods: number;     // whole contributions needed (rounded up)
  days: number;        // approx calendar days
  date: Date;          // projected completion date
}

/**
 * How long to reach `target` from `saved`, contributing `perPeriod` each
 * `freq`. Returns null if the contribution can't make progress.
 */
export function etaForContribution(
  saved: number, target: number, perPeriod: number, freq: Frequency, from = new Date(),
): GoalEta | null {
  const remaining = target - saved;
  if (remaining <= 0) return { periods: 0, days: 0, date: new Date(from) };
  if (perPeriod <= 0) return null;
  const periods = Math.ceil(remaining / perPeriod);
  return { periods, days: Math.round(periods * periodDays(freq)), date: addPeriods(from, freq, periods) };
}

/**
 * The contribution per `freq` needed to hit `target` from `saved` by
 * `targetDate`. Returns null if the date is already past/now.
 */
export function requiredPerPeriod(
  saved: number, target: number, freq: Frequency, targetDate: Date, from = new Date(),
): number | null {
  const remaining = target - saved;
  if (remaining <= 0) return 0;
  const days = (targetDate.getTime() - from.getTime()) / 86_400_000;
  if (days <= 0) return null;
  const periods = Math.max(1, days / periodDays(freq));
  return remaining / periods;
}

/**
 * Suggest a sensible monthly contribution + the cadence to reach the goal in a
 * round, comfortable horizon. Used to pre-fill the auto-save fields.
 */
export function suggestPlan(saved: number, target: number, targetDate?: Date | null, from = new Date()): {
  perPeriod: number; freq: Frequency; horizonDays: number;
} | null {
  const remaining = target - saved;
  if (remaining <= 0) return null;
  let horizonDays: number;
  if (targetDate) {
    horizonDays = Math.max(7, (targetDate.getTime() - from.getTime()) / 86_400_000);
  } else {
    // No date → default to a comfortable 6-month plan.
    horizonDays = 182;
  }
  // Weekly cadence for ≤ 4 months, otherwise monthly.
  const freq: Frequency = horizonDays <= 122 ? 'WEEKLY' : 'MONTHLY';
  const periods = Math.max(1, Math.round(horizonDays / periodDays(freq)));
  const raw = remaining / periods;
  // Round to a tidy figure so the suggestion reads cleanly.
  const perPeriod = raw >= 100 ? Math.ceil(raw / 5) * 5 : Math.ceil(raw);
  return { perPeriod, freq, horizonDays };
}

/** "about 5 months", "3 weeks", "2 days" — human, approximate. */
export function humanizeDays(days: number): string {
  if (days <= 0) return 'now';
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
  if (days < 60) { const w = Math.round(days / 7); return `${w} week${w === 1 ? '' : 's'}`; }
  if (days < 365) { const m = Math.round(days / 30.44); return `about ${m} month${m === 1 ? '' : 's'}`; }
  const years = days / 365.25;
  const y = Math.floor(years);
  const months = Math.round((years - y) * 12);
  if (months === 0) return `about ${y} year${y === 1 ? '' : 's'}`;
  return `about ${y}y ${months}m`;
}

/** Short date like "Jun 2027" / "12 Jun 2027" for projected completion. */
export function fmtGoalDate(d: Date, withDay = false): string {
  return d.toLocaleDateString('en-US', withDay
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { month: 'short', year: 'numeric' });
}
