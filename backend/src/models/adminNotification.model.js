import mongoose from 'mongoose';

// In-app notifications for admins/moderators (e.g. "a ticket was assigned to you").
// Separate from the user/driver Notification model.
const adminNotificationSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    type: { type: String, default: 'general' }, // 'ticket_assigned' | 'general'
    link: { type: String, default: null },        // e.g. /support/<id>
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

adminNotificationSchema.index({ adminId: 1, isRead: 1 });

export const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);
