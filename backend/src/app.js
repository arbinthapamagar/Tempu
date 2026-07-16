import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { apiLogger } from './middlewares/apiLogger.middleware.js';

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

// Simple in-memory rate limiter
const rateLimitMap = new Map();
function createRateLimit(windowMs, max, message) {
    return (req, res, next) => {
        const key = req.ip + req.path;
        const now = Date.now();
        const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
        if (now > record.resetAt) {
            record.count = 0;
            record.resetAt = now + windowMs;
        }
        record.count += 1;
        rateLimitMap.set(key, record);
        if (record.count > max) {
            return res.status(429).json({ success: false, message });
        }
        next();
    };
}

const authLimiter = createRateLimit(15 * 60 * 1000, 20, 'Too many requests, please try again later');
const otpLimiter = createRateLimit(10 * 60 * 1000, 5, 'Too many OTP attempts, please wait 10 minutes');

app.use(cors({
    origin: (origin, callback) => {
        const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
        if (!origin || allowed.length === 0 || allowed.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Tempu Rag / Tempu Ai image understanding sends a base64 image, which far
// exceeds the strict 20kb default. Give just those routes a bigger JSON limit
// BEFORE the global parser (body-parser skips once the body is already
// parsed), so every other endpoint keeps the tight 20kb cap.
app.use('/api/v1/admin/knowledge/chat', express.json({ limit: '12mb' }));
app.use('/api/v1/admin/agentic/chat', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(helmet({
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));
app.use(express.static('public'));
app.use(cookieParser());

// Capture every /api/v1/* request + response into the ApiLog collection for the
// admin API-Log viewer. Runs after body/cookie parsing so it can see the parsed
// request, and reads req.admin/req.user on 'finish' (set by auth middleware in
// the routers). Fire-and-forget — never blocks or fails a request.
app.use(apiLogger);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/v1/auth/verify-otp', otpLimiter);
app.use('/api/v1/auth/forgot-password', otpLimiter);
app.use('/api/v1/auth', authLimiter, authRouter);
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
