import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { P2PController } from '../controllers/p2p.controller';

export const p2pRouter = Router();

// Listings
p2pRouter.get('/listings', authenticate, P2PController.getListings);
p2pRouter.get('/listings/mine', authenticate, P2PController.getMyListings);
p2pRouter.post('/listings', authenticate, P2PController.createListing);
p2pRouter.put('/listings/:id/cancel', authenticate, P2PController.cancelListing);

// Trades
p2pRouter.get('/trades', authenticate, P2PController.getMyTrades);
p2pRouter.post('/trades', authenticate, P2PController.initiateTrade);
p2pRouter.put('/trades/:id/payment-sent', authenticate, P2PController.markPaymentSent);
p2pRouter.put('/trades/:id/confirm', authenticate, P2PController.confirmPayment);
p2pRouter.put('/trades/:id/cancel', authenticate, P2PController.cancelTrade);
p2pRouter.post('/trades/:id/dispute', authenticate, P2PController.raiseDispute);
