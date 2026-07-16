import mongoose from 'mongoose';

// A single captured API request/response, written by the apiLogger middleware
// for every /api/v1/* call. Powers the admin "API Log" viewer. Entries auto-
// expire after 30 days via the TTL index below, so the collection self-cleans
// and never bloats the DB.
const API_LOG_TTL_DAYS = Number(process.env.API_LOG_TTL_DAYS) || 30;

const apiLogSchema = new mongoose.Schema(
    {
        // Which client made the call, from the X-Client header the web/mobile
        // apps send. Anything without it (server-to-server, cron, curl) = backend.
        source: {
            type: String,
            enum: ['web', 'mobile', 'backend'],
            default: 'backend',
            index: true,
        },
        // Resource domain, derived from the route (users, drivers, admin,
        // support, trips, payments, auth, ...). Lets the viewer group by area.
        domain: { type: String, default: 'other', index: true },

        method: { type: String, required: true },        // GET / POST / ...
        url: { type: String, required: true },            // full original URL incl. query
        path: { type: String, default: '' },              // pathname only
        statusCode: { type: Number, default: 0, index: true },
        ok: { type: Boolean, default: false },             // response was a success envelope
        durationMs: { type: Number, default: 0 },

        // Full request, with sensitive values redacted by the middleware.
        requestHeaders: { type: Object, default: {} },
        requestQuery: { type: Object, default: {} },
        requestParams: { type: Object, default: {} },
        requestBody: { type: Object, default: {} },

        // The raw response body sent to the client, plus the normalized envelope
        // fields ({ success, statusCode, message }) pulled out for quick scanning.
        responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
        normalized: {
            success: { type: Boolean, default: null },
            statusCode: { type: Number, default: null },
            message: { type: String, default: null },
        },

        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        // Who was authenticated on the request, if anyone (best-effort).
        actorType: { type: String, enum: ['admin', 'user', 'driver', 'guest', null], default: null },
        actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
);

// Common viewer queries: newest-first within a source/domain filter.
apiLogSchema.index({ source: 1, createdAt: -1 });
apiLogSchema.index({ domain: 1, createdAt: -1 });
apiLogSchema.index({ createdAt: -1 });
// TTL: Mongo drops documents this many seconds after createdAt.
apiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: API_LOG_TTL_DAYS * 24 * 60 * 60 });

export const ApiLog = mongoose.model('ApiLog', apiLogSchema);
