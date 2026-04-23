import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';

const messageRouter = Router();

messageRouter.use(authenticate);
messageRouter.post('/', MessageController.send);
messageRouter.get('/conversations', MessageController.getConversations);
messageRouter.get('/:userId', MessageController.getMessages);

export { messageRouter };
