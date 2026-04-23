import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ExportController } from '../controllers/export.controller';

const router = Router();

router.get('/csv', authenticate, ExportController.exportCSV);
router.get('/json', authenticate, ExportController.exportJSON);
router.get('/portfolio-history', authenticate, ExportController.getPortfolioHistory);

export { router as exportRouter };
