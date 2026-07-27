// Agentic AI ACTION tools — the write half of Tempu Ai.
//
// Every read tool in agenticTools.js runs immediately. Actions never do. They
// follow a strict propose → confirm → execute contract:
//
//   1. The model calls an action tool (e.g. send_notification). We only RESOLVE
//      it: look the target up by name, validate the arguments, and build a
//      human-readable preview. Nothing is written. The model is handed back
//      `proposed: true` so it reports the proposal instead of claiming success.
//   2. The proposal is signed (HMAC) and returned to the admin panel, which
//      renders a confirm card with Send / Cancel.
//   3. Only when the boss clicks Send does POST /admin/agentic/action verify the
//      signature, re-check the permission, and run `execute`.
//
// The signature matters because the payload round-trips through the browser: it
// pins the action to exactly what was proposed, to the admin who proposed it,
// and to a short expiry window — so a confirm call can't be edited into a
// different action, replayed later, or reused by another admin.
//
// Each action also declares the SAME permission its equivalent REST endpoint in
// admin.controller.js checks, so routing a change through the assistant can
// never grant an admin more than they already had. Actions the boss cannot
// perform are hidden from the model entirely.
//
// To add an action: add one entry to ACTIONS with { tool, permission, propose,
// execute }. `propose` must be side-effect free.
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Admin } from '../models/admin.model.js';
import { Driver } from '../models/driver.model.js';
import { Trip } from '../models/trip.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Withdrawal } from '../models/withdrawal.model.js';
import { Subscription } from '../models/subscription.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { SupportSettings } from '../models/supportSettings.model.js';
import { Emergency } from '../models/emergency.model.js';
import { Supplier } from '../models/supplier.model.js';
import { Pricing } from '../models/pricing.model.js';
import { Notification } from '../models/notification.model.js';
import { AdminNotification } from '../models/adminNotification.model.js';
import { Document } from '../models/doeument.model.js';
import { MapSettings } from '../models/mapSettings.model.js';
import {
    clean, escapeRegex, findBestUser, findBestDriver, findBestAdmin, findBestSubscription,
    normalizeTicketStatus,
} from './agenticTools.js';
import { processQueue } from './supportAssign.js';

// A proposal is only confirmable for this long. Long enough for the boss to read
// the card and decide; short enough that a stale tab can't fire it tomorrow.
const PROPOSAL_TTL_MS = 15 * 60 * 1000;
const SIGNING_SECRET = process.env.ADMIN_ACCESS_TOKEN_SECRET || '';

const NOTIFICATION_TYPES = ['trip_request', 'bid_received', 'bid_accepted', 'driver_arriving', 'trip_started', 'trip_completed', 'trip_cancelled', 'subscription_alert', 'document_verified', 'document_rejected', 'account_approved', 'account_suspended', 'account_rejected', 'payment', 'general'];
const DOCUMENT_TYPES = ['citizenship', 'driving_license', 'police_clearance', 'vehicle_registration', 'insurance', 'bluebook', 'profile_photo', 'vehicle_photo'];

const fail = (error) => ({ ok: false, error });
const money = (n) => `NPR ${Number(n).toLocaleString('en-US')}`;
const titleOf = (s) => String(s || '').replace(/_/g, ' ');

// ── Proposal signing ─────────────────────────────────────────────────────────
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(body) {
    return crypto.createHmac('sha256', SIGNING_SECRET).update(body).digest('base64url');
}

// Confirmation tokens are single-use. Without this, re-posting the same token
// inside its 15-minute window would run the action again — harmless for a status
// change, but a second grant_driver_money is real money out the door. Each
// proposal carries a random `j` (jti) that is burned on the first execute
// attempt, success or failure.
//
// In-memory: this backend runs as a single process, and the map self-empties
// because entries only need to outlive the token's own TTL. Behind multiple
// instances it would degrade to per-instance protection, at which point this
// should move to a shared store.
const usedTokens = new Map(); // jti -> expiry ms

function burnToken(jti, expiresAt) {
    // Opportunistic sweep so the map can't grow unbounded over a long uptime.
    if (usedTokens.size > 500) {
        const now = Date.now();
        for (const [k, exp] of usedTokens) if (exp < now) usedTokens.delete(k);
    }
    usedTokens.set(jti, expiresAt);
}

const isTokenUsed = (jti) => {
    const exp = usedTokens.get(jti);
    if (exp === undefined) return false;
    // Past its expiry the signature check rejects it anyway, so drop the entry.
    if (exp < Date.now()) { usedTokens.delete(jti); return false; }
    return true;
};

// token = base64url(claims).hmac — claims pin the action, args, admin, expiry
// and a single-use id.
function signProposal({ name, payload, adminId }) {
    const claims = b64url(JSON.stringify({
        n: name,
        p: payload,
        a: String(adminId),
        x: Date.now() + PROPOSAL_TTL_MS,
        j: crypto.randomBytes(12).toString('base64url'),
    }));
    return `${claims}.${sign(claims)}`;
}

// Returns { name, payload } or throws. Rejects a tampered, expired, or
// other-admin token — the client is never trusted with the action itself.
export function verifyProposal(token, adminId) {
    if (!SIGNING_SECRET) throw new Error('ADMIN_ACCESS_TOKEN_SECRET is not configured — cannot verify actions');
    const [claims, mac] = String(token || '').split('.');
    if (!claims || !mac) throw new Error('Malformed confirmation token');

    const expected = sign(claims);
    // Length-check first: timingSafeEqual throws on a length mismatch.
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
        throw new Error('This confirmation could not be verified — ask Tempu Ai to propose it again');
    }

    let decoded;
    try {
        decoded = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Malformed confirmation token');
    }
    if (!decoded?.n || !ACTIONS[decoded.n]) throw new Error('Unknown action');
    if (Date.now() > Number(decoded.x || 0)) throw new Error('This confirmation expired — ask Tempu Ai to propose it again');
    if (String(decoded.a) !== String(adminId)) throw new Error('This confirmation belongs to a different admin');

    return { name: decoded.n, payload: decoded.p || {}, jti: decoded.j, expiresAt: Number(decoded.x) };
}

