import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Subscriptions are parent/kid plans only.
        plan: {
            type: String,
            enum: ['parent'],
            default: 'parent',
        },

        childName: {
            type: String,
            default: null,
        },
        childPhoto: {
            type: String,
            default: null,
        },
        childAge: {
            type: Number,
            default: null,
        },
        schoolName: {
            type: String,
            default: null,
        },

        pickup: {
            address: {
                type: String,
                required: true,
            },
            location: {
                type: {
                    type: String,
                    enum: ['Point'],
                    default: 'Point',
                },
                coordinates: {
                    type: [Number],
                    required: true,
                },
            },
        },
        dropoff: {
            address: {
                type: String,
                required: true,
            },
            location: {
                type: {
                    type: String,
                    enum: ['Point'],
                    default: 'Point',
                },
                coordinates: {
                    type: [Number],
                    required: true,
                },
            },
        },
        pickupTime: {
            type: String,
            default: null,
        }, // "07:00"
        dropoffTime: {
            type: String,
            default: null,
        }, // "13:00"

        primaryDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            default: null,
        },
        backupDrivers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Driver',
            },
        ],

        monthlyPrice: {
            type: Number,
            required: true,
        },
        missedDays: {
            type: [Date],
            default: [],
        }, // for billing deduction

        status: {
            type: String,
            enum: ['active', 'paused', 'cancelled', 'expired'],
            default: 'active',
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },

        vehicleType: {
            type: String,
            enum: ['tuktuk', 'tuktuk_delivery', 'scooter', 'bike', 'taxi', 'comfort'],
            required: true,
        },
    },
    { timestamps: true }
);

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ primaryDriver: 1 });
subscriptionSchema.index({ 'pickup.location': '2dsphere' });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
