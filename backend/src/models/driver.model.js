import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },

        vehicleType: {
            type: String,
            enum: ['bike', 'scooter', 'tuktuk', 'tuktuk_delivery', 'taxi', 'comfort'],
            required: true,
        },

        // City the driver operates in - used to classify drivers and apply that
        // city's pricing. Matches a city name in the pricing config.
        city: {
            type: String,
            default: null,
        },
        vehiclePlate: {
            type: String,
            required: true,
            unique: true,
        },
        vehicleModel: { type: String, default: null },
        vehicleColor: { type: String, default: null },
        vehicleYear: { type: Number, default: null },

        licenseNumber: {
            type: String,
            required: true,
            unique: true,
        },
        licenseExpiry: {
            type: Date,
            required: true,
        },

        status: {
            type: String,
            enum: ['pending', 'approved', 'suspended', 'rejected'],
            default: 'pending',
        },
        isVerified: { type: Boolean, default: false },

        isOnline: { type: Boolean, default: false },
        isOnRide: { type: Boolean, default: false },

        currentLocation: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                default: [0, 0],
            },
        },

        rating: { type: Number, default: 0 },
        totalRatings: { type: Number, default: 0 },
        totalRides: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },        // lifetime gross earnings (never decreases)
        walletBalance: { type: Number, default: 0 },   // withdrawable balance (earnings + admin credits − cashouts)
        // Prepaid balance the flat per-ride platform fee is deducted from. The
        // driver tops this up (eSewa/Khalti/bank); each completed ride debits the
        // ride fee here. Kept separate from walletBalance (earnings) on purpose.
        topupBalance: { type: Number, default: 0 },
        cancelledRides: { type: Number, default: 0 },

        lastActiveAt: { type: Date, default: null },
        vehicleCapacity: { type: Number, default: 4 },
        isAvailable: { type: Boolean, default: true },

        poolAssignments: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Subscription',
            },
        ],

        documents: {
            licenseImage: { type: String, default: null },
            citizenshipImage: { type: String, default: null },
            vehicleImage: { type: String, default: null },
            insuranceImage: { type: String, default: null },
            bluebook: { type: String, default: null },
            policeReport: { type: String, default: null },
        },

    },
    { timestamps: true }
);

driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ isOnline: 1, status: 1 });
driverSchema.index({ isAvailable: 1 });

export const Driver = mongoose.model('Driver', driverSchema);