// ── Shared resolvers ─────────────────────────────────────────────────────────
async function resolveTicket({ ticketId, query }) {
    ticketId = clean(ticketId);
    query = clean(query);
    if (ticketId && /^[a-f\d]{24}$/i.test(String(ticketId))) {
        const t = await SupportTicket.findById(ticketId).populate('userId', 'name phone');
        if (t) return t;
    }
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    const user = await User.findOne({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id');
    const or = [{ subject: rx }, { 'guest.name': rx }];
    if (user) or.push({ userId: user._id });
    return SupportTicket.findOne({ $or: or }).sort({ createdAt: -1 }).populate('userId', 'name phone');
}

async function resolveEmergency({ emergencyId, query }) {
    emergencyId = clean(emergencyId);
    query = clean(query);
    if (emergencyId && /^[a-f\d]{24}$/i.test(String(emergencyId))) {
        const e = await Emergency.findById(emergencyId).populate('userId', 'name phone');
        if (e) return e;
    }
    if (!query) return null;
    const user = await findBestUser(query);
    if (!user) return null;
    return Emergency.findOne({ userId: user._id }).sort({ createdAt: -1 }).populate('userId', 'name phone');
}

// A document is identified either by id, or by "<driver>'s <type>" — which is
// how an admin actually talks about the verification queue.
async function resolveDocument({ documentId, driverQuery, type }) {
    documentId = clean(documentId);
    driverQuery = clean(driverQuery);
    type = clean(type);
    const populate = { path: 'driverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name phone' } };
    if (documentId && /^[a-f\d]{24}$/i.test(String(documentId))) {
        const d = await Document.findById(documentId).populate(populate);
        if (d) return d;
    }
    if (!driverQuery) return null;
    const driver = await findBestDriver(driverQuery);
    if (!driver) return null;
    return Document.findOne({ driverId: driver._id, ...(type ? { type } : {}) })
        .sort({ createdAt: -1 })
        .populate(populate);
}

async function resolveSupplier(query) {
    if (!query) return null;
    const rx = new RegExp(escapeRegex(query), 'i');
    return Supplier.findOne({ $or: [{ businessName: rx }, { contactPerson: rx }, { phone: rx }, { email: rx }] });
}

// ── Action registry ──────────────────────────────────────────────────────────
// `permission` is either 'superadmin' or an Admin.permissions key. Superadmin
// passes every check (same rule as the `can()` helper in admin.controller.js).
export const ACTIONS = {
    // ── Notifications ────────────────────────────────────────────────────────
    send_notification: {
        permission: null, // any authenticated admin, matching /notifications/broadcast
        tool: {
            type: 'function',
            function: {
                name: 'send_notification',
                description: 'Send an in-app notification (also emailed) to ONE rider, driver, or staff member. Use for "message this user", "tell that driver ...", "notify Sita". The boss confirms before it is sent.',
                parameters: {
                    type: 'object',
                    properties: {
                        recipientType: { type: 'string', enum: ['user', 'driver', 'admin'], description: 'user = rider/customer, driver, admin = staff' },
                        recipientQuery: { type: 'string', description: 'Name, phone, email, or plate identifying the recipient' },
                        title: { type: 'string', description: 'Short notification heading' },
                        body: { type: 'string', description: 'The message text to send' },
                        notificationType: { type: 'string', enum: NOTIFICATION_TYPES, description: 'Category; defaults to general' },
                    },
                    required: ['recipientType', 'recipientQuery', 'title', 'body'],
                },
            },
        },
        async propose({ recipientType, recipientQuery, title, body, notificationType }) {
            const type = NOTIFICATION_TYPES.includes(clean(notificationType)) ? clean(notificationType) : 'general';
            title = (clean(title) || '').trim();
            body = (clean(body) || '').trim();
            if (!title || !body) return fail('Both a title and a message body are required.');

            if (recipientType === 'user') {
                const user = await findBestUser(recipientQuery);
                if (!user) return fail(`No rider found matching "${recipientQuery}".`);
                return {
                    ok: true,
                    label: 'Send notification',
                    summary: `Notify rider ${user.name} — "${title}"`,
                    fields: [
                        { label: 'To', value: `${user.name} (rider)` },
                        { label: 'Phone', value: user.phone || '—' },
                        { label: 'Email', value: user.email || 'no email on file' },
                        { label: 'Title', value: title },
                        { label: 'Message', value: body },
                        { label: 'Type', value: type },
                    ],
                    payload: { kind: 'user', id: String(user._id), name: user.name, title, body, type },
                };
            }
            if (recipientType === 'driver') {
                const driver = await findBestDriver(recipientQuery);
                if (!driver) return fail(`No driver found matching "${recipientQuery}".`);
                return {
                    ok: true,
                    label: 'Send notification',
                    summary: `Notify driver ${driver.userId?.name} — "${title}"`,
                    fields: [
                        { label: 'To', value: `${driver.userId?.name || 'Driver'} (driver${driver.vehiclePlate ? `, ${driver.vehiclePlate}` : ''})` },
                        { label: 'Phone', value: driver.userId?.phone || '—' },
                        { label: 'Email', value: driver.userId?.email || 'no email on file' },
                        { label: 'Title', value: title },
                        { label: 'Message', value: body },
                        { label: 'Type', value: type },
                    ],
                    payload: { kind: 'driver', id: String(driver._id), name: driver.userId?.name, title, body, type },
                };
            }
            const admin = await findBestAdmin(recipientQuery);
            if (!admin) return fail(`No staff member found matching "${recipientQuery}".`);
            return {
                ok: true,
                label: 'Send notification',
                summary: `Notify staff ${admin.name} — "${title}"`,
                fields: [
                    { label: 'To', value: `${admin.name} (${admin.role})` },
                    { label: 'Email', value: admin.email },
                    { label: 'Title', value: title },
                    { label: 'Message', value: body },
                ],
                payload: { kind: 'admin', id: String(admin._id), name: admin.name, title, body, type },
            };
        },
        async execute(p) {
            if (p.kind === 'admin') {
                await AdminNotification.create({ adminId: p.id, title: p.title, body: p.body, type: 'general' });
            } else if (p.kind === 'driver') {
                // The Notification post-save hook emails the recipient; a driver
                // notification is keyed by driverId so the hook resolves the
                // address through the linked user.
                await Notification.create({ driverId: p.id, title: p.title, body: p.body, type: p.type });
            } else {
                await Notification.create({ userId: p.id, title: p.title, body: p.body, type: p.type });
            }
            return { message: `Notification sent to ${p.name}.` };
        },
    },

    broadcast_notification: {
        permission: null,
        tool: {
            type: 'function',
            function: {
                name: 'broadcast_notification',
                description: 'Send one in-app notification to EVERY active rider, every approved driver, or both. Use only for genuine announcements — this reaches the whole platform. The boss confirms first, and sees the exact recipient count.',
                parameters: {
                    type: 'object',
                    properties: {
                        audience: { type: 'string', enum: ['all', 'users', 'drivers'], description: 'users = all riders, drivers = all approved drivers, all = both' },
                        title: { type: 'string' },
                        body: { type: 'string' },
                        notificationType: { type: 'string', enum: NOTIFICATION_TYPES },
                    },
                    required: ['audience', 'title', 'body'],
                },
            },
        },
        async propose({ audience, title, body, notificationType }) {
            if (!['all', 'users', 'drivers'].includes(audience)) return fail('Audience must be all, users, or drivers.');
            const type = NOTIFICATION_TYPES.includes(clean(notificationType)) ? clean(notificationType) : 'general';
            title = (clean(title) || '').trim();
            body = (clean(body) || '').trim();
            if (!title || !body) return fail('Both a title and a message body are required.');

            const [users, drivers] = await Promise.all([
                audience === 'drivers' ? 0 : User.countDocuments({ accountStatus: 'active' }),
                audience === 'users' ? 0 : Driver.countDocuments({ status: 'approved' }),
            ]);
            const total = users + drivers;
            if (!total) return fail('No active recipients match that audience.');
            return {
                ok: true,
                label: 'Broadcast notification',
                summary: `Broadcast "${title}" to ${total} recipient(s)`,
                fields: [
                    { label: 'Audience', value: audience === 'all' ? `Everyone — ${users} riders + ${drivers} drivers` : audience === 'users' ? `${users} active riders` : `${drivers} approved drivers` },
                    { label: 'Recipients', value: String(total) },
                    { label: 'Title', value: title },
                    { label: 'Message', value: body },
                ],
                payload: { audience, title, body, type, expected: total },
            };
        },
        async execute(p) {
            const [users, drivers] = await Promise.all([
                p.audience === 'drivers' ? [] : User.find({ accountStatus: 'active' }).select('_id'),
                p.audience === 'users' ? [] : Driver.find({ status: 'approved' }).select('_id'),
            ]);
            const docs = [
                ...users.map((u) => ({ userId: u._id, title: p.title, body: p.body, type: p.type })),
                ...drivers.map((d) => ({ driverId: d._id, title: p.title, body: p.body, type: p.type })),
            ];
            if (!docs.length) return { message: 'No recipients — nothing sent.' };
            // insertMany bypasses the per-doc save hook, so a broadcast stays
            // in-app only and never fires thousands of emails.
            await Notification.insertMany(docs, { ordered: false });
            return { message: `Broadcast sent to ${docs.length} recipient(s) (in-app only, no email blast).` };
        },
    },

    // ── Support ──────────────────────────────────────────────────────────────
    reply_to_support_ticket: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'reply_to_support_ticket',
                description: 'Post a reply into a support ticket conversation as the admin. Identify the ticket by id, subject text, or customer name. The boss confirms the wording first.',
                parameters: {
                    type: 'object',
                    properties: {
                        ticketId: { type: 'string' },
                        query: { type: 'string', description: 'Subject text or customer name, if the id is unknown' },
                        message: { type: 'string', description: 'The reply to send to the customer' },
                    },
                    required: ['message'],
                },
            },
        },
        async propose({ ticketId, query, message }) {
            message = (clean(message) || '').trim();
            if (!message) return fail('A reply message is required.');
            const t = await resolveTicket({ ticketId, query });
            if (!t) return fail('Could not find that support ticket.');
            if (t.status === 'closed') return fail(`Ticket "${t.subject}" is closed — reopen it before replying.`);
            const last = (t.messages || [])[t.messages.length - 1];
            return {
                ok: true,
                label: 'Reply to ticket',
                summary: `Reply to "${t.subject}"`,
                fields: [
                    { label: 'Ticket', value: `${t.subject} (#${String(t._id).slice(-8).toUpperCase()})` },
                    { label: 'Customer', value: t.userId?.name || t.guest?.name || 'Guest' },
                    { label: 'Status', value: t.status },
                    { label: 'Their last message', value: (last?.message || '—').slice(0, 200) },
                    { label: 'Your reply', value: message },
                ],
                payload: { ticketId: String(t._id), subject: t.subject, message },
            };
        },
        async execute(p, admin) {
            const t = await SupportTicket.findById(p.ticketId);
            if (!t) throw new Error('Ticket no longer exists');
            if (t.status === 'closed') throw new Error('Ticket has since been closed');
            t.messages.push({ senderId: admin._id, senderType: 'admin', message: p.message });
            if (t.status === 'open') t.status = 'in_progress';
            await t.save();
            return { message: `Reply posted to "${p.subject}".` };
        },
    },

    set_support_ticket_status: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'set_support_ticket_status',
                description: 'Change a support ticket\'s status (open, in_progress, resolved, closed). A ticket must be resolved before it can be closed.',
                parameters: {
                    type: 'object',
                    properties: {
                        ticketId: { type: 'string' },
                        query: { type: 'string', description: 'Subject text or customer name, if the id is unknown' },
                        status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                    },
                    required: ['status'],
                },
            },
        },
        async propose({ ticketId, query, status }) {
            status = normalizeTicketStatus(status);
            if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) return fail('Status must be open, in_progress, resolved, or closed.');
            const t = await resolveTicket({ ticketId, query });
            if (!t) return fail('Could not find that support ticket.');
            if (t.status === status) return fail(`Ticket "${t.subject}" is already ${status}.`);
            if (status === 'closed' && t.status !== 'resolved') return fail(`"${t.subject}" must be resolved before it can be closed.`);
            return {
                ok: true,
                label: 'Change ticket status',
                summary: `Set "${t.subject}" to ${status}`,
                fields: [
                    { label: 'Ticket', value: `${t.subject} (#${String(t._id).slice(-8).toUpperCase()})` },
                    { label: 'Customer', value: t.userId?.name || t.guest?.name || 'Guest' },
                    { label: 'Status', value: `${t.status} → ${status}` },
                ],
                payload: { ticketId: String(t._id), subject: t.subject, status },
            };
        },
        async execute(p) {
            const t = await SupportTicket.findById(p.ticketId);
            if (!t) throw new Error('Ticket no longer exists');
            if (p.status === 'closed' && t.status !== 'resolved' && t.status !== 'closed') throw new Error('Resolve the ticket before closing it');
            const wasActive = ['open', 'in_progress'].includes(t.status);
            t.status = p.status;
            if (p.status === 'resolved') t.resolvedAt = t.resolvedAt || new Date();
            if (p.status === 'closed') t.closedAt = new Date();
            if (['open', 'in_progress'].includes(p.status)) { t.resolvedAt = null; t.closedAt = null; }
            await t.save();
            // Freeing an agent slot should pull the next queued ticket, exactly
            // as the REST endpoint does.
            if (wasActive && ['resolved', 'closed'].includes(p.status)) processQueue().catch(() => {});
            return { message: `"${p.subject}" is now ${p.status}.` };
        },
    },

    assign_support_ticket: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'assign_support_ticket',
                description: 'Assign a support ticket to a named support agent. The agent gets an in-app staff notification.',
                parameters: {
                    type: 'object',
                    properties: {
                        ticketId: { type: 'string' },
                        query: { type: 'string', description: 'Subject text or customer name, if the id is unknown' },
                        adminQuery: { type: 'string', description: 'Name or email of the agent to assign it to' },
                    },
                    required: ['adminQuery'],
                },
            },
        },
        async propose({ ticketId, query, adminQuery }) {
            const t = await resolveTicket({ ticketId, query });
            if (!t) return fail('Could not find that support ticket.');
            const agent = await findBestAdmin(adminQuery);
            if (!agent) return fail(`No staff member found matching "${adminQuery}".`);
            if (!agent.isActive) return fail(`${agent.name} is deactivated — pick another agent.`);
            const current = t.assignedTo ? await Admin.findById(t.assignedTo).select('name') : null;
            return {
                ok: true,
                label: 'Assign ticket',
                summary: `Assign "${t.subject}" to ${agent.name}`,
                fields: [
                    { label: 'Ticket', value: `${t.subject} (#${String(t._id).slice(-8).toUpperCase()})` },
                    { label: 'Customer', value: t.userId?.name || t.guest?.name || 'Guest' },
                    { label: 'Assignee', value: `${current?.name || 'unassigned'} → ${agent.name} (${agent.role})` },
                ],
                payload: { ticketId: String(t._id), subject: t.subject, adminId: String(agent._id), agentName: agent.name },
            };
        },
        async execute(p, admin) {
            const t = await SupportTicket.findByIdAndUpdate(p.ticketId, { assignedTo: p.adminId }, { new: true });
            if (!t) throw new Error('Ticket no longer exists');
            const ref = String(t._id).slice(-8).toUpperCase();
            await AdminNotification.create({
                adminId: p.adminId,
                title: String(p.adminId) === String(admin._id) ? 'You took a ticket' : 'Ticket assigned to you',
                body: `${admin.name} assigned ticket #${ref} - "${t.subject}".`,
                type: 'ticket_assigned',
                link: `/support/${t._id}`,
                refId: t._id,
            });
            return { message: `"${p.subject}" assigned to ${p.agentName}.` };
        },
    },

    update_support_settings: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'update_support_settings',
                description: 'Change global support settings — allow/block voice notes, document uploads, audio & video calls; turn round-robin auto-assignment on or off; set per-agent ticket capacity; edit the published working hours. Only pass the fields being changed.',
                parameters: {
                    type: 'object',
                    properties: {
                        voiceMessages: { type: 'boolean' },
                        documents: { type: 'boolean' },
                        audioCall: { type: 'boolean' },
                        videoCall: { type: 'boolean' },
                        autoAssign: { type: 'boolean' },
                        agentCapacity: { type: 'integer', description: 'Max active tickets per agent (minimum 1)' },
                        workingHours: { type: 'string', description: 'Human-readable support hours shown to customers' },
                    },
                },
            },
        },
        async propose(args) {
            const current = await SupportSettings.findOne({ key: 'global' });
            const bools = ['voiceMessages', 'documents', 'audioCall', 'videoCall', 'autoAssign'];
            const changes = {};
            for (const k of bools) {
                if (typeof args[k] === 'boolean' || args[k] === 'true' || args[k] === 'false') changes[k] = args[k] === true || args[k] === 'true';
            }
            if (clean(args.agentCapacity) !== undefined) {
                const cap = parseInt(args.agentCapacity, 10);
                if (!Number.isFinite(cap) || cap < 1) return fail('Agent capacity must be a whole number of 1 or more.');
                changes.agentCapacity = cap;
            }
            if (clean(args.workingHours) !== undefined) changes.workingHours = String(args.workingHours).trim();
            if (!Object.keys(changes).length) return fail('Nothing to change — name at least one support setting.');
            return {
                ok: true,
                label: 'Update support settings',
                summary: `Change ${Object.keys(changes).length} support setting(s)`,
                fields: Object.entries(changes).map(([k, v]) => ({
                    label: titleOf(k),
                    value: `${current?.[k] === undefined ? '—' : String(current[k])} → ${String(v)}`,
                })),
                payload: { changes },
            };
        },
        async execute(p, admin) {
            let s = await SupportSettings.findOne({ key: 'global' });
            if (!s) s = await SupportSettings.create({ key: 'global' });
            Object.assign(s, p.changes, { updatedBy: admin._id });
            await s.save();
            return { message: `Support settings updated (${Object.keys(p.changes).join(', ')}).` };
        },
    },

    // ── Emergency / SOS ──────────────────────────────────────────────────────
    update_emergency_status: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'update_emergency_status',
                description: 'Acknowledge or resolve an SOS emergency alert. The person who raised it is notified and emailed.',
                parameters: {
                    type: 'object',
                    properties: {
                        emergencyId: { type: 'string' },
                        query: { type: 'string', description: "Reporter's name or phone, if the id is unknown" },
                        status: { type: 'string', enum: ['acknowledged', 'resolved'] },
                    },
                    required: ['status'],
                },
            },
        },
        async propose({ emergencyId, query, status }) {
            if (!['acknowledged', 'resolved'].includes(status)) return fail('Status must be acknowledged or resolved.');
            const e = await resolveEmergency({ emergencyId, query });
            if (!e) return fail('Could not find that emergency alert.');
            if (e.status === status) return fail(`That alert is already ${status}.`);
            return {
                ok: true,
                label: 'Update SOS alert',
                summary: `Mark ${e.userId?.name}'s SOS as ${status}`,
                fields: [
                    { label: 'Raised by', value: `${e.userId?.name || 'Unknown'} (${e.role})` },
                    { label: 'Phone', value: e.contactPhone || e.userId?.phone || '—' },
                    { label: 'Location', value: e.address || '—' },
                    { label: 'Priority', value: e.priority },
                    { label: 'Status', value: `${e.status} → ${status}` },
                    { label: 'Notifies', value: 'the person who raised it, by app + email' },
                ],
                payload: { emergencyId: String(e._id), name: e.userId?.name, status },
            };
        },
        async execute(p, admin) {
            const e = await Emergency.findById(p.emergencyId);
            if (!e) throw new Error('Emergency alert no longer exists');
            e.status = p.status;
            e.handledBy = admin._id;
            if (p.status === 'acknowledged' && !e.acknowledgedAt) e.acknowledgedAt = new Date();
            if (p.status === 'resolved') e.resolvedAt = new Date();
            await e.save();
            await Notification.create({
                userId: e.userId,
                title: p.status === 'resolved' ? 'Emergency Resolved' : 'Help Is On The Way',
                body: p.status === 'resolved'
                    ? 'Your emergency alert has been resolved by our team.'
                    : 'Our team has received your emergency alert and is responding.',
                type: 'general',
                refId: e._id,
            });
            return { message: `SOS alert marked ${p.status}.` };
        },
    },

    set_emergency_priority: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'set_emergency_priority',
                description: 'Set the triage priority of an SOS alert (normal, urgent, very_urgent).',
                parameters: {
                    type: 'object',
                    properties: {
                        emergencyId: { type: 'string' },
                        query: { type: 'string' },
                        priority: { type: 'string', enum: ['normal', 'urgent', 'very_urgent'] },
                    },
                    required: ['priority'],
                },
            },
        },
        async propose({ emergencyId, query, priority }) {
            if (!['normal', 'urgent', 'very_urgent'].includes(priority)) return fail('Priority must be normal, urgent, or very_urgent.');
            const e = await resolveEmergency({ emergencyId, query });
            if (!e) return fail('Could not find that emergency alert.');
            return {
                ok: true,
                label: 'Set SOS priority',
                summary: `Set ${e.userId?.name}'s SOS priority to ${titleOf(priority)}`,
                fields: [
                    { label: 'Raised by', value: e.userId?.name || 'Unknown' },
                    { label: 'Location', value: e.address || '—' },
                    { label: 'Priority', value: `${titleOf(e.priority)} → ${titleOf(priority)}` },
                ],
                payload: { emergencyId: String(e._id), priority },
            };
        },
        async execute(p) {
            const e = await Emergency.findByIdAndUpdate(p.emergencyId, { priority: p.priority }, { new: true });
            if (!e) throw new Error('Emergency alert no longer exists');
            return { message: `SOS priority set to ${titleOf(p.priority)}.` };
        },
    },

    add_emergency_note: {
        permission: 'handleSupport',
        tool: {
            type: 'function',
            function: {
                name: 'add_emergency_note',
                description: 'Add an internal handling note to an SOS alert. Staff-only — the person who raised the alert never sees it.',
                parameters: {
                    type: 'object',
                    properties: {
                        emergencyId: { type: 'string' },
                        query: { type: 'string' },
                        note: { type: 'string' },
                    },
                    required: ['note'],
                },
            },
        },
        async propose({ emergencyId, query, note }) {
            note = (clean(note) || '').trim();
            if (!note) return fail('A note body is required.');
            const e = await resolveEmergency({ emergencyId, query });
            if (!e) return fail('Could not find that emergency alert.');
            return {
                ok: true,
                label: 'Add SOS note',
                summary: `Add an internal note to ${e.userId?.name}'s SOS`,
                fields: [
                    { label: 'Alert', value: `${e.userId?.name || 'Unknown'} — ${e.status}` },
                    { label: 'Note', value: note },
                    { label: 'Visibility', value: 'internal — staff only' },
                ],
                payload: { emergencyId: String(e._id), note },
            };
        },
        async execute(p, admin) {
            const e = await Emergency.findById(p.emergencyId);
            if (!e) throw new Error('Emergency alert no longer exists');
            e.notes.push({ authorId: admin._id, body: p.note });
            await e.save();
            return { message: 'Internal note added to the SOS alert.' };
        },
    },

    // ── Users ────────────────────────────────────────────────────────────────
    set_user_status: {
        permission: 'manageUsers',
        tool: {
            type: 'function',
            function: {
                name: 'set_user_status',
                description: 'Change a rider\'s account status — activate, suspend, or ban them. Suspending or banning immediately blocks their access to the app.',
                parameters: {
                    type: 'object',
                    properties: {
                        userQuery: { type: 'string', description: 'Name, phone, or email identifying the rider' },
                        status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
                    },
                    required: ['userQuery', 'status'],
                },
            },
        },
        async propose({ userQuery, status }) {
            if (!['active', 'suspended', 'banned'].includes(status)) return fail('Status must be active, suspended, or banned.');
            const user = await findBestUser(userQuery);
            if (!user) return fail(`No rider found matching "${userQuery}".`);
            if (user.accountStatus === status) return fail(`${user.name} is already ${status}.`);
            return {
                ok: true,
                label: 'Change rider status',
                summary: `Set ${user.name} to ${status}`,
                fields: [
                    { label: 'Rider', value: user.name },
                    { label: 'Phone', value: user.phone || '—' },
                    { label: 'Status', value: `${user.accountStatus} → ${status}` },
                    ...(status === 'banned' || status === 'suspended'
                        ? [{ label: 'Effect', value: 'blocks their access to the app immediately' }]
                        : []),
                ],
                payload: { userId: String(user._id), name: user.name, status },
            };
        },
        async execute(p) {
            const user = await User.findByIdAndUpdate(p.userId, { accountStatus: p.status }, { new: true }).select('name');
            if (!user) throw new Error('Rider no longer exists');
            return { message: `${p.name} is now ${p.status}.` };
        },
    },

    // ── Drivers ──────────────────────────────────────────────────────────────
    set_driver_status: {
        permission: 'manageDrivers',
        tool: {
            type: 'function',
            function: {
                name: 'set_driver_status',
                description: 'Approve, reject, or suspend a driver. Approving verifies them and lets them go online; rejecting or suspending revokes it. The driver is notified and emailed either way.',
                parameters: {
                    type: 'object',
                    properties: {
                        driverQuery: { type: 'string', description: 'Name, phone, plate, or license number' },
                        status: { type: 'string', enum: ['approved', 'rejected', 'suspended'] },
                    },
                    required: ['driverQuery', 'status'],
                },
            },
        },
        async propose({ driverQuery, status }) {
            if (!['approved', 'rejected', 'suspended'].includes(status)) return fail('Status must be approved, rejected, or suspended.');
            const driver = await findBestDriver(driverQuery);
            if (!driver) return fail(`No driver found matching "${driverQuery}".`);
            if (driver.status === status) return fail(`${driver.userId?.name || 'That driver'} is already ${status}.`);
            return {
                ok: true,
                label: 'Change driver status',
                summary: `Set driver ${driver.userId?.name} to ${status}`,
                fields: [
                    { label: 'Driver', value: driver.userId?.name || 'Driver' },
                    { label: 'Phone', value: driver.userId?.phone || '—' },
                    { label: 'Vehicle', value: [driver.vehicleType, driver.vehiclePlate].filter(Boolean).join(' · ') || '—' },
                    { label: 'Rides / rating', value: `${driver.totalRides || 0} rides · ${driver.rating ?? 0}★` },
                    { label: 'Status', value: `${driver.status} → ${status}` },
                    { label: 'Effect', value: status === 'approved' ? 'can go online and accept trips' : 'cannot accept trips; notified by app + email' },
                ],
                payload: { driverId: String(driver._id), name: driver.userId?.name, status },
            };
        },
        async execute(p) {
            const driver = await Driver.findByIdAndUpdate(
                p.driverId,
                { status: p.status, isVerified: p.status === 'approved' },
                { new: true }
            );
            if (!driver) throw new Error('Driver no longer exists');
            // Keep the linked User.role in step, exactly as updateDriverStatus does.
            await User.findByIdAndUpdate(driver.userId, { role: p.status === 'approved' ? 'driver' : 'passenger' });
            const map = {
                approved: ['Account Approved', 'Your driver account has been approved. You can now go online and accept trips.', 'account_approved'],
                rejected: ['Account Rejected', 'Your driver account has been rejected.', 'account_rejected'],
                suspended: ['Account Suspended', 'Your driver account has been suspended.', 'account_suspended'],
            };
            const [title, body, type] = map[p.status];
            await Notification.create({ userId: driver.userId, title, body, type, refId: driver._id });
            return { message: `${p.name || 'Driver'} is now ${p.status}.` };
        },
    },

    grant_driver_money: {
        permission: 'managePayments',
        tool: {
            type: 'function',
            function: {
                name: 'grant_driver_money',
                description: 'Credit money to a driver\'s withdrawable wallet balance. Real money — creates an admin_credit transaction and emails the driver. Max NPR 1,000,000 per grant.',
                parameters: {
                    type: 'object',
                    properties: {
                        driverQuery: { type: 'string' },
                        amount: { type: 'number', description: 'Amount in NPR' },
                        note: { type: 'string', description: 'Reason shown to the driver' },
                    },
                    required: ['driverQuery', 'amount'],
                },
            },
        },
        async propose({ driverQuery, amount, note }) {
            const value = parseFloat(amount);
            if (!Number.isFinite(value) || value <= 0) return fail('A positive amount is required.');
            if (value > 1000000) return fail('Maximum grant is NPR 1,000,000.');
            const driver = await findBestDriver(driverQuery);
            if (!driver) return fail(`No driver found matching "${driverQuery}".`);
            const trimmed = (clean(note) || '').trim() || null;
            return {
                ok: true,
                label: 'Grant money to driver',
                summary: `Credit ${money(value)} to ${driver.userId?.name}`,
                fields: [
                    { label: 'Driver', value: driver.userId?.name || 'Driver' },
                    { label: 'Phone', value: driver.userId?.phone || '—' },
                    { label: 'Amount', value: money(value) },
                    { label: 'Wallet', value: `${money(driver.walletBalance || 0)} → ${money((driver.walletBalance || 0) + value)}` },
                    { label: 'Note', value: trimmed || '—' },
                    { label: 'Effect', value: 'real money, withdrawable by the driver' },
                ],
                payload: { driverId: String(driver._id), name: driver.userId?.name, amount: value, note: trimmed },
            };
        },
        async execute(p) {
            const driver = await Driver.findByIdAndUpdate(p.driverId, { $inc: { walletBalance: p.amount } }, { new: true });
            if (!driver) throw new Error('Driver no longer exists');
            const txn = await Transaction.create({
                driverId: driver._id, amount: p.amount, type: 'admin_credit',
                method: 'wallet', status: 'completed', note: p.note,
            });
            await Notification.create({
                userId: driver.userId,
                title: 'Money Added to Your Wallet',
                body: `NPR ${p.amount} has been credited to your wallet${p.note ? ` - ${p.note}` : ''}.`,
                type: 'payment',
                refId: txn._id,
            });
            return { message: `${money(p.amount)} credited to ${p.name}. New balance ${money(driver.walletBalance)}.` };
        },
    },

    // ── Withdrawals ──────────────────────────────────────────────────────────
    process_withdrawal: {
        permission: 'managePayments',
        tool: {
            type: 'function',
            function: {
                name: 'process_withdrawal',
                description: 'Approve, reject, or mark-as-paid a driver cashout request. Rejecting refunds the held amount to the driver\'s wallet. Identify it by withdrawal id, or by the driver (their newest pending request is used).',
                parameters: {
                    type: 'object',
                    properties: {
                        withdrawalId: { type: 'string' },
                        driverQuery: { type: 'string', description: 'Driver name/phone/plate, if the withdrawal id is unknown' },
                        action: { type: 'string', enum: ['approve', 'reject', 'paid'] },
                        adminNote: { type: 'string', description: 'Reason or payment reference' },
                    },
                    required: ['action'],
                },
            },
        },
        async propose({ withdrawalId, driverQuery, action, adminNote }) {
            if (!['approve', 'reject', 'paid'].includes(action)) return fail('Action must be approve, reject, or paid.');
            const populate = { path: 'driverId', select: 'vehiclePlate walletBalance userId', populate: { path: 'userId', select: 'name phone' } };
            let w = null;
            if (clean(withdrawalId) && /^[a-f\d]{24}$/i.test(String(withdrawalId))) {
                w = await Withdrawal.findById(withdrawalId).populate(populate);
            }
            if (!w && clean(driverQuery)) {
                const driver = await findBestDriver(driverQuery);
                if (!driver) return fail(`No driver found matching "${driverQuery}".`);
                w = await Withdrawal.findOne({ driverId: driver._id, status: 'pending' }).sort({ createdAt: -1 }).populate(populate);
                if (!w) return fail(`${driver.userId?.name || 'That driver'} has no pending withdrawal request.`);
            }
            if (!w) return fail('Could not find that withdrawal request.');
            if (['rejected', 'paid'].includes(w.status)) return fail(`That withdrawal is already ${w.status}.`);
            if (action === 'approve' && w.status !== 'pending') return fail('Only pending requests can be approved.');
            return {
                ok: true,
                label: `${action === 'paid' ? 'Mark withdrawal paid' : `${titleOf(action)} withdrawal`}`,
                summary: `${titleOf(action)} ${money(w.amount)} cashout for ${w.driverId?.userId?.name}`,
                fields: [
                    { label: 'Driver', value: w.driverId?.userId?.name || 'Driver' },
                    { label: 'Amount', value: money(w.amount) },
                    { label: 'Method', value: w.method },
                    { label: 'Status', value: `${w.status} → ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid'}` },
                    { label: 'Note', value: (clean(adminNote) || '').trim() || '—' },
                    ...(action === 'reject' ? [{ label: 'Effect', value: `${money(w.amount)} refunded to the driver's wallet` }] : []),
                ],
                payload: { withdrawalId: String(w._id), action, adminNote: (clean(adminNote) || '').trim() || null, name: w.driverId?.userId?.name, amount: w.amount },
            };
        },
        async execute(p, admin) {
            const w = await Withdrawal.findById(p.withdrawalId);
            if (!w) throw new Error('Withdrawal request no longer exists');
            if (['rejected', 'paid'].includes(w.status)) throw new Error(`Withdrawal is already ${w.status}`);

            if (p.action === 'approve') {
                if (w.status !== 'pending') throw new Error('Only pending requests can be approved');
                w.status = 'approved';
            } else if (p.action === 'reject') {
                await Driver.findByIdAndUpdate(w.driverId, { $inc: { walletBalance: w.amount } });
                w.status = 'rejected';
            } else {
                const txn = await Transaction.create({
                    driverId: w.driverId, amount: w.amount, type: 'wallet_withdrawal',
                    method: w.method === 'bank' ? 'wallet' : w.method, status: 'completed',
                });
                w.status = 'paid';
                w.transactionId = txn._id;
            }
            if (p.adminNote) w.adminNote = p.adminNote;
            w.processedBy = admin._id;
            w.processedAt = new Date();
            await w.save();

            const driver = await Driver.findById(w.driverId).select('userId');
            if (driver) {
                const messages = {
                    approve: `Your withdrawal of NPR ${w.amount} has been approved and is being processed.`,
                    reject: `Your withdrawal of NPR ${w.amount} was rejected and refunded to your wallet${p.adminNote ? ` - ${p.adminNote}` : ''}.`,
                    paid: `Your withdrawal of NPR ${w.amount} has been paid out.`,
                };
                await Notification.create({ userId: driver.userId, title: 'Withdrawal Update', body: messages[p.action], type: 'payment', refId: w._id });
            }
            return { message: `${money(p.amount)} cashout for ${p.name} is now ${w.status}.` };
        },
    },

    // ── Documents ────────────────────────────────────────────────────────────
    verify_document: {
        permission: 'verifyDocuments',
        tool: {
            type: 'function',
            function: {
                name: 'verify_document',
                description: 'Approve a driver verification document. Identify it by document id, or by driver plus document type. The driver is notified.',
                parameters: {
                    type: 'object',
                    properties: {
                        documentId: { type: 'string' },
                        driverQuery: { type: 'string', description: 'Driver name/phone/plate, if the document id is unknown' },
                        type: { type: 'string', enum: DOCUMENT_TYPES },
                    },
                },
            },
        },
        async propose({ documentId, driverQuery, type }) {
            const d = await resolveDocument({ documentId, driverQuery, type });
            if (!d) return fail('Could not find that document.');
            if (d.status === 'approved') return fail(`That ${titleOf(d.type)} is already approved.`);
            return {
                ok: true,
                label: 'Approve document',
                summary: `Approve ${d.driverId?.userId?.name}'s ${titleOf(d.type)}`,
                fields: [
                    { label: 'Driver', value: d.driverId?.userId?.name || 'Driver' },
                    { label: 'Document', value: titleOf(d.type) },
                    { label: 'Status', value: `${d.status} → approved` },
                    { label: 'Uploaded', value: new Date(d.createdAt).toISOString().slice(0, 10) },
                ],
                payload: { documentId: String(d._id), driverName: d.driverId?.userId?.name, type: d.type },
            };
        },
        async execute(p, admin) {
            const d = await Document.findByIdAndUpdate(
                p.documentId,
                { status: 'approved', verifiedBy: admin._id, verifiedAt: new Date(), rejectionReason: null },
                { new: true }
            ).populate({ path: 'driverId', populate: { path: 'userId', select: '_id' } });
            if (!d) throw new Error('Document no longer exists');
            await Notification.create({
                userId: d.driverId.userId._id,
                title: 'Document Approved',
                body: `Your ${titleOf(d.type)} has been approved`,
                type: 'document_verified',
                refId: d._id,
            });
            return { message: `${p.driverName}'s ${titleOf(p.type)} approved.` };
        },
    },

    reject_document: {
        permission: 'verifyDocuments',
        tool: {
            type: 'function',
            function: {
                name: 'reject_document',
                description: 'Reject a driver verification document with a reason. Identify it by document id, or by driver plus document type. The driver is notified with the reason.',
                parameters: {
                    type: 'object',
                    properties: {
                        documentId: { type: 'string' },
                        driverQuery: { type: 'string' },
                        type: { type: 'string', enum: DOCUMENT_TYPES },
                        reason: { type: 'string', description: 'Why it was rejected — shown to the driver' },
                    },
                    required: ['reason'],
                },
            },
        },
        async propose({ documentId, driverQuery, type, reason }) {
            reason = (clean(reason) || '').trim();
            if (!reason) return fail('A rejection reason is required — the driver sees it.');
            const d = await resolveDocument({ documentId, driverQuery, type });
            if (!d) return fail('Could not find that document.');
            return {
                ok: true,
                label: 'Reject document',
                summary: `Reject ${d.driverId?.userId?.name}'s ${titleOf(d.type)}`,
                fields: [
                    { label: 'Driver', value: d.driverId?.userId?.name || 'Driver' },
                    { label: 'Document', value: titleOf(d.type) },
                    { label: 'Status', value: `${d.status} → rejected` },
                    { label: 'Reason', value: reason },
                ],
                payload: { documentId: String(d._id), driverName: d.driverId?.userId?.name, type: d.type, reason },
            };
        },
        async execute(p, admin) {
            const d = await Document.findByIdAndUpdate(
                p.documentId,
                { status: 'rejected', verifiedBy: admin._id, verifiedAt: new Date(), rejectionReason: p.reason },
                { new: true }
            ).populate({ path: 'driverId', populate: { path: 'userId', select: '_id' } });
            if (!d) throw new Error('Document no longer exists');
            await Notification.create({
                userId: d.driverId.userId._id,
                title: 'Document Rejected',
                body: `Your ${titleOf(d.type)} was rejected. Reason: ${p.reason}`,
                type: 'document_rejected',
                refId: d._id,
            });
            return { message: `${p.driverName}'s ${titleOf(p.type)} rejected.` };
        },
    },

    // ── Subscriptions ────────────────────────────────────────────────────────
    set_subscription_status: {
        permission: 'manageSubscriptions',
        tool: {
            type: 'function',
            function: {
                name: 'set_subscription_status',
                description: 'Change a parent/school subscription\'s status — active, paused, cancelled, or expired. Identify it by id, child name, school, or parent name.',
                parameters: {
                    type: 'object',
                    properties: {
                        subscriptionId: { type: 'string' },
                        query: { type: 'string', description: 'Child name, school, or parent name/phone' },
                        status: { type: 'string', enum: ['active', 'paused', 'cancelled', 'expired'] },
                    },
                    required: ['status'],
                },
            },
        },
        async propose({ subscriptionId, query, status }) {
            if (!['active', 'paused', 'cancelled', 'expired'].includes(status)) return fail('Status must be active, paused, cancelled, or expired.');
            const s = await findBestSubscription({ subscriptionId: clean(subscriptionId), query: clean(query) });
            if (!s) return fail('Could not find that subscription.');
            if (s.status === status) return fail(`That subscription is already ${status}.`);
            return {
                ok: true,
                label: 'Change subscription status',
                summary: `Set ${s.childName || s.userId?.name}'s subscription to ${status}`,
                fields: [
                    { label: 'Parent', value: s.userId?.name || '—' },
                    { label: 'Child', value: s.childName || '—' },
                    { label: 'School', value: s.schoolName || '—' },
                    { label: 'Monthly', value: money(s.monthlyPrice || 0) },
                    { label: 'Status', value: `${s.status} → ${status}` },
                ],
                payload: { subscriptionId: String(s._id), label: s.childName || s.userId?.name, status },
            };
        },
        async execute(p) {
            const s = await Subscription.findByIdAndUpdate(p.subscriptionId, { status: p.status }, { new: true });
            if (!s) throw new Error('Subscription no longer exists');
            return { message: `${p.label}'s subscription is now ${p.status}.` };
        },
    },

    assign_subscription_driver: {
        permission: 'manageSubscriptions',
        tool: {
            type: 'function',
            function: {
                name: 'assign_subscription_driver',
                description: 'Assign an approved driver as the primary driver on a parent/school subscription route.',
                parameters: {
                    type: 'object',
                    properties: {
                        subscriptionId: { type: 'string' },
                        query: { type: 'string', description: 'Child name, school, or parent name/phone' },
                        driverQuery: { type: 'string', description: 'Driver name, phone, or plate' },
                    },
                    required: ['driverQuery'],
                },
            },
        },
        async propose({ subscriptionId, query, driverQuery }) {
            const s = await findBestSubscription({ subscriptionId: clean(subscriptionId), query: clean(query) });
            if (!s) return fail('Could not find that subscription.');
            const driver = await findBestDriver(driverQuery);
            if (!driver) return fail(`No driver found matching "${driverQuery}".`);
            if (driver.status !== 'approved') return fail(`${driver.userId?.name || 'That driver'} is ${driver.status} — only approved drivers can be assigned.`);
            return {
                ok: true,
                label: 'Assign subscription driver',
                summary: `Assign ${driver.userId?.name} to ${s.childName || s.userId?.name}'s route`,
                fields: [
                    { label: 'Child', value: s.childName || '—' },
                    { label: 'Route', value: `${s.pickup?.address || '—'} → ${s.dropoff?.address || '—'}` },
                    { label: 'Times', value: [s.pickupTime, s.dropoffTime].filter(Boolean).join(' / ') || '—' },
                    { label: 'Driver', value: `${s.primaryDriver?.userId?.name || 'unassigned'} → ${driver.userId?.name} (${driver.vehiclePlate || driver.vehicleType})` },
                ],
                payload: { subscriptionId: String(s._id), label: s.childName || s.userId?.name, driverId: String(driver._id), driverName: driver.userId?.name },
            };
        },
        async execute(p) {
            const driver = await Driver.findById(p.driverId).select('status');
            if (!driver) throw new Error('Driver no longer exists');
            if (driver.status !== 'approved') throw new Error('Driver is no longer approved');
            const s = await Subscription.findByIdAndUpdate(p.subscriptionId, { primaryDriver: p.driverId }, { new: true });
            if (!s) throw new Error('Subscription no longer exists');
            return { message: `${p.driverName} assigned to ${p.label}'s route.` };
        },
    },

    // ── Trips ────────────────────────────────────────────────────────────────
    cancel_trip: {
        permission: 'manageTrips',
        tool: {
            type: 'function',
            function: {
                name: 'cancel_trip',
                description: 'Cancel a trip that is still in progress, with a reason. Completed and already-cancelled trips cannot be cancelled. Identify it by trip id.',
                parameters: {
                    type: 'object',
                    properties: {
                        tripId: { type: 'string' },
                        reason: { type: 'string', description: 'Why the trip is being cancelled' },
                    },
                    required: ['tripId', 'reason'],
                },
            },
        },
        async propose({ tripId, reason }) {
            reason = (clean(reason) || '').trim();
            if (!reason) return fail('A cancellation reason is required.');
            if (!clean(tripId) || !/^[a-f\d]{24}$/i.test(String(tripId))) return fail('A valid trip id is required.');
            const t = await Trip.findById(tripId)
                .populate('userId', 'name phone')
                .populate({ path: 'driverId', select: 'vehiclePlate userId', populate: { path: 'userId', select: 'name' } });
            if (!t) return fail('Could not find that trip.');
            if (['completed', 'cancelled'].includes(t.status)) return fail(`That trip is already ${t.status}.`);
            return {
                ok: true,
                label: 'Cancel trip',
                summary: `Cancel ${t.userId?.name}'s trip`,
                fields: [
                    { label: 'Rider', value: t.userId?.name || '—' },
                    { label: 'Driver', value: t.driverId?.userId?.name || 'unassigned' },
                    { label: 'Route', value: `${t.pickup?.address || '—'} → ${t.dropoff?.address || '—'}` },
                    { label: 'Price', value: money(t.finalPrice ?? t.offeredPrice ?? 0) },
                    { label: 'Status', value: `${t.status} → cancelled` },
                    { label: 'Reason', value: reason },
                ],
                payload: { tripId: String(t._id), rider: t.userId?.name, reason },
            };
        },
        async execute(p) {
            const t = await Trip.findById(p.tripId);
            if (!t) throw new Error('Trip no longer exists');
            if (['completed', 'cancelled'].includes(t.status)) throw new Error(`Trip is already ${t.status}`);
            t.status = 'cancelled';
            // The schema enum is rider|driver|system — 'system' is what the REST
            // endpoint records for an admin-initiated cancellation.
            t.cancelledBy = 'system';
            t.cancelReason = p.reason;
            t.cancelledAt = new Date();
            await t.save();
            if (t.userId) {
                await Notification.create({
                    userId: t.userId,
                    title: 'Trip Cancelled',
                    body: `Your trip was cancelled by our team. Reason: ${p.reason}`,
                    type: 'trip_cancelled',
                    refId: t._id,
                });
            }
            return { message: `${p.rider}'s trip cancelled.` };
        },
    },

    // ── Suppliers ────────────────────────────────────────────────────────────
    verify_supplier: {
        permission: 'manageSuppliers',
        tool: {
            type: 'function',
            function: {
                name: 'verify_supplier',
                description: 'Mark a vehicle supplier as verified. Identify them by business name, contact person, phone, or email.',
                parameters: {
                    type: 'object',
                    properties: { supplierQuery: { type: 'string' } },
                    required: ['supplierQuery'],
                },
            },
        },
        async propose({ supplierQuery }) {
            const s = await resolveSupplier(clean(supplierQuery));
            if (!s) return fail(`No supplier found matching "${supplierQuery}".`);
            if (s.isVerified) return fail(`${s.businessName} is already verified.`);
            return {
                ok: true,
                label: 'Verify supplier',
                summary: `Verify ${s.businessName}`,
                fields: [
                    { label: 'Business', value: s.businessName },
                    { label: 'Contact', value: [s.contactPerson, s.phone].filter(Boolean).join(' · ') || '—' },
                    { label: 'City', value: s.city || '—' },
                    { label: 'Verified', value: 'no → yes' },
                ],
                payload: { supplierId: String(s._id), name: s.businessName },
            };
        },
        async execute(p, admin) {
            const s = await Supplier.findByIdAndUpdate(p.supplierId, { isVerified: true, verifiedBy: admin._id }, { new: true });
            if (!s) throw new Error('Supplier no longer exists');
            return { message: `${p.name} verified.` };
        },
    },

    set_supplier_plan: {
        permission: 'manageSuppliers',
        tool: {
            type: 'function',
            function: {
                name: 'set_supplier_plan',
                description: "Change a vehicle supplier's plan (basic or premium).",
                parameters: {
                    type: 'object',
                    properties: {
                        supplierQuery: { type: 'string' },
                        plan: { type: 'string', enum: ['basic', 'premium'] },
                    },
                    required: ['supplierQuery', 'plan'],
                },
            },
        },
        async propose({ supplierQuery, plan }) {
            if (!['basic', 'premium'].includes(plan)) return fail('Plan must be basic or premium.');
            const s = await resolveSupplier(clean(supplierQuery));
            if (!s) return fail(`No supplier found matching "${supplierQuery}".`);
            if (s.plan === plan) return fail(`${s.businessName} is already on the ${plan} plan.`);
            return {
                ok: true,
                label: 'Change supplier plan',
                summary: `Move ${s.businessName} to the ${plan} plan`,
                fields: [
                    { label: 'Business', value: s.businessName },
                    { label: 'Plan', value: `${s.plan} → ${plan}` },
                ],
                payload: { supplierId: String(s._id), name: s.businessName, plan },
            };
        },
        async execute(p) {
            const s = await Supplier.findByIdAndUpdate(p.supplierId, { plan: p.plan }, { new: true });
            if (!s) throw new Error('Supplier no longer exists');
            return { message: `${p.name} moved to the ${p.plan} plan.` };
        },
    },

    // ── Pricing control ──────────────────────────────────────────────────────
    // Only the platform-wide scalars are exposed. Per-vehicle fares, time-slot
    // multipliers and city overrides are nested structures where a partial write
    // from a model could silently wipe a section — those stay on the pricing screen.
    update_pricing: {
        permission: 'managePayments',
        tool: {
            type: 'function',
            function: {
                name: 'update_pricing',
                description: 'Change the platform-wide fare scalars: electricity cost, VAT %, commission %, or profit margin %. Affects EVERY fare quoted from that moment. Only pass the values being changed. Per-vehicle base fares, time slots and city overrides are not editable here.',
                parameters: {
                    type: 'object',
                    properties: {
                        electricityCost: { type: 'number', description: 'Cost per unit of electricity' },
                        vatPercent: { type: 'number' },
                        commissionPercent: { type: 'number', description: 'Platform cut taken from each fare' },
                        profitMarginPercent: { type: 'number' },
                    },
                },
            },
        },
        async propose(args) {
            const fields = ['electricityCost', 'vatPercent', 'commissionPercent', 'profitMarginPercent'];
            const pricing = await Pricing.findOne({ key: 'global' });
            if (!pricing) return fail('Pricing has not been configured yet — set it up on the pricing screen first.');
            const changes = {};
            for (const f of fields) {
                if (clean(args[f]) === undefined) continue;
                const v = parseFloat(args[f]);
                if (!Number.isFinite(v) || v < 0) return fail(`Invalid ${f} — must be a number of 0 or more.`);
                // Percentages above 100 are almost certainly a misread, and would
                // corrupt every fare on the platform. Refuse rather than guess.
                if (f.endsWith('Percent') && v > 100) return fail(`${f} of ${v}% is out of range (0–100).`);
                changes[f] = v;
            }
            if (!Object.keys(changes).length) return fail('Nothing to change — name at least one pricing value.');
            return {
                ok: true,
                label: 'Update platform pricing',
                summary: `Change ${Object.keys(changes).join(', ')}`,
                fields: [
                    ...Object.entries(changes).map(([k, v]) => ({ label: titleOf(k), value: `${pricing[k]} → ${v}` })),
                    { label: 'Effect', value: 'applies to every new fare quoted platform-wide' },
                ],
                payload: { changes },
            };
        },
        async execute(p, admin) {
            const pricing = await Pricing.findOne({ key: 'global' });
            if (!pricing) throw new Error('Pricing config no longer exists');
            Object.assign(pricing, p.changes, { updatedBy: admin._id });
            await pricing.save();
            return { message: `Pricing updated: ${Object.entries(p.changes).map(([k, v]) => `${titleOf(k)} = ${v}`).join(', ')}.` };
        },
    },

    // ── Map / geo settings ───────────────────────────────────────────────────
    // Superadmin-only, matching the REST route — and the API key is deliberately
    // not a parameter, so a secret can never be set or echoed through a chat.
    update_map_settings: {
        permission: 'superadmin',
        tool: {
            type: 'function',
            function: {
                name: 'update_map_settings',
                description: 'Switch the map/geo provider between google and osm, or change the restricted country code. The Google Maps API key cannot be set here — that has to be entered on the map settings screen.',
                parameters: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string', enum: ['google', 'osm'] },
                        countryCode: { type: 'string', description: 'ISO 3166-1 alpha-2, e.g. np' },
                    },
                },
            },
        },
        async propose({ provider, countryCode }) {
            const current = await MapSettings.findOne({ key: 'global' });
            const changes = {};
            if (clean(provider) !== undefined) {
                if (!['google', 'osm'].includes(provider)) return fail('Provider must be google or osm.');
                changes.provider = provider;
            }
            if (clean(countryCode) !== undefined) {
                const cc = String(countryCode).trim().toLowerCase();
                if (!/^[a-z]{2}$/.test(cc)) return fail('Country code must be two letters, e.g. np.');
                changes.countryCode = cc;
            }
            if (!Object.keys(changes).length) return fail('Nothing to change — name a provider or country code.');
            const hasKey = !!(current?.googleMapsApiKey || '').trim();
            return {
                ok: true,
                label: 'Update map settings',
                summary: `Change map ${Object.keys(changes).join(' and ')}`,
                fields: [
                    ...Object.entries(changes).map(([k, v]) => ({ label: titleOf(k), value: `${current?.[k] ?? '—'} → ${v}` })),
                    ...(changes.provider === 'google' && !hasKey
                        ? [{ label: 'Warning', value: 'no Google Maps key is configured, so the app will keep falling back to OSM' }]
                        : []),
                ],
                payload: { changes },
            };
        },
        async execute(p, admin) {
            let s = await MapSettings.findOne({ key: 'global' });
            if (!s) s = await MapSettings.create({ key: 'global' });
            Object.assign(s, p.changes, { updatedBy: admin._id });
            await s.save();
            return { message: `Map settings updated (${Object.keys(p.changes).join(', ')}).` };
        },
    },
};

