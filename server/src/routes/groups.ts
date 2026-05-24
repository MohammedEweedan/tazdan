/**
 * /api/groups — multi-party chats with optional liquidity pools.
 *
 * All routes require authentication. Image uploads on send-message
 * piggy-back on the existing mediaUpload middleware (./uploads/media).
 *
 * Liquidity pool actions live under /api/groups/:id/pool/* and are
 * defined in routes/liquidityPool.ts so this file stays focused on
 * the chat surface.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { mediaUpload } from '../middleware/mediaUpload';
import { GroupController } from '../controllers/group.controller';
import { LiquidityPoolController } from '../controllers/liquidityPool.controller';

export const groupRouter = Router();
groupRouter.use(authenticate);

// Group CRUD
groupRouter.post('/',                                  GroupController.create);
groupRouter.get('/',                                   GroupController.list);
groupRouter.get('/:id',                                GroupController.getOne);
groupRouter.patch('/:id',                              GroupController.update);
groupRouter.delete('/:id',                             GroupController.dissolve);

// Members
groupRouter.post('/:id/members',                       GroupController.addMembers);
groupRouter.delete('/:id/members/:userId',             GroupController.removeMember);
groupRouter.patch('/:id/members/:userId',              GroupController.updateMemberRole);

// Messages — accept optional `image` multipart field on send
groupRouter.get('/:id/messages',                       GroupController.listMessages);
groupRouter.post('/:id/messages',                      mediaUpload.single('image'), GroupController.sendMessage);
groupRouter.patch('/:id/messages/:msgId',              GroupController.editMessage);
groupRouter.delete('/:id/messages/:msgId',             GroupController.deleteMessage);
groupRouter.post('/:id/read',                          GroupController.markRead);

// Liquidity pool actions
groupRouter.post('/:id/pool/deposit',                  LiquidityPoolController.deposit);
groupRouter.post('/:id/pool/withdraw',                 LiquidityPoolController.withdraw);
groupRouter.post('/:id/pool/close',                    LiquidityPoolController.close);
groupRouter.get('/:id/pool/contributions',             LiquidityPoolController.contributions);
