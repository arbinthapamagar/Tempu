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
import { AdminNotification } from '../models/adminNotification.model.js';
import { ApiLog } from '../models/apiLog.model.js';
import { MapSettings } from '../models/mapSettings.model.js';
import { SupportSettings } from '../models/supportSettings.model.js';
import { SupportReview } from '../models/supportReview.model.js';
import { DriverAvailability } from '../models/driverAvaibility.mdoel.js';

// Listing tools cap out higher than single-record tools: when the boss asks for
// "all tickets" / "all pending documents" they mean the whole queue, not a
// sample. 50 compact rows is still well inside the model's context budget.
const MAX_LIMIT = 50;
const clampLimit = (n, def = 5) => Math.max(1, Math.min(MAX_LIMIT, Number(n) || def));

// Ollama's tool-calling sometimes sends the literal string "null"/"undefined"
// (or "") for an omitted optional argument instead of leaving it out entirely.
// Treat those the same as "not provided" so an optional filter like `status` or
// `role` doesn't silently turn into a filter that matches nothing.
export const clean = (v) => (v === undefined || v === null || v === 'null' || v === 'undefined' || v === '' ? undefined : v);
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
export const normalizeTicketStatus = (s) => {
    const v = clean(s);
    if (!v) return v;
    const key = String(v).toLowerCase().trim();
    return TICKET_STATUS_SYNONYMS[key] || v;
};

