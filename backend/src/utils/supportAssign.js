import { SupportTicket } from '../models/supportTicket.model.js';
import { Admin } from '../models/admin.model.js';
import { AdminNotification } from '../models/adminNotification.model.js';
import { SupportSettings, getSupportSettings } from '../models/supportSettings.model.js';

// Round-robin auto-assignment with per-agent capacity and an overflow queue.
//
// A ticket is handed to the next agent in rotation who has fewer than
// `agentCapacity` ACTIVE tickets (status open/in_progress). If every agent is
// at capacity, the ticket stays unassigned (assignedTo: null) — that's the
// "queue" — and gets picked up by processQueue() when an agent frees a slot
// (a ticket they own is resolved/closed).
//
// The rotation pointer (settings.lastAssignedAgent) makes distribution even
// ("half-half") rather than always favouring the first agent.

const ACTIVE = ['open', 'in_progress'];

// Support agents = active admins with the handleSupport permission, in a stable
// order so the round-robin rotation is deterministic.
async function getAgents() {
    return Admin.find({ isActive: { $ne: false }, 'permissions.handleSupport': true })
        .select('_id name email')
        .sort({ _id: 1 })
        .lean();
}

// Map of agentId -> current active ticket count, for capacity checks.
async function activeCounts() {
    const rows = await SupportTicket.aggregate([
        { $match: { assignedTo: { $ne: null }, status: { $in: ACTIVE } } },
        { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
    ]);
    const map = new Map();
    rows.forEach((r) => map.set(String(r._id), r.n));
    return map;
}

// Pick the next under-capacity agent starting AFTER lastAssignedAgent, wrapping
// around. Returns the agent doc or null when everyone is at capacity.
function pickNext(agents, counts, capacity, lastAssignedId) {
    if (!agents.length) return null;
    let start = 0;
    if (lastAssignedId) {
        const idx = agents.findIndex((a) => String(a._id) === String(lastAssignedId));
        if (idx >= 0) start = idx + 1; // begin at the one after the last assignee
    }
    for (let i = 0; i < agents.length; i++) {
        const agent = agents[(start + i) % agents.length];
        if ((counts.get(String(agent._id)) || 0) < capacity) return agent;
    }
    return null;
}

async function notifyAssignee(agent, ticket) {
    const ref = String(ticket._id).slice(-8).toUpperCase();
    await AdminNotification.create({
        adminId: agent._id,
        title: 'New ticket assigned to you',
        body: `Ticket #${ref} — "${ticket.subject}" was auto-assigned to you.`,
        type: 'ticket_assigned',
        link: `/support/${ticket._id}`,
        refId: ticket._id,
    }).catch((e) => console.error('[supportAssign] notify failed:', e.message));
}

// Try to auto-assign a single unassigned ticket. Returns the assigned agent doc
// or null (queued). Best-effort: never throws to a caller.
export async function autoAssignTicket(ticketId) {
    try {
        const settings = await getSupportSettings();
        if (!settings.autoAssign) return null;

        const ticket = await SupportTicket.findById(ticketId).select('_id assignedTo status subject');
        if (!ticket || ticket.assignedTo || !ACTIVE.includes(ticket.status)) return null;

        const agents = await getAgents();
        const counts = await activeCounts();
        const agent = pickNext(agents, counts, settings.agentCapacity, settings.lastAssignedAgent);
        if (!agent) return null; // all at capacity → stays queued

        // Atomic claim: only assign while still unassigned, so this can't clobber
        // a concurrent AI-greeting save on the same document (or another caller
        // racing to assign the same ticket).
        const upd = await SupportTicket.updateOne(
            { _id: ticketId, assignedTo: null },
            { assignedTo: agent._id },
        );
        if (!upd.modifiedCount) return null; // something else assigned it first

        // Advance the rotation pointer.
        await SupportSettings.updateOne({ key: 'global' }, { lastAssignedAgent: agent._id });

        await notifyAssignee(agent, ticket);
        return agent;
    } catch (e) {
        console.error('[supportAssign] autoAssign failed:', e.message);
        return null;
    }
}

// Drain the queue: assign waiting (unassigned, active) tickets oldest-first to
// under-capacity agents until capacity runs out. Call after a ticket frees a
// slot (resolved/closed). Returns the number newly assigned.
export async function processQueue() {
    try {
        const settings = await getSupportSettings();
        if (!settings.autoAssign) return 0;

        const agents = await getAgents();
        if (!agents.length) return 0;

        const counts = await activeCounts();
        const totalCapacity = agents.length * settings.agentCapacity;
        const used = [...counts.values()].reduce((a, b) => a + b, 0);
        if (used >= totalCapacity) return 0; // nothing free

        const queued = await SupportTicket.find({ assignedTo: null, status: { $in: ACTIVE } })
            .sort({ createdAt: 1 })
            .select('_id subject');

        let pointer = settings.lastAssignedAgent;
        let assigned = 0;
        for (const t of queued) {
            const agent = pickNext(agents, counts, settings.agentCapacity, pointer);
            if (!agent) break; // everyone full
            const ticket = await SupportTicket.findById(t._id);
            if (!ticket || ticket.assignedTo) continue;
            ticket.assignedTo = agent._id;
            await ticket.save();
            counts.set(String(agent._id), (counts.get(String(agent._id)) || 0) + 1);
            pointer = agent._id;
            await notifyAssignee(agent, ticket);
            assigned++;
        }
        if (assigned) await SupportSettings.updateOne({ key: 'global' }, { lastAssignedAgent: pointer });
        return assigned;
    } catch (e) {
        console.error('[supportAssign] processQueue failed:', e.message);
        return 0;
    }
}
