import { Router } from 'express';
import { esewaPay, esewaReturn, esewaFailure, khaltiReturn } from '../controller/users/user.payment.controller.js';

// Public: these are browser redirects to/from the payment gateways, so there's
// no bearer token. They never trust the request — every credit is confirmed
// with the gateway server-to-server first.
const paymentRouter = Router();
paymentRouter.get('/esewa/pay/:id', esewaPay);
paymentRouter.get('/esewa/return/:id', esewaReturn);
paymentRouter.get('/esewa/failure/:id', esewaFailure);
paymentRouter.get('/khalti/return/:id', khaltiReturn);

export { paymentRouter };
