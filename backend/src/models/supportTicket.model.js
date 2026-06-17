import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
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

        subject: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            enum: [
                'trip_issue',
                'payment_issue',
                'driver_complaint',
                'rider_complaint',
                'document_issue',
                'subscription_issue',
                'account_issue',
                'other',
            ],
            required: true,
        },

        messages: [
            {
                senderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                },
                senderType: {
                    type: String,
                    enum: ['user', 'driver', 'admin'],
                    required: true,
                },
                // Optional once an attachment is present (a voice note or file
                // can stand on its own). Controllers require message OR attachment.
                message: {
                    type: String,
                    default: '',
                },
                // Voice note or document attachment (Cloudinary).
                attachmentUrl: { type: String, default: null },
                attachmentType: {
                    type: String,
                    enum: ['audio', 'file', null],
                    default: null,
                },
                attachmentName: { type: String, default: null }, // original filename for files
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            default: null,
        },

        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            default: 'open',
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },

        // Internal collaboration notes between admins/support agents. NOT shown
        // to the user/driver — distinct from `messages` (the customer thread).
        comments: [
            {
                authorId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Admin',
                    required: true,
                },
                body: {
                    type: String,
                    required: true,
                },
                mentions: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'Admin',
                    },
                ],
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

supportTicketSchema.index({ userId: 1 });
supportTicketSchema.index({ driverId: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ assignedTo: 1 });

export const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
