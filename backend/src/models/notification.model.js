import mongoose from 'mongoose';
import { sendEmail } from '../config/sendEmail.js';
import { notificationEmailTemplate } from '../utils/notificationEmailTemplate.js';

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            default: null,
        },

        title: { type: String, required: true },
        body: { type: String, required: true },
        type: {
            type: String,
            enum: [
                'trip_request',
                'bid_received',
                'bid_accepted',
                'driver_arriving',
                'trip_started',
                'trip_completed',
                'trip_cancelled',
                'subscription_alert',
                'document_verified',
                'document_rejected',
                'account_approved',
                'account_suspended',
                'account_rejected',
                'payment',
                'general',
            ],
            required: true,
        },

        refId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        }, // tripId, bidId etc

        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1 });
notificationSchema.index({ driverId: 1 });
notificationSchema.index({ isRead: 1 });

// Email-on-notification
// Every newly created notification is also emailed to the recipient with a
// deep link back into the app. Best-effort path per notification type.
const LINK_PATH_BY_TYPE = {
    trip_request: 'trips',
    bid_received: 'trips',
    bid_accepted: 'trips',
    driver_arriving: 'trips',
    trip_started: 'trips',
    trip_completed: 'trips',
    trip_cancelled: 'trips',
    subscription_alert: 'subscriptions',
    document_verified: 'driver/documents',
    document_rejected: 'driver/documents',
    account_approved: 'profile',
    account_suspended: 'profile',
    account_rejected: 'profile',
    payment: 'wallet',
    general: '',
};

function buildLink(doc) {
    const base = process.env.CLIENT_URL || process.env.CORS_ORIGIN;
    if (!base) return null;
    const path = LINK_PATH_BY_TYPE[doc.type] ?? '';
    const trimmed = base.replace(/\/$/, '');
    if (!path) return trimmed;
    return doc.refId ? `${trimmed}/${path}/${doc.refId}` : `${trimmed}/${path}`;
}

async function resolveRecipient(doc) {
    if (doc.userId) {
        const user = await mongoose.model('User').findById(doc.userId).select('name email').lean();
        return user ? { name: user.name, email: user.email } : null;
    }
    if (doc.driverId) {
        const driver = await mongoose.model('Driver').findById(doc.driverId)
            .populate({ path: 'userId', select: 'name email' }).lean();
        return driver?.userId ? { name: driver.userId.name, email: driver.userId.email } : null;
    }
    return null;
}

async function emailNotification(doc) {
    const recipient = await resolveRecipient(doc);
    if (!recipient?.email) return;

    await sendEmail({
        sendTo: recipient.email,
        subject: doc.title,
        html: notificationEmailTemplate({
            name: recipient.name,
            title: doc.title,
            body: doc.body,
            link: buildLink(doc),
        }),
    });
}

notificationSchema.pre('save', function (next) {
    this._wasNew = this.isNew;
    next();
});

// Fire-and-forget: don't block the request that created the notification.
// Set `doc._skipEmail = true` before saving to suppress (e.g. when a richer
// dedicated email is sent separately).
notificationSchema.post('save', function (doc) {
    if (!doc._wasNew || doc._skipEmail) return;
    emailNotification(doc).catch((err) => console.error('Notification email error:', err?.message));
});

export const Notification = mongoose.model('Notification', notificationSchema);
