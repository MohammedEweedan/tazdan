/**
 * /api/messages — in-app messaging routes.
 *
 * All routes require authentication. Order matters: the wildcard
 * `/:userId` GET / POST routes go LAST so they don't shadow the
 * named sub-resources (`/conversations`, `/blocks`, etc.).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { MessageController } from '../controllers/message.controller';

export const messageRouter = Router();

messageRouter.use(authenticate);

// Send a new message
messageRouter.post('/',                            MessageController.send);

// Conversation list (one row per partner)
messageRouter.get('/conversations',                MessageController.getConversations);

// Block / unblock / list blocks
messageRouter.get('/blocks',                       MessageController.listBlocks);
messageRouter.post('/block',                       MessageController.block);
messageRouter.delete('/block/:userId',             MessageController.unblock);

// Report a user / message
messageRouter.post('/report',                      MessageController.report);

// Escalate to support
messageRouter.post('/escalate',                    MessageController.escalate);

// Mark all messages from :userId as read
messageRouter.post('/read/:userId',                MessageController.markRead);

// Single-message edit / delete (wildcard `:id` last)
messageRouter.patch('/:id',                        MessageController.edit);
messageRouter.delete('/:id',                       MessageController.remove);

// Thread between me and :userId (wildcard `:userId` LAST so it doesn't
// swallow the static sub-resources above).
messageRouter.get('/:userId',                      MessageController.getMessages);
