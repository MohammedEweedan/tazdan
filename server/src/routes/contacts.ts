import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ContactsController } from '../controllers/contacts.controller';

/** People the customer has exchanged money with, and the history with each. */
export const contactsRouter = Router();
contactsRouter.get('/', authenticate, ContactsController.list);
contactsRouter.get('/:id', authenticate, ContactsController.detail);
