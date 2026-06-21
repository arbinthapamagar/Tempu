import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema(
    {
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null,
        },

        callerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        callerType: {
            type: String,
            enum: ['rider', 'driver'],
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        status: {
            type: String,
            enum: ['connected', 'missed', 'declined'],
            required: true,
        },
        duration: { type: Number, default: 0 }, // in seconds

        // Auto delete after 7 days
        expireAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    },
    { timestamps: true }
);

callLogSchema.index({ tripId: 1 });
callLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const CallLog = mongoose.model('CallLog', callLogSchema);
