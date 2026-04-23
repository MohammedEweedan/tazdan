import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { OrderController } from '../controllers/order.controller';

export const orderRouter = Router();

orderRouter.post('/', authenticate, OrderController.placeOrder);
orderRouter.get('/', authenticate, OrderController.getAll);
