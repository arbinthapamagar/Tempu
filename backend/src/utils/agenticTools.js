// Agentic AI data tools — a whitelisted set of READ-ONLY Mongo queries the LLM
// is allowed to call (via Ollama tool-calling) to answer natural-language
// questions about live app data. The model never writes raw queries; it can
// only invoke these named functions with the given arguments, so there is no
// way for a prompt to reach data or actions outside this list.
//
// To add more data to the assistant, add a new entry to TOOLS (schema) and a
// matching handler in HANDLERS — same shape as the ones below.
import { User } from '../models/user.model.js';
import { Admin } from '../models/admin.model.js';
import { Driver } from '../models/driver.model.js';
import { Trip } from '../models/trip.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Withdrawal } from '../models/withdrawal.model.js';
import { Subscription } from '../models/subscription.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { Emergency } from '../models/emergency.model.js';
import { Review } from '../models/review.model.js';
import { Supplier } from '../models/supplier.model.js';
import { Bid } from '../models/bid.model.js';
import { Pricing } from '../models/pricing.model.js';
import { Notification } from '../models/notification.model.js';
import { Document } from '../models/doeument.model.js';
import { CallLog } from '../models/callLog.model.js';

const MAX_LIMIT = 20;
const clampLimit = (n, def = 5) => Math.max(1, Math.min(MAX_LIMIT, Number(n) || def));

// Ollama's tool-calling sometimes sends the literal string "null"/"undefined"
// (or "") for an omitted optional argument instead of leaving it out entirely.
// Treat those the same as "not provided" so an optional filter like `status` or
// `role` doesn't silently turn into a filter that matches nothing.
const clean = (v) => (v === undefined || v === null || v === 'null' || v === 'undefined' || v === '' ? undefined : v);
const cleanBool = (v) => {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return undefined;
};

// Support ticket status is stored as open/in_progress/resolved/closed, but
// admins naturally say "pending", "new", "ongoing", "done", etc. The model
// doesn't reliably stick to the schema enum, so normalize common synonyms
// before they hit the query — otherwise a real-looking status silently
// matches zero tickets instead of the ones the admin actually means.
const TICKET_STATUS_SYNONYMS = {
    pending: 'open', new: 'open', unanswered: 'open', unresolved: 'open', waiting: 'open',
    progress: 'in_progress', ongoing: 'in_progress', active: 'in_progress', working: 'in_progress',
    done: 'resolved', complete: 'resolved', completed: 'resolved', fixed: 'resolved', solved: 'resolved',
};
const normalizeTicketStatus = (s) => {
    const v = clean(s);
    if (!v) return v;
    const key = String(v).toLowerCase().trim();
    return TICKET_STATUS_SYNONYMS[key] || v;
};

