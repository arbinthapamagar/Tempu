import { Router } from 'express';
import { verifyUserJwt } from '../middlewares/auth.middleware.js';
import { getDriverReviews } from '../controller/driver.controller.js';

const reviewRouter = Router();

reviewRouter.get('/driver/:id', verifyUserJwt, getDriverReviews);

export { reviewRouter };
