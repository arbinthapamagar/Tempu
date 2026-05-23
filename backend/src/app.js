import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { errorMiddleware } from './middlewares/error.middleware.js';

import { authRouter } from './routes/auth.route.js';
import { userRouter } from './routes/user.route.js';
import { tripRouter } from './routes/trip.route.js';
import { bidRouter } from './routes/bid.route.js';
import { driverRouter } from './routes/driver.route.js';
import { messageRouter } from './routes/message.route.js';
import { notificationRouter } from './routes/notification.routes.js';
import { callLogRouter } from './routes/callLog.route.js';
import { reviewRouter } from './routes/review.route.js';
import { adminRouter } from './routes/admin.route.js';
import { transactionRouter } from './routes/transaction.route.js';
import { subscriptionRouter } from './routes/subscription.route.js';
import { supportRouter } from './routes/support.route.js';
import { documentRouter } from './routes/document.route.js';
import { supplierRouter } from './routes/supplier.route.js';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(helmet());
app.use(express.static('public'));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/trips', tripRouter);
app.use('/api/v1/bids', bidRouter);
app.use('/api/v1/drivers', driverRouter);
app.use('/api/v1/messages', messageRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/call-logs', callLogRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/transactions', transactionRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/suppliers', supplierRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorMiddleware);

export default app;