// ── Permission gating ────────────────────────────────────────────────────────
// Superadmin passes everything; otherwise the action's declared permission must
// be set on the admin. Same rule as `can()` in admin.controller.js.
export function canRunAction(admin, name) {
    const action = ACTIONS[name];
    if (!action) return false;
    if (admin?.role === 'superadmin') return true;
    if (action.permission === 'superadmin') return false;
    if (!action.permission) return true;
    return admin?.permissions?.[action.permission] === true;
}

// Only the action tools this admin is actually allowed to run. Hiding the rest
// means the model never proposes something that would be refused on confirm.
export function actionToolsFor(admin) {
    return Object.entries(ACTIONS)
        .filter(([name]) => canRunAction(admin, name))
        .map(([, a]) => a.tool);
}

export const isActionTool = (name) => Object.prototype.hasOwnProperty.call(ACTIONS, name);

// Resolve + validate + preview. Never writes. Returns the confirm card the admin
// panel renders, plus the signed token that authorises the eventual execute.
export async function proposeAction(name, args = {}, admin) {
    const action = ACTIONS[name];
    if (!action) return { ok: false, error: `Unknown action: ${name}` };
    if (!canRunAction(admin, name)) return { ok: false, error: 'You do not have permission to do that.' };
    if (!SIGNING_SECRET) return { ok: false, error: 'Actions are unavailable: ADMIN_ACCESS_TOKEN_SECRET is not configured.' };

    let result;
    try {
        result = await action.propose(args || {});
    } catch (e) {
        return { ok: false, error: e.message };
    }
    if (!result?.ok) return { ok: false, error: result?.error || 'Could not prepare that action.' };

    return {
        ok: true,
        proposal: {
            action: name,
            label: result.label,
            summary: result.summary,
            fields: result.fields || [],
            token: signProposal({ name, payload: result.payload, adminId: admin._id }),
        },
    };
}

// Runs a confirmed proposal. Verifies the signature (which pins the action, its
// arguments, the admin and the expiry) and re-checks the permission, because the
// admin's rights may have changed between proposal and confirmation.
export async function executeConfirmedAction(token, admin) {
    const { name, payload, jti, expiresAt } = verifyProposal(token, admin?._id);
    if (!canRunAction(admin, name)) throw new Error('You do not have permission to do that.');
    if (jti) {
        if (isTokenUsed(jti)) throw new Error('This confirmation has already been used — ask Tempu Ai to prepare it again.');
        // Burn BEFORE running, not after: two clicks landing at once must not
        // both get through. The cost is that a genuinely failed execute can't be
        // retried on the same token — the boss re-asks, which is the safe way
        // round for anything that moves money.
        burnToken(jti, expiresAt);
    }
    const result = await ACTIONS[name].execute(payload, admin);
    return { action: name, message: result?.message || 'Done.' };
}