const USER_FIELDS = 'name phone email rating accountStatus userType walletBalance createdAt';
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findBestUser(query) {
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    return User.findOne({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select(USER_FIELDS);
}

async function findBestDriver(query) {
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    // Try direct driver fields first (plate/license), else search by the linked user's name/phone.
    let driver = await Driver.findOne({ $or: [{ vehiclePlate: rx }, { licenseNumber: rx }] })
        .populate('userId', 'name phone email');
    if (driver) return driver;
    const user = await User.findOne({ $or: [{ name: rx }, { phone: rx }] }).select('_id');
    if (!user) return null;
    return Driver.findOne({ userId: user._id }).populate('userId', 'name phone email');
}

const shapeUser = (u) => u && ({
    id: u._id, name: u.name, phone: u.phone, email: u.email,
    rating: u.rating?.average, ratingCount: u.rating?.total,
    accountStatus: u.accountStatus, userType: u.userType,
    walletBalance: u.walletBalance, createdAt: u.createdAt,
});

const shapeDriver = (d) => d && ({
    id: d._id, name: d.userId?.name, phone: d.userId?.phone, email: d.userId?.email,
    vehicleType: d.vehicleType, vehiclePlate: d.vehiclePlate, vehicleModel: d.vehicleModel,
    status: d.status, isOnline: d.isOnline, rating: d.rating, totalRatings: d.totalRatings,
    totalRides: d.totalRides, earnings: d.earnings, walletBalance: d.walletBalance,
    cancelledRides: d.cancelledRides, city: d.city,
});

// ── Tool schemas (Ollama / OpenAI-style function definitions) ───────────────
export const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'find_user',
            description: 'Find a rider/customer by name, phone, or email. Returns their profile including rating, account status, and wallet balance.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Name, phone, or email to search for' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'rank_users_by_rating',
            description: 'List users ranked by rating — use this for "user with the least/highest rating", "worst rated users", etc.',
            parameters: {
                type: 'object',
                properties: {
                    order: { type: 'string', enum: ['asc', 'desc'], description: '"asc" = lowest rating first, "desc" = highest first' },
                    limit: { type: 'integer', description: 'How many to return (max 20)' },
                },
                required: ['order'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'find_driver',
            description: 'Find a driver by name, phone, vehicle plate, or license number. Returns their profile including rating, rides, and earnings.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Name, phone, plate, or license number to search for' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'rank_drivers_by_rating',
            description: 'List drivers ranked by rating — use this for "driver with the least/highest rating", "best/worst drivers", etc.',
            parameters: {
                type: 'object',
                properties: {
                    order: { type: 'string', enum: ['asc', 'desc'] },
                    limit: { type: 'integer' },
                },
                required: ['order'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_trips',
            description: "Get a user's recent trip history (pickup/dropoff, status, price).",
            parameters: {
                type: 'object',
                properties: {
                    userQuery: { type: 'string', description: 'Name, phone, or email identifying the user' },
                    limit: { type: 'integer' },
                },
                required: ['userQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_recent_trips',
            description: 'List recent trips across the whole platform, optionally filtered by status.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'accepted', 'arriving', 'started', 'completed', 'cancelled'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_transactions',
            description: "Get a user's recent payment transactions.",
            parameters: {
                type: 'object',
                properties: {
                    userQuery: { type: 'string' },
                    limit: { type: 'integer' },
                },
                required: ['userQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_driver_withdrawals',
            description: "Get a driver's recent withdrawal (cashout) requests.",
            parameters: {
                type: 'object',
                properties: {
                    driverQuery: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'paid'] },
                    limit: { type: 'integer' },
                },
                required: ['driverQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_support_tickets',
            description: "Get a user's support tickets (subject, status, rating they gave).",
            parameters: {
                type: 'object',
                properties: {
                    userQuery: { type: 'string' },
                    limit: { type: 'integer' },
                },
                required: ['userQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_support_tickets',
            description: 'List support tickets across the WHOLE platform (not one user) - use this for "all pending tickets", "how many open tickets", "list closed tickets", etc. Optionally filter by status or category. Status "open" means new/pending/unanswered tickets.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                    category: { type: 'string' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_subscription',
            description: "Get a user's subscription plan(s) (parent/business), status and dates.",
            parameters: {
                type: 'object',
                properties: { userQuery: { type: 'string' } },
                required: ['userQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'platform_stats',
            description: 'Get overall platform counts: total users, drivers, online drivers, trips by status, open support tickets, pending withdrawals, active emergencies.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_driver_reviews',
            description: "Get a driver's rider reviews (rating, comment) — who reviewed them and what they said.",
            parameters: {
                type: 'object',
                properties: { driverQuery: { type: 'string' }, limit: { type: 'integer' } },
                required: ['driverQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_active_emergencies',
            description: 'List active/unresolved SOS emergency alerts, optionally filtered by status.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'find_supplier',
            description: 'Find a vehicle supplier by business name, contact person, phone, or email.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_suppliers',
            description: 'List vehicle suppliers, optionally filtered by verification status or city.',
            parameters: {
                type: 'object',
                properties: {
                    verified: { type: 'boolean' },
                    city: { type: 'string' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_trip_bids',
            description: 'Get the bids drivers placed on a specific trip (by trip id).',
            parameters: {
                type: 'object',
                properties: { tripId: { type: 'string' } },
                required: ['tripId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_pricing_config',
            description: 'Get the current global fare/pricing configuration (electricity cost, VAT, commission, premium multiplier, per-vehicle base fares, time-slot multipliers).',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_notifications',
            description: "Get a user's or driver's recent in-app notifications.",
            parameters: {
                type: 'object',
                properties: { userQuery: { type: 'string' }, limit: { type: 'integer' } },
                required: ['userQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_driver_documents',
            description: "Get a driver's uploaded verification documents and their status (pending/approved/rejected).",
            parameters: {
                type: 'object',
                properties: { driverQuery: { type: 'string' } },
                required: ['driverQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_admins',
            description: 'List admin/staff accounts (name, email, role, active status) — use this for "all admin names", "list our moderators", etc. Optionally filter by role.',
            parameters: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: ['superadmin', 'admin', 'headmaster', 'moderator'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'find_admin',
            description: 'Find a specific admin/staff account by name, email, or phone.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_trip_call_logs',
            description: 'Get the in-app call history for a specific trip (rider/driver calls, duration, status).',
            parameters: {
                type: 'object',
                properties: { tripId: { type: 'string' } },
                required: ['tripId'],
            },
        },
    },
];

// ── Handlers ─────────────────────────────────────────────────────────────────
export const HANDLERS = {
    async find_user({ query }) {
        const u = await findBestUser(query);
        return u ? { found: true, user: shapeUser(u) } : { found: false };
    },

    async rank_users_by_rating({ order = 'asc', limit = 5 }) {
        const sort = order === 'desc' ? { 'rating.average': -1 } : { 'rating.average': 1 };
        const users = await User.find({ 'rating.total': { $gt: 0 } })
            .sort({ ...sort, 'rating.total': -1 })
            .limit(clampLimit(limit))
            .select(USER_FIELDS);
        return { users: users.map(shapeUser) };
    },

    async find_driver({ query }) {
        const d = await findBestDriver(query);
        return d ? { found: true, driver: shapeDriver(d) } : { found: false };
    },

    async rank_drivers_by_rating({ order = 'asc', limit = 5 }) {
        const sort = order === 'desc' ? { rating: -1 } : { rating: 1 };
        const drivers = await Driver.find({ totalRatings: { $gt: 0 } })
            .sort({ ...sort, totalRatings: -1 })
            .limit(clampLimit(limit))
            .populate('userId', 'name phone email');
        return { drivers: drivers.map(shapeDriver) };
    },

    async get_user_trips({ userQuery, limit = 5 }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const trips = await Trip.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .select('status vehicleType pickup.address dropoff.address offeredPrice finalPrice paymentStatus createdAt');
        return {
            found: true,
            user: shapeUser(user),
            trips: trips.map((t) => ({
                id: t._id, status: t.status, vehicleType: t.vehicleType,
                pickup: t.pickup?.address, dropoff: t.dropoff?.address,
                price: t.finalPrice ?? t.offeredPrice, paymentStatus: t.paymentStatus, createdAt: t.createdAt,
            })),
        };
    },

    async list_recent_trips({ status, limit = 10 } = {}) {
        status = clean(status);
        const filter = status ? { status } : {};
        const trips = await Trip.find(filter)
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit, 10))
            .populate('userId', 'name phone')
            .populate('driverId', 'vehiclePlate')
            .select('status vehicleType pickup.address dropoff.address offeredPrice finalPrice createdAt userId driverId');
        return {
            trips: trips.map((t) => ({
                id: t._id, status: t.status, vehicleType: t.vehicleType,
                rider: t.userId?.name, pickup: t.pickup?.address, dropoff: t.dropoff?.address,
                price: t.finalPrice ?? t.offeredPrice, driverPlate: t.driverId?.vehiclePlate, createdAt: t.createdAt,
            })),
        };
    },

    async get_user_transactions({ userQuery, limit = 5 }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const txns = await Transaction.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .select('amount type method status gatewayRef createdAt');
        return { found: true, user: shapeUser(user), transactions: txns };
    },

    async get_driver_withdrawals({ driverQuery, status, limit = 5 }) {
        status = clean(status);
        const driver = await findBestDriver(driverQuery);
        if (!driver) return { found: false };
        const filter = { driverId: driver._id, ...(status ? { status } : {}) };
        const withdrawals = await Withdrawal.find(filter)
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .select('amount method status createdAt');
        return { found: true, driver: shapeDriver(driver), withdrawals };
    },

    async get_user_support_tickets({ userQuery, limit = 5 }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const tickets = await SupportTicket.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .select('subject category status rating.score createdAt');
        return {
            found: true,
            user: shapeUser(user),
            tickets: tickets.map((t) => ({
                id: t._id, subject: t.subject, category: t.category, status: t.status,
                ratingGiven: t.rating?.score ?? null, createdAt: t.createdAt,
            })),
        };
    },

    async list_support_tickets({ status, category, limit = 10 } = {}) {
        status = normalizeTicketStatus(status);
        category = clean(category);
        const filter = { ...(status ? { status } : {}), ...(category ? { category } : {}) };
        const tickets = await SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit, 10))
            .populate('userId', 'name phone')
            .populate('assignedTo', 'name')
            .select('subject category status rating.score createdAt userId assignedTo guest');
        return {
            tickets: tickets.map((t) => ({
                id: t._id, subject: t.subject, category: t.category, status: t.status,
                customer: t.userId?.name || t.guest?.name || 'Guest',
                assignedTo: t.assignedTo?.name || null, createdAt: t.createdAt,
            })),
        };
    },

    async get_user_subscription({ userQuery }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const subs = await Subscription.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('plan status createdAt');
        return { found: true, user: shapeUser(user), subscriptions: subs };
    },

    async get_driver_reviews({ driverQuery, limit = 5 }) {
        const driver = await findBestDriver(driverQuery);
        if (!driver) return { found: false };
        const reviews = await Review.find({ toDriver: driver._id })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .populate('fromUser', 'name')
            .select('rating comment createdAt fromUser');
        return {
            found: true,
            driver: shapeDriver(driver),
            reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, from: r.fromUser?.name, createdAt: r.createdAt })),
        };
    },

    async list_active_emergencies({ status, limit = 10 } = {}) {
        status = clean(status) || 'active';
        const emergencies = await Emergency.find({ status })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit, 10))
            .populate('userId', 'name phone')
            .select('role status address contactPhone createdAt userId');
        return {
            emergencies: emergencies.map((e) => ({
                id: e._id, role: e.role, status: e.status, address: e.address,
                contactPhone: e.contactPhone || e.userId?.phone, reportedBy: e.userId?.name, createdAt: e.createdAt,
            })),
        };
    },

    async find_supplier({ query }) {
        if (!query) return { found: false };
        const rx = new RegExp(escapeRegex(query), 'i');
        const s = await Supplier.findOne({ $or: [{ businessName: rx }, { contactPerson: rx }, { phone: rx }, { email: rx }] });
        if (!s) return { found: false };
        return {
            found: true,
            supplier: {
                id: s._id, businessName: s.businessName, contactPerson: s.contactPerson,
                phone: s.phone, email: s.email, city: s.city, isVerified: s.isVerified, plan: s.plan,
            },
        };
    },

    async list_suppliers({ verified, city, limit = 10 } = {}) {
        verified = cleanBool(verified);
        city = clean(city);
        const filter = {};
        if (typeof verified === 'boolean') filter.isVerified = verified;
        if (city) filter.city = city;
        const suppliers = await Supplier.find(filter)
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit, 10))
            .select('businessName contactPerson phone city isVerified plan');
        return { suppliers };
    },

    async get_trip_bids({ tripId }) {
        if (!tripId) return { found: false };
        const bids = await Bid.find({ tripId })
            .populate({ path: 'driverId', select: 'vehiclePlate rating', populate: { path: 'userId', select: 'name phone' } })
            .select('amount message status expiresAt driverId');
        return {
            bids: bids.map((b) => ({
                amount: b.amount, message: b.message, status: b.status,
                driverName: b.driverId?.userId?.name, driverPlate: b.driverId?.vehiclePlate, driverRating: b.driverId?.rating,
            })),
        };
    },

    async get_pricing_config() {
        const p = await Pricing.findOne({ key: 'global' })
            .select('electricityCost vatPercent commissionPercent profitMarginPercent premium timeSlots vehicles longDistanceDiscount');
        if (!p) return { found: false };
        return {
            found: true,
            electricityCost: p.electricityCost, vatPercent: p.vatPercent,
            commissionPercent: p.commissionPercent, profitMarginPercent: p.profitMarginPercent,
            premium: p.premium, timeSlots: p.timeSlots, vehicles: p.vehicles,
            longDistanceDiscount: p.longDistanceDiscount,
        };
    },

    async get_user_notifications({ userQuery, limit = 5 }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const notifs = await Notification.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(clampLimit(limit))
            .select('title body type isRead createdAt');
        return { found: true, user: shapeUser(user), notifications: notifs };
    },

    async get_driver_documents({ driverQuery }) {
        const driver = await findBestDriver(driverQuery);
        if (!driver) return { found: false };
        const docs = await Document.find({ driverId: driver._id }).select('type status rejectionReason createdAt');
        return { found: true, driver: shapeDriver(driver), documents: docs };
    },

    async list_admins({ role, limit = 20 } = {}) {
        role = clean(role);
        const filter = role ? { role } : {};
        const admins = await Admin.find(filter)
            .sort({ name: 1 })
            .limit(clampLimit(limit, 20))
            .select('name email phone role isActive createdAt');
        return { admins };
    },

    async find_admin({ query }) {
        if (!query) return { found: false };
        const rx = new RegExp(escapeRegex(query), 'i');
        const a = await Admin.findOne({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
            .select('name email phone role isActive createdAt');
        return a ? { found: true, admin: a } : { found: false };
    },

    async get_trip_call_logs({ tripId }) {
        if (!tripId) return { found: false };
        const logs = await CallLog.find({ tripId }).select('callerType status duration createdAt');
        return { callLogs: logs };
    },

    async platform_stats() {
        const [
            totalUsers, totalDrivers, onlineDrivers, tripsByStatus,
            openTickets, pendingWithdrawals, activeEmergencies,
        ] = await Promise.all([
            User.countDocuments({}),
            Driver.countDocuments({}),
            Driver.countDocuments({ isOnline: true }),
            Trip.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
            Withdrawal.countDocuments({ status: 'pending' }),
            Emergency.countDocuments({ status: 'active' }),
        ]);
        return {
            totalUsers, totalDrivers, onlineDrivers,
            tripsByStatus: Object.fromEntries(tripsByStatus.map((s) => [s._id, s.count])),
            openSupportTickets: openTickets, pendingWithdrawals, activeEmergencies,
        };
    },
};
