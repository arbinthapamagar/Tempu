// Agentic AI data tools — a whitelisted set of READ-ONLY Mongo queries the LLM
// is allowed to call (via Ollama tool-calling) to answer natural-language
// questions about live app data. The model never writes raw queries; it can
// only invoke these named functions with the given arguments, so there is no
// way for a prompt to reach data or actions outside this list.
//
// To add more data to the assistant, add a new entry to TOOLS (schema) and a
// matching handler in HANDLERS — same shape as the ones below.
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { Trip } from '../models/trip.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Withdrawal } from '../models/withdrawal.model.js';
import { Subscription } from '../models/subscription.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { Emergency } from '../models/emergency.model.js';

const MAX_LIMIT = 20;
const clampLimit = (n, def = 5) => Math.max(1, Math.min(MAX_LIMIT, Number(n) || def));

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

    async get_user_subscription({ userQuery }) {
        const user = await findBestUser(userQuery);
        if (!user) return { found: false };
        const subs = await Subscription.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('plan status createdAt');
        return { found: true, user: shapeUser(user), subscriptions: subs };
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
