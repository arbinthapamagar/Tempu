import { Router } from 'express';
import { contactSupport } from '../controller/support.controller.js';

// Support tickets are handled via /api/v1/users/support and /api/v1/admin/support.
// This router is mounted PUBLICLY at /api/v1/support for pre-login enquiries.
const supportRouter = Router();

supportRouter.post('/contact', contactSupport);

export { supportRouter };
