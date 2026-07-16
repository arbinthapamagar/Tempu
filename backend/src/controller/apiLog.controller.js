import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { ApiLog } from '../models/apiLog.model.js';

// Admin API-Log viewer endpoints, mounted under /api/v1/admin/api-logs and
// gated to superadmin (see admin.route.js) — the log holds full request/response
// data across the whole platform, so it is the most sensitive read there is.

const SOURCES = ['web', 'mobile', 'backend'];

// GET /admin/api-logs?source=&domain=&method=&status=&search=&page=&limit=
// Paginated list, newest first, with the heavy response body projected out.
const listApiLogs = asyncHandler(async (req, res) => {
    const { source, domain, method, status, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    const filter = {};
    if (source && SOURCES.includes(source)) filter.source = source;
    if (domain) filter.domain = domain;
    if (method) filter.method = String(method).toUpperCase();
    if (status) {
        // Accept an exact code (404) or a class (4xx / 5xx / 2xx).
        const s = String(status).toLowerCase();
        const m = s.match(/^([1-5])xx$/);
        if (m) filter.statusCode = { $gte: Number(m[1]) * 100, $lt: (Number(m[1]) + 1) * 100 };
        else if (/^\d{3}$/.test(s)) filter.statusCode = Number(s);
    }
    if (search && search.trim()) {
        const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ url: rx }, { 'normalized.message': rx }];
    }

    const [total, logs] = await Promise.all([
        ApiLog.countDocuments(filter),
        ApiLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('-responseBody -requestHeaders -requestBody -requestQuery -requestParams'),
    ]);

    return res.status(200).json(
        new apiResponse(200, { logs }, 'API logs', {
            page, limit, total, totalPages: Math.ceil(total / limit) || 1,
        })
    );
});

// GET /admin/api-logs/stats  → counts per source + per domain (for the tabs).
const apiLogStats = asyncHandler(async (req, res) => {
    const [bySource, byDomain, total] = await Promise.all([
        ApiLog.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
        ApiLog.aggregate([{ $group: { _id: '$domain', count: { $sum: 1 } } }]),
        ApiLog.countDocuments({}),
    ]);
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'other', r.count]));
    return res.status(200).json(
        new apiResponse(200, { total, bySource: toMap(bySource), byDomain: toMap(byDomain) }, 'API log stats')
    );
});

// GET /admin/api-logs/:id  → the full entry incl. headers, bodies, response.
const getApiLog = asyncHandler(async (req, res) => {
    const log = await ApiLog.findById(req.params.id);
    if (!log) throw new apiError(404, 'API log not found');
    return res.status(200).json(new apiResponse(200, { log }, 'API log'));
});

// DELETE /admin/api-logs  → clear the log (optionally only one source).
const clearApiLogs = asyncHandler(async (req, res) => {
    const { source } = req.query;
    const filter = source && SOURCES.includes(source) ? { source } : {};
    const { deletedCount } = await ApiLog.deleteMany(filter);
    return res.status(200).json(new apiResponse(200, { deleted: deletedCount }, `Cleared ${deletedCount} log(s)`));
});

export { listApiLogs, apiLogStats, getApiLog, clearApiLogs };
