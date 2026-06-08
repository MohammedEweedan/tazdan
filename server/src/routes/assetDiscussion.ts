import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AssetDiscussionController } from '../controllers/assetDiscussion.controller';

export const assetDiscussionRouter = Router();

assetDiscussionRouter.use(authenticate);
assetDiscussionRouter.get('/moderation/queue', AssetDiscussionController.moderationQueue);
assetDiscussionRouter.get('/:symbol', AssetDiscussionController.list);
assetDiscussionRouter.post('/:symbol', AssetDiscussionController.create);
assetDiscussionRouter.post('/:symbol/:id/report', AssetDiscussionController.report);
assetDiscussionRouter.delete('/:symbol/:id', AssetDiscussionController.remove);
