/**
 * Forecasting from the platform's own history.
 *
 * Method: Holt's linear exponential smoothing (level + trend) fitted to a
 * daily series; the prediction interval widens with the horizon using the
 * in-sample one-step residual spread (≈80% band at ±1.28σ√h). Smoothing
 * parameters are chosen by a small grid search minimising one-step squared
 * error. Forecasts never go below zero for non-negative quantities.
 *
 * Honesty rules: with fewer than MIN_POINTS non-zero days the result is
 * flagged `insufficientHistory` and the band is very wide; every result
 * carries its method, fitted parameters and assumptions.
 */
export interface ForecastPoint { day: string; value: number; low: number; high: number }
export interface ForecastResult {
  method: string;
  alpha: number;
  beta: number;
  residualStd: number;
  horizonDays: number;
  insufficientHistory: boolean;
  historyDays: number;
  nonZeroDays: number;
  assumptions: string[];
  forecast: ForecastPoint[];
}

const MIN_POINTS = 14;

function holt(series: number[], alpha: number, beta: number) {
  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  let sse = 0;
  const residuals: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const predicted = level + trend;
    const err = series[i] - predicted;
    residuals.push(err);
    sse += err * err;
    const newLevel = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
  }
  return { level, trend, sse, residuals };
}

export function forecastSeries(days: string[], values: number[], horizonDays = 30, opts: { nonNegative?: boolean; label?: string } = {}): ForecastResult {
  const nonZero = values.filter((v) => v !== 0).length;
  const assumptions = [
    'Based only on this platform\'s recorded daily activity; no external market data.',
    'Assumes the recent level and trend continue — product launches, regulation, partner changes or seasonality are not modelled.',
    'Values are in today\'s units (USD at current rates where money is involved).',
  ];
  if (values.length < 3) {
    return { method: 'insufficient data', alpha: 0, beta: 0, residualStd: 0, horizonDays, insufficientHistory: true, historyDays: values.length, nonZeroDays: nonZero, assumptions, forecast: [] };
  }
  let best = { alpha: 0.5, beta: 0.1, sse: Infinity };
  for (const a of [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]) {
    for (const b of [0.01, 0.05, 0.1, 0.2, 0.4]) {
      const r = holt(values, a, b);
      if (r.sse < best.sse) best = { alpha: a, beta: b, sse: r.sse };
    }
  }
  const fit = holt(values, best.alpha, best.beta);
  const mean = fit.residuals.reduce((a, b) => a + b, 0) / Math.max(1, fit.residuals.length);
  const std = Math.sqrt(fit.residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, fit.residuals.length - 1));
  const insufficient = nonZero < MIN_POINTS;
  if (insufficient) assumptions.unshift(`Only ${nonZero} days with activity — treat this as an illustration, not a forecast.`);
  const lastDay = new Date(`${days[days.length - 1]}T00:00:00Z`);
  const z = 1.28; // ~80% interval
  const forecast: ForecastPoint[] = [];
  for (let h = 1; h <= horizonDays; h++) {
    const d = new Date(lastDay.getTime() + h * 86400_000).toISOString().slice(0, 10);
    let value = fit.level + h * fit.trend;
    const spread = z * std * Math.sqrt(h) * (insufficient ? 2 : 1);
    let low = value - spread; let high = value + spread;
    if (opts.nonNegative !== false) { value = Math.max(0, value); low = Math.max(0, low); high = Math.max(0, high); }
    forecast.push({ day: d, value: Math.round(value * 100) / 100, low: Math.round(low * 100) / 100, high: Math.round(high * 100) / 100 });
  }
  return {
    method: 'Holt linear exponential smoothing (level + trend), ~80% prediction interval',
    alpha: best.alpha, beta: best.beta, residualStd: Math.round(std * 100) / 100, horizonDays,
    insufficientHistory: insufficient, historyDays: values.length, nonZeroDays: nonZero, assumptions, forecast,
  };
}
