import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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

// Treat a request as same-origin when its Origin header names this very host.
// Compared by host rather than full URL because behind a TLS-terminating proxy
// (a tunnel, a load balancer) the Origin says https:// while req.protocol still
// says http, and a naive string compare would reject the app's own requests.
function isSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin || !req.headers.host) return false;
    return origin.replace(/^https?:\/\//, '') === req.headers.host;
}

// CORS guards the API only — it is deliberately NOT applied to the whole app.
// The admin panel is served from this same origin now, and Vite marks its
// bundle <script crossorigin>, so the browser sends an Origin header when
// fetching it. Running static assets through this check made every one of them
// 500 with "Not allowed by CORS", which renders as a blank white page with
// nothing in the server log to explain it.
const corsDelegate = (req, callback) => {
    const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
    const origin = req.headers.origin;
    // Same-origin covers the panel calling its own API: browsers attach an
    // Origin header to POST/PUT/DELETE even same-origin. Allowing it by host
    // means the panel works on localhost, a LAN IP, a public IP or a tunnel
    // URL without CORS_ORIGIN having to list every one of them.
    if (!origin || allowed.length === 0 || allowed.includes(origin) || isSameOrigin(req)) {
        callback(null, { origin: true, credentials: true });
    } else {
        callback(new Error('Not allowed by CORS'));
    }
};

app.use('/api', cors(corsDelegate));
// Tempu Rag / Tempu Ai image understanding sends a base64 image, which far
// exceeds the strict 20kb default. Give just those routes a bigger JSON limit
// BEFORE the global parser (body-parser skips once the body is already
// parsed), so every other endpoint keeps the tight 20kb cap.
app.use('/api/v1/admin/knowledge/chat', express.json({ limit: '12mb' }));
app.use('/api/v1/admin/agentic/chat', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
// Helmet's stock CSP assumes the API is served alone. Now that this process
// also serves the built admin panel, the defaults have to be widened for what
// the panel actually loads — otherwise the browser blocks the bundle and you
// get a blank white page with no server-side error to explain it.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            // null removes a default directive. helmet merges these over its
            // own defaults, so deleting a key from a copy of the defaults does
            // nothing — it has to be nulled explicitly.
            //
            // upgrade-insecure-requests rewrites every http:// subresource to
            // https://, which blanks the panel when it's reached over plain
            // HTTP on a LAN or public IP (no TLS there). HTTPS deployments are
            // unaffected — the page is already https, so its relative asset
            // URLs are too.
            'upgrade-insecure-requests': null,
            // Cloudinary serves user/driver document uploads; blob: covers
            // client-side previews before upload.
            'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
            // 'self' covers the same-origin API; ws/wss are for socket.io
            // signaling, which some browsers treat as a separate scheme.
            'connect-src': ["'self'", 'ws:', 'wss:'],
            // Google Maps embeds on trip/driver detail pages.
            'frame-src': ["'self'", 'https://www.google.com'],
        },
    },
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

// Serve the built web frontend from the same origin as the API, so the whole
// app is reachable on one port (one router port-forward, no CORS, no hardcoded
// host in the bundle — the browser just uses whatever origin it loaded from).
// Only active once `npm run build` has been run in web/frontend.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/frontend/dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist));
    // SPA fallback: any non-API GET that didn't match a file is a client route.
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(webDist, 'index.html'));
    });
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorMiddleware);

export default app;
