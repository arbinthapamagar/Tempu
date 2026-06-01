import { Router } from 'express';
import { verifyUserJwt } from '../middlewares/auth.middleware.js';
import {
    getDriverNotifications,
    markDriverNotificationRead,
    markAllDriverNotificationsRead,
} from '../controller/notification.controller.js';

const notificationRouter = Router();
notificationRouter.use(verifyUserJwt);

notificationRouter.get('/driver', getDriverNotifications);
notificationRouter.put('/driver/read-all', markAllDriverNotificationsRead);
notificationRouter.put('/driver/:id/read', markDriverNotificationRead);

export { notificationRouter };
