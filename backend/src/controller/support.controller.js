import { Admin } from '../models/admin.model.js';
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

export { contactSupport };
