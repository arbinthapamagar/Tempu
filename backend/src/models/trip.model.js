import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            default: null,
        },

        vehicleType: {
            type: String,
            enum: ['tuktuk', 'tuktuk_delivery', 'scooter', 'bike', 'taxi', 'comfort'],
            required: true,
        },
        tripType: {
            type: String,
            enum: ['regular', 'subscription'],
            default: 'regular',
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
                }, // [lng, lat]
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

        offeredPrice: {
            type: Number,
            required: true,
        }, // rider offered
        finalPrice: {
            type: Number,
            default: null,
        }, // accepted bid price
        distance: {
            type: Number,
            default: null,
        }, // in km
        duration: {
            type: Number,
            default: null,
        }, // in minutes

        status: {
            type: String,
            enum: [
                'pending', // rider posted, waiting for bids
                'accepted', // rider accepted a bid
                'arriving', // driver heading to pickup
                'started', // trip in progress
                'completed', // trip done
                'cancelled', // cancelled by rider/driver/system
            ],
            default: 'pending',
        },

        cancelledBy: {
            type: String,
            enum: ['rider', 'driver', 'system'],
            default: null,
        },
        cancelReason: {
            type: String,
            default: null,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },

        paymentMethod: {
            type: String,
            enum: ['cash', 'khalti', 'esewa', 'wallet'],
            default: 'cash',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },
        platformFee: { type: Number, default: null }, // your 4-5%

        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null,
        },

        acceptedAt: {
            type: Date,
            default: null,
        },
        startedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },

        isRatedByRider: {
            type: Boolean,
            default: false,
        },
        isRatedByDriver: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Indexes
tripSchema.index({ userId: 1 });
tripSchema.index({ driverId: 1 });
tripSchema.index({ status: 1 });
tripSchema.index({ vehicleType: 1 });
tripSchema.index({ 'pickup.location': '2dsphere' });
tripSchema.index({ 'dropoff.location': '2dsphere' });

export const Trip = mongoose.model('Trip', tripSchema);
