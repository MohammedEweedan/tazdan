import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { NewsController } from '../controllers/news.controller';

export const newsRouter = Router();

// Authenticated so we can rate-limit per user later without a
// separate IP-based limiter; the mobile app always has a token by
// the time it loads asset detail anyway.
newsRouter.get('/', authenticate, NewsController.list);