const USER_FIELDS = 'name phone email rating accountStatus userType walletBalance createdAt';
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function findBestUser(query) {
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    return User.findOne({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select(USER_FIELDS);
}

export async function findBestDriver(query) {
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

export const shapeUser = (u) => u && ({
    id: u._id, name: u.name, phone: u.phone, email: u.email,
    rating: u.rating?.average, ratingCount: u.rating?.total,
    accountStatus: u.accountStatus, userType: u.userType,
    walletBalance: u.walletBalance, createdAt: u.createdAt,
});

export const shapeDriver = (d) => d && ({
    id: d._id, name: d.userId?.name, phone: d.userId?.phone, email: d.userId?.email,
    vehicleType: d.vehicleType, vehiclePlate: d.vehiclePlate, vehicleModel: d.vehicleModel,
    status: d.status, isOnline: d.isOnline, rating: d.rating, totalRatings: d.totalRatings,
    totalRides: d.totalRides, earnings: d.earnings, walletBalance: d.walletBalance,
    cancelledRides: d.cancelledRides, city: d.city,
});

export async function findBestAdmin(query) {
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    return Admin.findOne({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('name email phone role isActive supportRating');
}

// Resolve a subscription by id, child name, school, or the parent's name/phone.
export async function findBestSubscription({ subscriptionId, query }) {
    if (subscriptionId && /^[a-f\d]{24}$/i.test(String(subscriptionId))) {
        const byId = await Subscription.findById(subscriptionId)
            .populate('userId', 'name phone email')
            .populate({ path: 'primaryDriver', select: 'vehiclePlate vehicleType', populate: { path: 'userId', select: 'name phone' } });
        if (byId) return byId;
    }
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    const or = [{ childName: rx }, { schoolName: rx }];
    const user = await User.findOne({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id');
    if (user) or.push({ userId: user._id });
    return Subscription.findOne({ $or: or })
        .sort({ createdAt: -1 })
        .populate('userId', 'name phone email')
        .populate({ path: 'primaryDriver', select: 'vehiclePlate vehicleType', populate: { path: 'userId', select: 'name phone' } });
}

// "today" | "week" | "month" | "year" | "all" → the Date to filter createdAt from.
// Anything unrecognised (including "all") means no date filter at all.
function periodStart(period) {
    const now = new Date();
    switch (String(period || '').toLowerCase()) {
        case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
        case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
        case 'year': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
        default: return null;
    }
}
const sinceFilter = (period) => {
    const from = periodStart(period);
    return from ? { createdAt: { $gte: from } } : {};
};

// A support ticket is "awaiting reply" (unanswered) when it is still live
// (open/in_progress) and the last message in the customer thread came from the
// customer side (user/driver/guest), not from an admin. This is exactly what an
// admin means by "unanswered tickets" — someone is waiting on us to respond.
const isAwaitingReply = (t) => {
    if (!['open', 'in_progress'].includes(t.status)) return false;
    const msgs = t.messages || [];
    if (!msgs.length) return true; // opened with no reply yet
    const last = msgs[msgs.length - 1];
    return last.senderType !== 'admin';
};
const msgPreview = (m) => {
    if (!m) return null;
    const text = (m.message || '').trim();
    if (text) return text.length > 240 ? `${text.slice(0, 240)}…` : text;
    if (m.attachmentType === 'audio') return '[voice note]';
    if (m.attachmentType === 'file') return `[file: ${m.attachmentName || 'attachment'}]`;
    return null;
};
const ticketOpenedBy = (t) => (t.driverId ? 'driver' : t.userId ? 'rider' : 'guest');

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
            description: 'List support tickets across the WHOLE platform (not one user) - use this for "all pending tickets", "how many open tickets", "unanswered tickets", "list closed tickets", "our support tickets", etc. Returns an exact `count` plus each ticket with its customer, assigned agent, category, who opened it, the opening message, the latest message, and whether it is awaiting our reply. IMPORTANT: OMIT the status argument to include tickets of ALL statuses (open, in_progress, resolved, closed) — only pass status when the admin explicitly names one. Status "open" means new/pending tickets. Set awaitingReply=true only for tickets a customer is waiting on us to answer ("unanswered").',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                    category: { type: 'string' },
                    awaitingReply: { type: 'boolean', description: 'true = only tickets whose last message is from the customer (unanswered / waiting on us)' },
                    limit: { type: 'integer', description: 'Rows to return (max 50). Pass 50 whenever the boss asks for ALL tickets or wants to see the whole list.' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_support_ticket_detail',
            description: 'Get the FULL detail of one support ticket — the complete customer conversation thread (every message with who sent it and when), the customer, the assigned agent, category, status, opening complaint, latest message, whether it is awaiting our reply, and the support rating the customer gave. Use this when the admin wants to know what a ticket is about or what was said. Identify the ticket by its id, or by subject text or customer name.',
            parameters: {
                type: 'object',
                properties: {
                    ticketId: { type: 'string', description: 'The ticket id (preferred if known)' },
                    query: { type: 'string', description: 'Subject text or customer name/phone to find the ticket by, if the id is unknown' },
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

    // ── Platform-wide listings (every admin section) ─────────────────────────
    {
        type: 'function',
        function: {
            name: 'list_users',
            description: 'List riders/customers across the WHOLE platform with an exact `count` — use for "how many users", "all suspended users", "list our business accounts", "users who joined this week". Omit every optional filter unless the boss named one.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['active', 'suspended', 'banned'], description: 'accountStatus filter' },
                    userType: { type: 'string', enum: ['regular', 'parent', 'business'] },
                    search: { type: 'string', description: 'Name, phone or email fragment' },
                    period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], description: 'Only users who signed up within this window' },
                    limit: { type: 'integer', description: 'Rows to return (max 50). Pass 50 when the boss wants them all.' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_drivers',
            description: 'List drivers across the WHOLE platform with an exact `count` — use for "how many drivers", "all pending driver applications", "who is online right now", "suspended drivers".',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'suspended'] },
                    vehicleType: { type: 'string', enum: ['tuktuk', 'tuktuk_delivery', 'scooter', 'bike', 'taxi', 'comfort'] },
                    isOnline: { type: 'boolean', description: 'true = only drivers currently online' },
                    city: { type: 'string' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_subscriptions',
            description: 'List parent/school subscription plans across the platform with an exact `count` — use for "how many subscriptions", "all paused subscriptions", "subscriptions with no driver assigned". Each row shows the parent, child, school, route, monthly price and assigned driver.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['active', 'paused', 'cancelled', 'expired'] },
                    unassigned: { type: 'boolean', description: 'true = only subscriptions with no primary driver yet' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_subscription_detail',
            description: 'Get the FULL detail of one subscription — parent, child (name/age/school), pickup & dropoff route and times, primary + backup drivers, monthly price, missed days, status and dates. Identify it by id, or by child name, school, or parent name/phone.',
            parameters: {
                type: 'object',
                properties: {
                    subscriptionId: { type: 'string' },
                    query: { type: 'string', description: 'Child name, school, or parent name/phone' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_transactions',
            description: 'List payment transactions across the WHOLE platform with an exact `count` — use for "recent payments", "all failed transactions", "admin credits this month".',
            parameters: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['trip_payment', 'trip_earning', 'subscription_payment', 'wallet_topup', 'wallet_withdrawal', 'admin_credit', 'platform_fee', 'refund'] },
                    status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
                    method: { type: 'string', enum: ['cash', 'khalti', 'esewa', 'wallet'] },
                    period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'revenue_summary',
            description: 'Money totals for a period — total volume, platform fee revenue, rider payments, driver earnings, refunds and admin credits, each with a transaction count. Use for "how much revenue this month", "what did we earn today", "how much did we pay out".',
            parameters: {
                type: 'object',
                properties: { period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_withdrawals',
            description: 'List driver cashout requests across the WHOLE platform with an exact `count` and the total amount — use for "pending withdrawals", "how much is waiting to be paid out".',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'paid'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_documents',
            description: 'List driver verification documents across the WHOLE platform with an exact `count` — use for "the document queue", "how many documents are pending", "rejected documents", "expired documents". Each row shows the driver, document type, status and reason.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                    type: { type: 'string', enum: ['citizenship', 'driving_license', 'police_clearance', 'vehicle_registration', 'insurance', 'bluebook', 'profile_photo', 'vehicle_photo'] },
                    expired: { type: 'boolean', description: 'true = only documents past their expiry date' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_trip_detail',
            description: 'Get the FULL detail of one trip — rider, driver, vehicle, pickup/dropoff addresses and coordinates, distance, offered vs final price, payment method and status, cancellation reason, and the bids placed on it. Identify it by trip id.',
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
            name: 'get_emergency_detail',
            description: 'Get the FULL detail of one SOS/emergency alert — who raised it, their phone, location and address, the linked trip, priority, status, assigned admin, and every internal handling note. Identify it by id or by the reporter\'s name/phone.',
            parameters: {
                type: 'object',
                properties: {
                    emergencyId: { type: 'string' },
                    query: { type: 'string', description: "Reporter's name or phone" },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_notifications',
            description: 'List in-app notifications sent to riders/drivers across the platform, newest first, with an exact `count` — use for "what did we send out", "notification history", "how many unread notifications".',
            parameters: {
                type: 'object',
                properties: {
                    type: { type: 'string', description: 'Notification type, e.g. general, payment, document_verified' },
                    unreadOnly: { type: 'boolean' },
                    period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_admin_notifications',
            description: 'List internal staff notifications (e.g. "a ticket was assigned to you"), optionally for one named admin. Use for "what notifications does Sita have", "unread staff alerts".',
            parameters: {
                type: 'object',
                properties: {
                    adminQuery: { type: 'string', description: 'Admin name/email to scope to; omit for all staff' },
                    unreadOnly: { type: 'boolean' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_support_agents',
            description: 'List support agents with their current workload (active tickets) and their customer rating average. Use for "who is our best support agent", "who has the most open tickets", "is anyone at capacity".',
            parameters: { type: 'object', properties: { limit: { type: 'integer' } } },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_support_agent_ratings',
            description: 'Get the individual customer ratings and written feedback a named support agent received. Use for "what do customers say about Ram", "show me Sita\'s support reviews".',
            parameters: {
                type: 'object',
                properties: { adminQuery: { type: 'string' }, limit: { type: 'integer' } },
                required: ['adminQuery'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_support_settings',
            description: 'Get the global support configuration — whether voice notes / documents / audio & video calls are allowed, auto-assignment on/off, per-agent ticket capacity, and the published working hours.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_map_settings',
            description: 'Get the map/geo provider configuration — which provider (google or osm) powers place search, geocoding and directions, the restricted country code, and whether a Google Maps API key has been entered. The key value itself is never returned.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'api_log_stats',
            description: 'Get API traffic health — total captured calls, a breakdown by client (web/mobile/backend) and by domain, the error count and error rate, and the slowest recent endpoints. Use for "is the API healthy", "how many errors today", "which endpoint is slowest".',
            parameters: {
                type: 'object',
                properties: { period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_api_logs',
            description: 'List captured API calls (metadata only — method, URL, status, duration, client, who was authenticated). Use for "recent API errors", "what mobile calls failed", "show me 500s". Request and response BODIES are deliberately not returned.',
            parameters: {
                type: 'object',
                properties: {
                    source: { type: 'string', enum: ['web', 'mobile', 'backend'] },
                    domain: { type: 'string', description: 'Resource area, e.g. users, drivers, admin, support, trips' },
                    onlyErrors: { type: 'boolean', description: 'true = only calls that returned 4xx/5xx' },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                    period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'analytics_overview',
            description: 'Business analytics for a period — new users and drivers, trips by status with a completion rate, revenue, average fare, plus the top drivers and the vehicle-type split. Use for "how did we do this month", "growth numbers", "top drivers this week".',
            parameters: {
                type: 'object',
                properties: { period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_driver_availability',
            description: "Today's driver check-in / availability board for subscription routes — who checked in, who is unavailable and why, and which routes have a backup driver assigned. Use for \"who checked in today\", \"which drivers are off sick\".",
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' },
                    availableOnly: { type: 'boolean' },
                    limit: { type: 'integer' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_reviews',
            description: 'List recent rider reviews of drivers across the platform with an exact `count` — use for "recent complaints", "all 1-star reviews", "what are riders saying".',
            parameters: {
                type: 'object',
                properties: {
                    maxRating: { type: 'integer', description: 'Only reviews at or below this star rating (e.g. 2 for complaints)' },
                    period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'] },
                    limit: { type: 'integer' },
                },
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
        const [count, trips] = await Promise.all([
            Trip.countDocuments(filter),
            Trip.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 10))
                .populate('userId', 'name phone')
                .populate('driverId', 'vehiclePlate')
                .select('status vehicleType pickup.address dropoff.address offeredPrice finalPrice createdAt userId driverId'),
        ]);
        return {
            count,
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

    async list_support_tickets({ status, category, awaitingReply, limit = 10 } = {}) {
        status = normalizeTicketStatus(status);
        category = clean(category);
        awaitingReply = cleanBool(awaitingReply);
        const filter = { ...(status ? { status } : {}), ...(category ? { category } : {}) };
        // Exact total that matches the filter, independent of the display limit —
        // so "how many" answers are correct even when we only show a few rows.
        const totalMatching = await SupportTicket.countDocuments(filter);
        let tickets = await SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .limit(clampLimit(awaitingReply ? MAX_LIMIT : limit, 10))
            .populate('userId', 'name phone')
            .populate('driverId', 'userId')
            .populate('assignedTo', 'name')
            .select('subject category status rating.score createdAt userId driverId assignedTo guest messages');
        if (awaitingReply === true) tickets = tickets.filter(isAwaitingReply);
        else if (awaitingReply === false) tickets = tickets.filter((t) => !isAwaitingReply(t));
        const shaped = tickets.slice(0, clampLimit(limit, 10)).map((t) => {
            const msgs = t.messages || [];
            return {
                id: t._id, subject: t.subject, category: t.category, status: t.status,
                customer: t.userId?.name || t.guest?.name || 'Guest',
                openedBy: ticketOpenedBy(t),
                assignedTo: t.assignedTo?.name || null,
                awaitingReply: isAwaitingReply(t),
                messageCount: msgs.length,
                openingMessage: msgPreview(msgs[0]),
                lastMessage: msgPreview(msgs[msgs.length - 1]),
                lastMessageFrom: msgs.length ? msgs[msgs.length - 1].senderType : null,
                ratingGiven: t.rating?.score ?? null,
                createdAt: t.createdAt,
            };
        });
        return {
            count: awaitingReply === undefined ? totalMatching : shaped.length,
            totalMatchingFilter: totalMatching,
            awaitingReplyCount: shaped.filter((t) => t.awaitingReply).length,
            tickets: shaped,
        };
    },

    async get_support_ticket_detail({ ticketId, query } = {}) {
        ticketId = clean(ticketId);
        query = clean(query);
        let ticket = null;
        if (ticketId && /^[a-f\d]{24}$/i.test(String(ticketId))) {
            ticket = await SupportTicket.findById(ticketId)
                .populate('userId', 'name phone email')
                .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone email' } })
                .populate('assignedTo', 'name email')
                .populate('rating.agentId', 'name');
        }
        if (!ticket && query) {
            const rx = new RegExp(escapeRegex(query), 'i');
            const user = await User.findOne({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id');
            const or = [{ subject: rx }, { 'guest.name': rx }, { 'guest.email': rx }];
            if (user) or.push({ userId: user._id });
            ticket = await SupportTicket.findOne({ $or: or })
                .sort({ createdAt: -1 })
                .populate('userId', 'name phone email')
                .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone email' } })
                .populate('assignedTo', 'name email')
                .populate('rating.agentId', 'name');
        }
        if (!ticket) return { found: false };
        const msgs = ticket.messages || [];
        return {
            found: true,
            ticket: {
                id: ticket._id,
                subject: ticket.subject,
                category: ticket.category,
                status: ticket.status,
                openedBy: ticketOpenedBy(ticket),
                customer: ticket.userId?.name || ticket.driverId?.userId?.name || ticket.guest?.name || 'Guest',
                customerPhone: ticket.userId?.phone || ticket.driverId?.userId?.phone || null,
                customerEmail: ticket.userId?.email || ticket.driverId?.userId?.email || ticket.guest?.email || null,
                assignedTo: ticket.assignedTo?.name || null,
                awaitingReply: isAwaitingReply(ticket),
                messageCount: msgs.length,
                openingMessage: msgPreview(msgs[0]),
                lastMessage: msgPreview(msgs[msgs.length - 1]),
                thread: msgs.map((m) => ({
                    from: m.senderType,
                    isAI: !!m.isAI,
                    text: msgPreview(m),
                    at: m.createdAt,
                })),
                supportRating: ticket.rating?.score ?? null,
                supportRatingComment: ticket.rating?.comment || null,
                handledBy: ticket.rating?.agentId?.name || ticket.assignedTo?.name || null,
                createdAt: ticket.createdAt,
                resolvedAt: ticket.resolvedAt,
                closedAt: ticket.closedAt,
            },
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
        const [count, emergencies] = await Promise.all([
            Emergency.countDocuments({ status }),
            Emergency.find({ status })
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 10))
                .populate('userId', 'name phone')
                .select('role status address contactPhone createdAt userId'),
        ]);
        return {
            count,
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
        const [count, suppliers] = await Promise.all([
            Supplier.countDocuments(filter),
            Supplier.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 10))
                .select('businessName contactPerson phone city isVerified plan'),
        ]);
        return { count, suppliers };
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
        const [count, admins] = await Promise.all([
            Admin.countDocuments(filter),
            Admin.find(filter)
                .sort({ name: 1 })
                .limit(clampLimit(limit, 20))
                .select('name email phone role isActive createdAt'),
        ]);
        return { count, admins };
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

    // ── Platform-wide listings ───────────────────────────────────────────────
    async list_users({ status, userType, search, period, limit = 20 } = {}) {
        status = clean(status);
        userType = clean(userType);
        search = clean(search);
        const filter = {
            ...(status ? { accountStatus: status } : {}),
            ...(userType ? { userType } : {}),
            ...sinceFilter(period),
        };
        if (search) {
            const rx = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
        }
        const [count, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter).sort({ createdAt: -1 }).limit(clampLimit(limit, 20)).select(USER_FIELDS),
        ]);
        return { count, users: users.map(shapeUser) };
    },

    async list_drivers({ status, vehicleType, isOnline, city, limit = 20 } = {}) {
        status = clean(status);
        vehicleType = clean(vehicleType);
        city = clean(city);
        isOnline = cleanBool(isOnline);
        const filter = {
            ...(status ? { status } : {}),
            ...(vehicleType ? { vehicleType } : {}),
            ...(city ? { city } : {}),
            ...(typeof isOnline === 'boolean' ? { isOnline } : {}),
        };
        const [count, drivers] = await Promise.all([
            Driver.countDocuments(filter),
            Driver.find(filter).sort({ createdAt: -1 }).limit(clampLimit(limit, 20)).populate('userId', 'name phone email'),
        ]);
        return { count, drivers: drivers.map(shapeDriver) };
    },

    async list_subscriptions({ status, unassigned, limit = 20 } = {}) {
        status = clean(status);
        unassigned = cleanBool(unassigned);
        const filter = {
            ...(status ? { status } : {}),
            ...(unassigned === true ? { primaryDriver: null } : {}),
            ...(unassigned === false ? { primaryDriver: { $ne: null } } : {}),
        };
        const [count, subs] = await Promise.all([
            Subscription.countDocuments(filter),
            Subscription.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate('userId', 'name phone')
                .populate({ path: 'primaryDriver', select: 'vehiclePlate', populate: { path: 'userId', select: 'name phone' } }),
        ]);
        return {
            count,
            subscriptions: subs.map((s) => ({
                id: s._id, parent: s.userId?.name, parentPhone: s.userId?.phone,
                child: s.childName, school: s.schoolName, status: s.status,
                pickup: s.pickup?.address, dropoff: s.dropoff?.address,
                pickupTime: s.pickupTime, dropoffTime: s.dropoffTime,
                vehicleType: s.vehicleType, monthlyPrice: s.monthlyPrice,
                driver: s.primaryDriver?.userId?.name || null,
                driverPlate: s.primaryDriver?.vehiclePlate || null,
                missedDays: s.missedDays?.length || 0,
                startDate: s.startDate, endDate: s.endDate,
            })),
        };
    },

    async get_subscription_detail({ subscriptionId, query } = {}) {
        const s = await findBestSubscription({ subscriptionId: clean(subscriptionId), query: clean(query) });
        if (!s) return { found: false };
        const backups = await Driver.find({ _id: { $in: s.backupDrivers || [] } })
            .select('vehiclePlate userId')
            .populate('userId', 'name phone');
        return {
            found: true,
            subscription: {
                id: s._id, status: s.status, plan: s.plan,
                parent: s.userId?.name, parentPhone: s.userId?.phone, parentEmail: s.userId?.email,
                child: s.childName, childAge: s.childAge, school: s.schoolName,
                pickup: s.pickup?.address, pickupCoordinates: s.pickup?.location?.coordinates,
                dropoff: s.dropoff?.address, dropoffCoordinates: s.dropoff?.location?.coordinates,
                pickupTime: s.pickupTime, dropoffTime: s.dropoffTime,
                vehicleType: s.vehicleType, monthlyPrice: s.monthlyPrice,
                primaryDriver: s.primaryDriver?.userId?.name || null,
                primaryDriverPhone: s.primaryDriver?.userId?.phone || null,
                primaryDriverPlate: s.primaryDriver?.vehiclePlate || null,
                backupDrivers: backups.map((d) => ({ name: d.userId?.name, phone: d.userId?.phone, plate: d.vehiclePlate })),
                missedDays: (s.missedDays || []).length,
                startDate: s.startDate, endDate: s.endDate, createdAt: s.createdAt,
            },
        };
    },

    async list_transactions({ type, status, method, period, limit = 20 } = {}) {
        const filter = {
            ...(clean(type) ? { type: clean(type) } : {}),
            ...(clean(status) ? { status: clean(status) } : {}),
            ...(clean(method) ? { method: clean(method) } : {}),
            ...sinceFilter(period),
        };
        const [count, totalAgg, txns] = await Promise.all([
            Transaction.countDocuments(filter),
            Transaction.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Transaction.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate('userId', 'name phone')
                .populate({ path: 'driverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name' } })
                .select('amount type method status note gatewayRef createdAt userId driverId'),
        ]);
        return {
            count,
            totalAmount: totalAgg[0]?.total || 0,
            transactions: txns.map((t) => ({
                id: t._id, amount: t.amount, type: t.type, method: t.method, status: t.status,
                user: t.userId?.name || null, driver: t.driverId?.userId?.name || null,
                note: t.note, createdAt: t.createdAt,
            })),
        };
    },

    async revenue_summary({ period = 'month' } = {}) {
        const match = sinceFilter(period);
        const rows = await Transaction.aggregate([
            { $match: { ...match, status: 'completed' } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        const byType = Object.fromEntries(rows.map((r) => [r._id, { total: r.total, count: r.count }]));
        const get = (k) => byType[k]?.total || 0;
        return {
            period,
            byType,
            platformFeeRevenue: get('platform_fee'),
            riderPayments: get('trip_payment') + get('subscription_payment'),
            driverEarnings: get('trip_earning'),
            payouts: get('wallet_withdrawal'),
            refunds: get('refund'),
            adminCredits: get('admin_credit'),
            walletTopups: get('wallet_topup'),
            totalVolume: rows.reduce((sum, r) => sum + r.total, 0),
            transactionCount: rows.reduce((sum, r) => sum + r.count, 0),
        };
    },

    async list_withdrawals({ status, limit = 20 } = {}) {
        status = clean(status);
        const filter = status ? { status } : {};
        const [count, totalAgg, withdrawals] = await Promise.all([
            Withdrawal.countDocuments(filter),
            Withdrawal.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Withdrawal.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate({ path: 'driverId', select: 'vehiclePlate walletBalance userId', populate: { path: 'userId', select: 'name phone' } })
                .populate('processedBy', 'name')
                .select('amount method status note adminNote createdAt processedAt driverId processedBy'),
        ]);
        return {
            count,
            totalAmount: totalAgg[0]?.total || 0,
            withdrawals: withdrawals.map((w) => ({
                id: w._id, amount: w.amount, method: w.method, status: w.status,
                driver: w.driverId?.userId?.name, driverPhone: w.driverId?.userId?.phone,
                driverPlate: w.driverId?.vehiclePlate,
                driverNote: w.note, adminNote: w.adminNote,
                processedBy: w.processedBy?.name || null,
                createdAt: w.createdAt, processedAt: w.processedAt,
            })),
        };
    },

    async list_documents({ status, type, expired, limit = 20 } = {}) {
        status = clean(status);
        type = clean(type);
        expired = cleanBool(expired);
        const filter = {
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
            ...(expired === true ? { expiresAt: { $ne: null, $lt: new Date() } } : {}),
        };
        const [count, docs] = await Promise.all([
            Document.countDocuments(filter),
            Document.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate({ path: 'driverId', select: 'vehiclePlate vehicleType userId', populate: { path: 'userId', select: 'name phone' } })
                .populate('verifiedBy', 'name')
                .select('type status rejectionReason expiresAt verifiedAt createdAt driverId verifiedBy'),
        ]);
        return {
            count,
            documents: docs.map((d) => ({
                id: d._id, type: d.type, status: d.status,
                driver: d.driverId?.userId?.name || null,
                driverPhone: d.driverId?.userId?.phone || null,
                driverPlate: d.driverId?.vehiclePlate || null,
                rejectionReason: d.rejectionReason,
                expiresAt: d.expiresAt, verifiedBy: d.verifiedBy?.name || null,
                verifiedAt: d.verifiedAt, createdAt: d.createdAt,
            })),
        };
    },

    async get_trip_detail({ tripId }) {
        if (!tripId || !/^[a-f\d]{24}$/i.test(String(tripId))) return { found: false };
        const t = await Trip.findById(tripId)
            .populate('userId', 'name phone email')
            .populate({ path: 'driverId', select: 'vehiclePlate vehicleType vehicleModel rating userId', populate: { path: 'userId', select: 'name phone' } });
        if (!t) return { found: false };
        const bids = await Bid.find({ tripId: t._id })
            .populate({ path: 'driverId', select: 'vehiclePlate', populate: { path: 'userId', select: 'name' } })
            .select('amount status driverId');
        return {
            found: true,
            trip: {
                id: t._id, status: t.status, vehicleType: t.vehicleType,
                rider: t.userId?.name, riderPhone: t.userId?.phone,
                driver: t.driverId?.userId?.name || null, driverPhone: t.driverId?.userId?.phone || null,
                driverPlate: t.driverId?.vehiclePlate || null, driverRating: t.driverId?.rating ?? null,
                pickup: t.pickup?.address, pickupCoordinates: t.pickup?.location?.coordinates,
                dropoff: t.dropoff?.address, dropoffCoordinates: t.dropoff?.location?.coordinates,
                distanceKm: t.distance, offeredPrice: t.offeredPrice, finalPrice: t.finalPrice,
                paymentMethod: t.paymentMethod, paymentStatus: t.paymentStatus,
                cancelledBy: t.cancelledBy, cancelReason: t.cancelReason,
                isSubscriptionTrip: !!t.subscriptionId,
                createdAt: t.createdAt,
                bids: bids.map((b) => ({ driver: b.driverId?.userId?.name, plate: b.driverId?.vehiclePlate, amount: b.amount, status: b.status })),
            },
        };
    },

    async get_emergency_detail({ emergencyId, query } = {}) {
        emergencyId = clean(emergencyId);
        query = clean(query);
        let e = null;
        if (emergencyId && /^[a-f\d]{24}$/i.test(String(emergencyId))) {
            e = await Emergency.findById(emergencyId);
        }
        if (!e && query) {
            const user = await findBestUser(query);
            if (user) e = await Emergency.findOne({ userId: user._id }).sort({ createdAt: -1 });
        }
        if (!e) return { found: false };
        await e.populate([
            { path: 'userId', select: 'name phone email' },
            { path: 'handledBy', select: 'name' },
            { path: 'assignedTo', select: 'name' },
            { path: 'notes.authorId', select: 'name' },
        ]);
        return {
            found: true,
            emergency: {
                id: e._id, role: e.role, status: e.status, priority: e.priority,
                reportedBy: e.userId?.name, contactPhone: e.contactPhone || e.userId?.phone,
                address: e.address, coordinates: [e.location?.lng, e.location?.lat],
                message: e.message, tripId: e.tripId,
                handledBy: e.handledBy?.name || null, assignedTo: e.assignedTo?.name || null,
                notes: (e.notes || []).map((n) => ({ by: n.authorId?.name || 'Admin', body: n.body, at: n.createdAt })),
                createdAt: e.createdAt, acknowledgedAt: e.acknowledgedAt, resolvedAt: e.resolvedAt,
            },
        };
    },

    async list_notifications({ type, unreadOnly, period, limit = 20 } = {}) {
        type = clean(type);
        unreadOnly = cleanBool(unreadOnly);
        const filter = {
            ...(type ? { type } : {}),
            ...(unreadOnly === true ? { isRead: false } : {}),
            ...sinceFilter(period),
        };
        const [count, notifs] = await Promise.all([
            Notification.countDocuments(filter),
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate('userId', 'name phone')
                .populate({ path: 'driverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name' } })
                .select('title body type isRead createdAt userId driverId'),
        ]);
        return {
            count,
            notifications: notifs.map((n) => ({
                id: n._id, title: n.title, body: n.body, type: n.type, isRead: n.isRead,
                recipient: n.userId?.name || n.driverId?.userId?.name || null,
                recipientType: n.driverId ? 'driver' : 'rider',
                createdAt: n.createdAt,
            })),
        };
    },

    async list_admin_notifications({ adminQuery, unreadOnly, limit = 20 } = {}) {
        adminQuery = clean(adminQuery);
        unreadOnly = cleanBool(unreadOnly);
        const filter = { ...(unreadOnly === true ? { isRead: false } : {}) };
        if (adminQuery) {
            const admin = await findBestAdmin(adminQuery);
            if (!admin) return { found: false, count: 0, notifications: [] };
            filter.adminId = admin._id;
        }
        const [count, notifs] = await Promise.all([
            AdminNotification.countDocuments(filter),
            AdminNotification.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate('adminId', 'name role'),
        ]);
        return {
            count,
            notifications: notifs.map((n) => ({
                id: n._id, admin: n.adminId?.name, role: n.adminId?.role,
                title: n.title, body: n.body, type: n.type, link: n.link,
                isRead: n.isRead, createdAt: n.createdAt,
            })),
        };
    },

    async list_support_agents({ limit = 20 } = {}) {
        const [settings, agents] = await Promise.all([
            SupportSettings.findOne({ key: 'global' }).select('agentCapacity autoAssign'),
            Admin.find({ isActive: true })
                .sort({ name: 1 })
                .limit(clampLimit(limit, 20))
                .select('name email role supportRating'),
        ]);
        const capacity = settings?.agentCapacity ?? 5;
        const loads = await SupportTicket.aggregate([
            { $match: { status: { $in: ['open', 'in_progress'] }, assignedTo: { $ne: null } } },
            { $group: { _id: '$assignedTo', active: { $sum: 1 } } },
        ]);
        const loadBy = Object.fromEntries(loads.map((l) => [String(l._id), l.active]));
        const unassigned = await SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] }, assignedTo: null });
        return {
            agentCapacity: capacity,
            autoAssign: settings?.autoAssign ?? true,
            unassignedQueue: unassigned,
            agents: agents.map((a) => {
                const active = loadBy[String(a._id)] || 0;
                return {
                    name: a.name, email: a.email, role: a.role,
                    activeTickets: active, atCapacity: active >= capacity,
                    ratingAverage: a.supportRating?.average ?? 0,
                    ratingCount: a.supportRating?.count ?? 0,
                };
            }),
        };
    },

    async get_support_agent_ratings({ adminQuery, limit = 10 }) {
        const admin = await findBestAdmin(adminQuery);
        if (!admin) return { found: false };
        const reviews = await SupportReview.find({ agentId: admin._id })
            .sort({ ratedAt: -1 })
            .limit(clampLimit(limit, 10))
            .select('score comment tags customer subject ratedAt');
        return {
            found: true,
            agent: {
                name: admin.name, email: admin.email, role: admin.role,
                ratingAverage: admin.supportRating?.average ?? 0,
                ratingCount: admin.supportRating?.count ?? 0,
            },
            reviews: reviews.map((r) => ({
                score: r.score, comment: r.comment, tags: r.tags,
                customer: r.customer, subject: r.subject, ratedAt: r.ratedAt,
            })),
        };
    },

    async get_support_settings() {
        const s = await SupportSettings.findOne({ key: 'global' });
        if (!s) return { found: false };
        return {
            found: true,
            voiceMessages: s.voiceMessages, documents: s.documents,
            audioCall: s.audioCall, videoCall: s.videoCall,
            autoAssign: s.autoAssign, agentCapacity: s.agentCapacity,
            workingHours: s.workingHours,
        };
    },

    // The Google Maps key is a platform-wide secret — report only whether one is
    // configured, never the value, so it can't be echoed back into a chat reply.
    async get_map_settings() {
        const s = await MapSettings.findOne({ key: 'global' });
        if (!s) return { found: false };
        const hasKey = !!(s.googleMapsApiKey || '').trim();
        return {
            found: true,
            provider: s.provider,
            countryCode: s.countryCode,
            googleKeyConfigured: hasKey,
            effectiveProvider: s.provider === 'google' && hasKey ? 'google' : 'osm',
            updatedAt: s.updatedAt,
        };
    },

    async api_log_stats({ period = 'week' } = {}) {
        const match = sinceFilter(period);
        const [total, errors, bySource, byDomain, slowest] = await Promise.all([
            ApiLog.countDocuments(match),
            ApiLog.countDocuments({ ...match, statusCode: { $gte: 400 } }),
            ApiLog.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
            ApiLog.aggregate([{ $match: match }, { $group: { _id: '$domain', count: { $sum: 1 } } }]),
            ApiLog.find(match).sort({ durationMs: -1 }).limit(5).select('method path durationMs statusCode source'),
        ]);
        const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'other', r.count]));
        return {
            period, total, errors,
            errorRatePercent: total ? Math.round((errors / total) * 1000) / 10 : 0,
            bySource: toMap(bySource), byDomain: toMap(byDomain),
            slowestCalls: slowest.map((l) => ({ method: l.method, path: l.path, durationMs: l.durationMs, statusCode: l.statusCode, source: l.source })),
        };
    },

    // Metadata only. Request/response bodies are intentionally excluded — they
    // carry raw personal data (phones, tokens, addresses) from every domain.
    async list_api_logs({ source, domain, onlyErrors, method, period, limit = 20 } = {}) {
        onlyErrors = cleanBool(onlyErrors);
        const filter = {
            ...(clean(source) ? { source: clean(source) } : {}),
            ...(clean(domain) ? { domain: clean(domain) } : {}),
            ...(clean(method) ? { method: String(clean(method)).toUpperCase() } : {}),
            ...(onlyErrors === true ? { statusCode: { $gte: 400 } } : {}),
            ...sinceFilter(period),
        };
        const [count, logs] = await Promise.all([
            ApiLog.countDocuments(filter),
            ApiLog.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .select('method path statusCode ok durationMs source domain actorType normalized.message createdAt'),
        ]);
        return {
            count,
            logs: logs.map((l) => ({
                id: l._id, method: l.method, path: l.path, statusCode: l.statusCode, ok: l.ok,
                durationMs: l.durationMs, source: l.source, domain: l.domain,
                actorType: l.actorType, message: l.normalized?.message || null, at: l.createdAt,
            })),
        };
    },

    async analytics_overview({ period = 'month' } = {}) {
        const match = sinceFilter(period);
        const [newUsers, newDrivers, tripsByStatus, revenue, topDrivers, vehicleSplit] = await Promise.all([
            User.countDocuments(match),
            Driver.countDocuments(match),
            Trip.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$finalPrice' } } }]),
            Transaction.aggregate([
                { $match: { ...match, status: 'completed', type: { $in: ['trip_payment', 'subscription_payment'] } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            Driver.find({ totalRides: { $gt: 0 } })
                .sort({ totalRides: -1 })
                .limit(5)
                .populate('userId', 'name')
                .select('totalRides rating earnings vehiclePlate userId'),
            Trip.aggregate([{ $match: match }, { $group: { _id: '$vehicleType', count: { $sum: 1 } } }]),
        ]);
        const statusMap = Object.fromEntries(tripsByStatus.map((s) => [s._id, s.count]));
        const totalTrips = tripsByStatus.reduce((sum, s) => sum + s.count, 0);
        const completed = statusMap.completed || 0;
        const grossRevenue = revenue[0]?.total || 0;
        return {
            period,
            newUsers, newDrivers,
            totalTrips, tripsByStatus: statusMap,
            completionRatePercent: totalTrips ? Math.round((completed / totalTrips) * 1000) / 10 : 0,
            revenue: grossRevenue,
            paidTransactions: revenue[0]?.count || 0,
            averageFare: completed ? Math.round(grossRevenue / completed) : 0,
            topDrivers: topDrivers.map((d) => ({ name: d.userId?.name, plate: d.vehiclePlate, rides: d.totalRides, rating: d.rating, earnings: d.earnings })),
            vehicleSplit: Object.fromEntries(vehicleSplit.map((v) => [v._id, v.count])),
        };
    },

    async get_driver_availability({ date, availableOnly, limit = 20 } = {}) {
        availableOnly = cleanBool(availableOnly);
        // Match the whole calendar day — records are stored with a time component.
        const base = clean(date) ? new Date(`${clean(date)}T00:00:00`) : new Date();
        if (Number.isNaN(base.getTime())) return { error: 'Invalid date — use YYYY-MM-DD' };
        const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const filter = {
            date: { $gte: dayStart, $lt: dayEnd },
            ...(typeof availableOnly === 'boolean' ? { isAvailable: availableOnly } : {}),
        };
        const [count, checkedIn, rows] = await Promise.all([
            DriverAvailability.countDocuments(filter),
            DriverAvailability.countDocuments({ ...filter, isCheckedIn: true }),
            DriverAvailability.find(filter)
                .limit(clampLimit(limit, 20))
                .populate({ path: 'driverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name phone' } })
                .populate({ path: 'backupDriverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name' } }),
        ]);
        // Format from the LOCAL parts, not toISOString() — Nepal is UTC+05:45, so
        // converting local midnight to UTC would report the previous day.
        const pad = (n) => String(n).padStart(2, '0');
        return {
            date: `${dayStart.getFullYear()}-${pad(dayStart.getMonth() + 1)}-${pad(dayStart.getDate())}`,
            count, checkedInCount: checkedIn,
            drivers: rows.map((r) => ({
                driver: r.driverId?.userId?.name || null,
                phone: r.driverId?.userId?.phone || null,
                plate: r.driverId?.vehiclePlate || null,
                isAvailable: r.isAvailable, unavailableReason: r.unavailableReason,
                isCheckedIn: r.isCheckedIn, checkedInAt: r.checkedInAt,
                routes: (r.assignedSubscriptions || []).length,
                backupAssigned: r.backupAssigned,
                backupDriver: r.backupDriverId?.userId?.name || null,
            })),
        };
    },

    async list_reviews({ maxRating, period, limit = 20 } = {}) {
        const max = Number(clean(maxRating));
        const filter = {
            ...(Number.isFinite(max) ? { rating: { $lte: max } } : {}),
            ...sinceFilter(period),
        };
        const [count, reviews] = await Promise.all([
            Review.countDocuments(filter),
            Review.find(filter)
                .sort({ createdAt: -1 })
                .limit(clampLimit(limit, 20))
                .populate('fromUser', 'name phone')
                .populate({ path: 'toDriver', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name' } })
                .select('rating comment createdAt fromUser toDriver'),
        ]);
        return {
            count,
            reviews: reviews.map((r) => ({
                rating: r.rating, comment: r.comment,
                from: r.fromUser?.name, fromPhone: r.fromUser?.phone,
                driver: r.toDriver?.userId?.name || null, driverPlate: r.toDriver?.vehiclePlate || null,
                createdAt: r.createdAt,
            })),
        };
    },

    async platform_stats() {
        const [
            totalUsers, totalDrivers, onlineDrivers, pendingDrivers, tripsByStatus,
            totalTickets, openTickets, pendingWithdrawals, activeEmergencies,
            pendingDocuments, activeSubscriptions, totalSuppliers, staffCount, revenueToday,
        ] = await Promise.all([
            User.countDocuments({}),
            Driver.countDocuments({}),
            Driver.countDocuments({ isOnline: true }),
            Driver.countDocuments({ status: 'pending' }),
            Trip.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            SupportTicket.countDocuments({}),
            SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
            Withdrawal.countDocuments({ status: 'pending' }),
            Emergency.countDocuments({ status: 'active' }),
            Document.countDocuments({ status: 'pending' }),
            Subscription.countDocuments({ status: 'active' }),
            Supplier.countDocuments({}),
            Admin.countDocuments({ isActive: true }),
            Transaction.aggregate([
                { $match: { ...sinceFilter('today'), status: 'completed', type: { $in: ['trip_payment', 'subscription_payment'] } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);
        return {
            totalUsers, totalDrivers, onlineDrivers, pendingDriverApplications: pendingDrivers,
            tripsByStatus: Object.fromEntries(tripsByStatus.map((s) => [s._id, s.count])),
            totalSupportTickets: totalTickets, openSupportTickets: openTickets,
            pendingWithdrawals, activeEmergencies, pendingDocuments,
            activeSubscriptions, totalSuppliers, activeStaff: staffCount,
            revenueToday: revenueToday[0]?.total || 0,
        };
    },
};
