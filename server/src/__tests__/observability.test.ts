import { redactLogValue } from '../utils/redaction';
import { withDeadline } from '../services/ops/health.service';
import { routeGroup } from '../services/platform/metrics';
import express from 'express';
import request from 'supertest';
import { attachRequestContext, requestContext } from '../middleware/requestContext';
it('redacts nested credentials, HTTP configs and connection passwords', () => {
  const error = Object.assign(new Error('failed'), { config: { headers: { Authorization: 'Bearer test-key' } } });
  const value = JSON.stringify(redactLogValue({ password: 'test-password', child: { twoFactorSecret: 'test-secret' }, error, message: 'postgres://user:test-dbpass@localhost/db?token=test-token' }));
  for (const s of ['test-password', 'test-secret', 'test-key', 'test-dbpass', 'test-token']) expect(value).not.toContain(s);
});
it('health dependencies have a deadline', async () => {
  await expect(withDeadline(new Promise(() => {}), 10)).rejects.toThrow(/deadline/);
});
it('correlates async request work without accepting a client log id', async () => {
  const app = express(); app.use(attachRequestContext); app.get('/', async (_req, res) => { await Promise.resolve(); res.json(requestContext.getStore()); });
  const r = await request(app).get('/').set('X-Request-Id', 'untrusted-id');
  expect(r.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/); expect(r.body.requestId).toBe(r.headers['x-request-id']);
});
it('collapses route ids and query data', () => expect(routeGroup('GET', '/api/users/123/balances?email=private')).toBe('GET /api/users/:n/balances'));
