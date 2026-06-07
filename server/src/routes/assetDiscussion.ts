import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AssetDiscussionController } from '../controllers/assetDiscussion.controller';

export const assetDiscussionRouter = Router();

assetDiscussionRouter.use(authenticate);
assetDiscussionRouter.get('/:symbol', AssetDiscussionController.list);
assetDiscussionRouter.post('/:symbol', AssetDiscussionController.create);
