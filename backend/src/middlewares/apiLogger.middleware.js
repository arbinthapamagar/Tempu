import { ApiLog } from '../models/apiLog.model.js';

// Captures every API request + its response into the ApiLog collection so the
// admin "API Log" viewer can show request headers, URL, request data, the raw
// API response, and the normalized envelope. Writes are fire-and-forget so
// logging never slows down or breaks the actual request.

// Header/body keys whose values must never be persisted in plaintext.
const SENSITIVE_KEYS = new Set([
    'authorization', 'cookie', 'set-cookie', 'x-access-token',
    'password', 'oldpassword', 'newpassword', 'confirmpassword',
    'token', 'accesstoken', 'refreshtoken', 'temptoken', 'guesttoken',
    'otp', 'secret', 'apikey', 'api_key',
]);

const redactValue = (key, value) => {
    if (SENSITIVE_KEYS.has(String(key).toLowerCase())) return '[REDACTED]';
    return value;
};

// Deep-clone-ish redaction, capped so a huge body can't blow up the log doc.
function redact(obj, depth = 0) {
    if (obj == null || depth > 4) return obj;
    if (Array.isArray(obj)) return obj.slice(0, 50).map((v) => redact(v, depth + 1));
    if (typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = '[REDACTED]';
            else if (v && typeof v === 'object') out[k] = redact(v, depth + 1);
            else out[k] = v;
        }
        return out;
    }
    if (typeof obj === 'string' && obj.length > 4000) return `${obj.slice(0, 4000)}… [truncated]`;
    return obj;
}

const redactHeaders = (headers = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(headers)) out[k] = redactValue(k, v);
    return out;
};

// Domain = the segment right after /api/v1/ (users, drivers, admin, support…).
function domainFromPath(path) {
    const m = path.match(/^\/api\/v1\/([^/?]+)/);
    if (!m) return 'other';
    const map = {
        users: 'user', drivers: 'driver', trips: 'trip', bids: 'bid',
        messages: 'message', notifications: 'notification', 'call-logs': 'callLog',
        reviews: 'review', transactions: 'transaction', subscriptions: 'subscription',
        support: 'support', documents: 'document', suppliers: 'supplier',
        admin: 'admin', auth: 'auth',
    };
    return map[m[1]] || m[1];
}

// Client tag from the X-Client header the web/mobile apps set; else backend.
function sourceFromReq(req) {
    const c = String(req.headers['x-client'] || '').toLowerCase();
    if (c === 'web' || c === 'mobile') return c;
    return 'backend';
}

function safeParse(chunk) {
    if (chunk == null) return null;
    if (Buffer.isBuffer(chunk)) chunk = chunk.toString('utf8');
    if (typeof chunk !== 'string') return chunk;
    try {
        return JSON.parse(chunk);
    } catch {
        return chunk.length > 4000 ? `${chunk.slice(0, 4000)}… [truncated]` : chunk;
    }
}

export function apiLogger(req, res, next) {
    // Only log the versioned API surface, and never the log viewer's own
    // endpoints (that would be noise / recursion).
    if (!req.originalUrl.startsWith('/api/v1/') || req.originalUrl.includes('/admin/api-logs')) {
        return next();
    }

    const start = Date.now();
    let responseBody;

    // Capture whatever the handler sends without altering it.
    const origJson = res.json.bind(res);
    res.json = (body) => {
        responseBody = body;
        return origJson(body);
    };
    const origSend = res.send.bind(res);
    res.send = (body) => {
        if (responseBody === undefined) responseBody = safeParse(body);
        return origSend(body);
    };

    res.on('finish', () => {
        try {
            const parsed = responseBody && typeof responseBody === 'object' ? responseBody : {};
            const actor = req.admin || req.user || req.driver || null;
            const actorType = req.admin ? 'admin' : req.user ? 'user' : req.driver ? 'driver' : null;

            // Fire-and-forget; a logging failure must never affect the response.
            ApiLog.create({
                source: sourceFromReq(req),
                domain: domainFromPath(req.originalUrl),
                method: req.method,
                url: req.originalUrl,
                path: req.path,
                statusCode: res.statusCode,
                ok: res.statusCode < 400,
                durationMs: Date.now() - start,
                requestHeaders: redactHeaders(req.headers),
                requestQuery: redact(req.query || {}),
                requestParams: redact(req.params || {}),
                requestBody: redact(req.body || {}),
                responseBody: redact(responseBody ?? null),
                normalized: {
                    success: typeof parsed.success === 'boolean' ? parsed.success : res.statusCode < 400,
                    statusCode: typeof parsed.statusCode === 'number' ? parsed.statusCode : res.statusCode,
                    message: typeof parsed.message === 'string' ? parsed.message : null,
                },
                ip: req.ip,
                userAgent: req.headers['user-agent'] || '',
                actorType,
                actorId: actor?._id || null,
            }).catch(() => { /* logging is best-effort */ });
        } catch {
            /* never throw from the logger */
        }
    });

    next();
}
