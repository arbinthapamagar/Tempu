import crypto from 'crypto';
import { Admin } from '../models/admin.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { sendEmail } from '../config/sendEmail.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Public (no-auth) contact form for people who haven't signed up yet — they can
// reach the team and we follow up over email. Mounted at POST /api/v1/support/contact.
const contactSupport = asyncHandler(async (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const message = (req.body.message || '').trim();

    if (!email || !EMAIL_RE.test(email)) throw new apiError(400, 'A valid email is required');
    if (!message) throw new apiError(400, 'Please tell us how we can help');

    // Route it to the configured support inbox, else the super admin's email.
    let inbox = process.env.SUPPORT_EMAIL;
    if (!inbox) {
        const admin = await Admin.findOne({ role: 'superadmin' }).select('email');
        inbox = admin?.email || null;
    }

    if (inbox) {
        await sendEmail({
            sendTo: inbox,
            subject: `New enquiry from ${name || email}`,
            html: `
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
                <h2 style="margin:0 0 12px">New pre-login support enquiry</h2>
                <p style="margin:0 0 4px"><strong>Name:</strong> ${escapeHtml(name) || '—'}</p>
                <p style="margin:0 0 4px"><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p style="margin:12px 0 4px"><strong>Message:</strong></p>
                <p style="white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:12px;margin:0">${escapeHtml(message)}</p>
                <p style="color:#888;margin-top:16px">Reply directly to <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>.</p>
              </div>`,
        });
    } else {
        console.warn('contactSupport: no SUPPORT_EMAIL and no super admin email — enquiry not delivered.');
    }

    return res.status(200).json(
        new apiResponse(200, { received: true }, 'Thanks for reaching out — our team will email you shortly.')
    );
});

// ── Guest live chat (pre-login) ──────────────────────────────────────────────
// A person without an account can open a support thread and chat with the team
// in real time. The thread is gated by a random token (returned on creation)
// instead of a JWT. Admins see and reply to these exactly like normal tickets.

// Shape returned to the guest — never leak internal admin comments/assignment.
const publicTicket = (t) => ({
    _id: t._id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    guest: { name: t.guest?.name || null, email: t.guest?.email || null },
    messages: (t.messages || []).map((m) => ({
        senderType: m.senderType,
        message: m.message,
        attachmentUrl: m.attachmentUrl,
        attachmentType: m.attachmentType,
        attachmentName: m.attachmentName,
        createdAt: m.createdAt,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
});

// POST /api/v1/support/ticket — open a guest chat thread.
const createGuestTicket = asyncHandler(async (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const message = (req.body.message || '').trim();
    const subject = (req.body.subject || '').trim() || 'Support enquiry';

    if (!email || !EMAIL_RE.test(email)) throw new apiError(400, 'A valid email is required');
    if (!message) throw new apiError(400, 'Please tell us how we can help');

    const guestToken = crypto.randomBytes(24).toString('hex');

    const ticket = await SupportTicket.create({
        userId: null,
        subject,
        category: 'other',
        guest: { name: name || null, email },
        guestToken,
        status: 'open',
        messages: [{ senderId: null, senderType: 'guest', message }],
    });

    return res.status(201).json(
        new apiResponse(201, { token: guestToken, ticket: publicTicket(ticket) }, 'Support chat started')
    );
});

// Resolve a guest ticket from its id + token (token may be in query or body).
async function findGuestTicket(req) {
    const token = (req.query.token || req.body.token || '').trim();
    if (!token) throw new apiError(401, 'Missing chat token');
    const ticket = await SupportTicket.findOne({ _id: req.params.id, guestToken: token });
    if (!ticket) throw new apiError(404, 'Chat not found');
    return ticket;
}

// GET /api/v1/support/ticket/:id?token=… — fetch the guest thread (for polling).
const getGuestTicket = asyncHandler(async (req, res) => {
    const ticket = await findGuestTicket(req);
    return res.status(200).json(new apiResponse(200, publicTicket(ticket), 'Chat fetched'));
});

// POST /api/v1/support/ticket/:id/messages — guest sends a reply.
const addGuestMessage = asyncHandler(async (req, res) => {
    const message = (req.body.message || '').trim();
    if (!message) throw new apiError(400, 'A message is required');

    const ticket = await findGuestTicket(req);
    ticket.messages.push({ senderId: null, senderType: 'guest', message });
    // A reply on a resolved/closed thread reopens it, mirroring the in-app flow.
    if (['resolved', 'closed'].includes(ticket.status)) {
        ticket.status = 'open';
        ticket.resolvedAt = null;
    }
    await ticket.save();

    return res.status(200).json(new apiResponse(200, publicTicket(ticket), 'Message sent'));
});

export { contactSupport, createGuestTicket, getGuestTicket, addGuestMessage };
