import { Router } from 'express';
import {
    contactSupport,
    createGuestTicket,
    getGuestTicket,
    addGuestMessage,
} from '../controller/support.controller.js';

// Support tickets are handled via /api/v1/users/support and /api/v1/admin/support.
// This router is mounted PUBLICLY at /api/v1/support for pre-login enquiries.
const supportRouter = Router();

supportRouter.post('/contact', contactSupport);

// Pre-login live chat — no auth; the thread token gates access.
supportRouter.post('/ticket', createGuestTicket);
supportRouter.get('/ticket/:id', getGuestTicket);
supportRouter.post('/ticket/:id/messages', addGuestMessage);

export { supportRouter };
