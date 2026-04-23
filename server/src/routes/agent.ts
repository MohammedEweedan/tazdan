import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import { authenticate, requireAgent, requireAdmin } from '../middleware/auth';

const router = Router();

// Public
router.get('/nearby', AgentController.findNearby);

// User: request deposit/withdrawal via agent
router.post('/deposit', authenticate, AgentController.requestDeposit);
router.post('/withdraw', authenticate, AgentController.requestWithdrawal);
router.get('/my-transactions', authenticate, AgentController.getUserTransactions);

// Agent: manage queue
router.get('/queue', authenticate, requireAgent, AgentController.getAgentQueue);
router.get('/stats', authenticate, requireAgent, AgentController.getAgentStats);
router.put('/confirm-deposit/:id', authenticate, requireAgent, AgentController.confirmDeposit);
router.put('/confirm-withdrawal/:id', authenticate, requireAgent, AgentController.confirmWithdrawal);
router.put('/reject/:id', authenticate, requireAgent, AgentController.rejectTransaction);

// Admin: manage agents
router.get('/', authenticate, requireAdmin, AgentController.getAll);
router.post('/', authenticate, requireAdmin, AgentController.create);
router.put('/:id', authenticate, requireAdmin, AgentController.update);
router.delete('/:id', authenticate, requireAdmin, AgentController.delete);

export default router;
