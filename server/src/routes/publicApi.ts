import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey';
import { apiKeyLimiter } from '../middleware/rateLimiters';
import { PublicApiController as V } from '../controllers/publicApi.controller';

/** Public business API (API-key auth, per-key rate limit). */
const router = Router();
const key = (scope: Parameters<typeof requireApiKey>[0]) => [requireApiKey(scope), apiKeyLimiter];

router.get('/balances', ...key('BALANCES'), V.balances);
router.get('/rates', ...key('RATES'), V.rates);
router.post('/payouts', ...key('PAYOUTS'), V.createPayout);
router.get('/payouts', ...key('PAYOUTS'), V.listPayouts);
router.get('/payouts/:id', ...key('PAYOUTS'), V.getPayout);
router.get('/batches/:id', ...key('PAYOUTS'), V.getBatch);
router.get('/webhooks', ...key('WEBHOOKS'), V.listWebhooks);
router.post('/webhooks', ...key('WEBHOOKS'), V.createWebhook);
router.delete('/webhooks/:id', ...key('WEBHOOKS'), V.deleteWebhook);

export { router as publicApiRouter };
