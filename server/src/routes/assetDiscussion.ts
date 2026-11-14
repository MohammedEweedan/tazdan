import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { requirePermission } from '../services/platform/rbac';
import { AssetDiscussionController } from '../controllers/assetDiscussion.controller';

export const assetDiscussionRouter = Router();

assetDiscussionRouter.use(authenticate);
// Moderation is a staff action: DB-rechecked admin gate plus a permission,
// not the role claim inside the access token.
assetDiscussionRouter.get('/moderation/queue', requireAdmin, requirePermission('support.read'), AssetDiscussionController.moderationQueue);
assetDiscussionRouter.get('/:symbol', AssetDiscussionController.list);
assetDiscussionRouter.post('/:symbol', AssetDiscussionController.create);
assetDiscussionRouter.post('/:symbol/:id/replies', AssetDiscussionController.reply);
assetDiscussionRouter.post('/:symbol/:id/like', AssetDiscussionController.toggleLike);
assetDiscussionRouter.post('/:symbol/:id/report', AssetDiscussionController.report);
assetDiscussionRouter.delete('/:symbol/:id', AssetDiscussionController.remove);
