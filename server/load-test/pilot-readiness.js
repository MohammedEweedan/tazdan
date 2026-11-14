// Read-only capacity rehearsal. Never creates users or credits money.
// EXPECTED_PEAK_RPS=10 LOAD_TEST_ACK=test-accounts-only TOKEN=<test token>
// BASE_URL=http://localhost:5001/api k6 run load-test/pilot-readiness.js
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
const peak = Number(__ENV.EXPECTED_PEAK_RPS);
if (!Number.isInteger(peak) || peak < 1 || peak > 10000) throw new Error('Set the expected pilot peak RPS (1–10000)');
if (__ENV.LOAD_TEST_ACK !== 'test-accounts-only' || !__ENV.TOKEN) throw new Error('A test-account token and explicit test-account acknowledgement are required');
const base = (__ENV.BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');
const success = new Counter('successful_read_journeys');
export const options = {
  scenarios: { pilot: { executor: 'ramping-arrival-rate', startRate: peak, timeUnit: '1s', preAllocatedVUs: Math.max(10, peak), maxVUs: Math.min(1000, Math.max(30, peak * 6)), stages: [{ target: peak, duration: __ENV.STAGE_DURATION || '1m' }, { target: peak * 3, duration: __ENV.STAGE_DURATION || '3m' }, { target: 0, duration: '30s' }] } },
  thresholds: { http_req_failed: ['rate<0.001'], http_req_duration: ['p(95)<2000'], checks: ['rate>0.999'], dropped_iterations: ['count==0'] },
};
export default function () {
  const r = http.get(`${base}/wallets`, { headers: { Authorization: `Bearer ${__ENV.TOKEN}` }, tags: { name: 'authenticated-wallet-read' } });
  const ok = check(r, { 'wallet read returns a JSON success': response => response.status === 200 && response.headers['Content-Type']?.includes('application/json'), 'request is traceable': response => Boolean(response.headers['X-Request-Id']) });
  if (ok) success.add(1);
}
export function handleSummary(data) { return { [__ENV.REPORT_PATH || '/tmp/tazdan-pilot-load-report.json']: JSON.stringify({ kind: 'read-only capacity rehearsal', expectedPeakRps: peak, testedPeakRps: peak * 3, metrics: data.metrics, limits: 'Does not measure settlement, provider capacity, device crashes or real customer journeys.' }, null, 2) }; }
