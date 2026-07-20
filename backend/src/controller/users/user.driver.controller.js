import { User } from '../../models/user.model.js';
import { Driver } from '../../models/driver.model.js';
import { Document } from '../../models/doeument.model.js';
import { Trip } from '../../models/trip.model.js';
import { Withdrawal } from '../../models/withdrawal.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';
import { sendEmail } from '../../config/sendEmail.js';
import { welcomeDriverTemplate } from '../../utils/welcomeEmailTemplate.js';

const COMPATIBLE_VEHICLE_TYPES = {
    bike: ['bike', 'scooter'],
    scooter: ['scooter', 'bike'],
    tuktuk: ['tuktuk', 'tuktuk_delivery'],
    tuktuk_delivery: ['tuktuk_delivery', 'tuktuk'],
    taxi: ['taxi'],
    comfort: ['comfort'],
};

const registerAsDriver = asyncHandler(async (req, res) => {
    const existing = await Driver.findOne({ userId: req.user._id });
    if (existing) throw new apiError(400, 'Already registered as a driver');

    const { vehicleType, vehiclePlate, vehicleModel, vehicleColor, vehicleYear, licenseNumber, licenseExpiry } = req.body;
    if (!vehicleType || !vehiclePlate || !licenseNumber || !licenseExpiry) {
        throw new apiError(400, 'vehicleType, vehiclePlate, licenseNumber, and licenseExpiry are required');
    }

    const plateExists = await Driver.findOne({ vehiclePlate: vehiclePlate.trim().toUpperCase() });
    if (plateExists) throw new apiError(409, 'Vehicle plate already registered');

    const licenseExists = await Driver.findOne({ licenseNumber: licenseNumber.trim() });
    if (licenseExists) throw new apiError(409, 'License number already registered');

    const driver = await Driver.create({
        userId: req.user._id,
        vehicleType,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleModel: vehicleModel || null,
        vehicleColor: vehicleColor || null,
        vehicleYear: vehicleYear ? parseInt(vehicleYear) : null,
        licenseNumber: licenseNumber.trim(),
        licenseExpiry: new Date(licenseExpiry),
    });

    await User.findByIdAndUpdate(req.user._id, { driverProfile: driver._id, role: 'driver' });

    // Driver application received - send a driver welcome email (best effort).
    if (req.user.email) {
        await sendEmail({
            sendTo: req.user.email,
            subject: 'Your Tempu driver application 🛺',
            html: welcomeDriverTemplate({ name: req.user.name }),
        });
    }

    return res.status(201).json(new apiResponse(201, driver, 'Driver registered. Pending admin approval.'));
});

const getMyDriverProfile = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const documents = await Document.find({ driverId: driver._id }).sort({ type: 1 });
    return res.status(200).json(new apiResponse(200, { driver, documents }, 'Driver profile fetched'));
});

const updateDriverProfile = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const { vehicleModel, vehicleColor, vehicleYear, vehicleCapacity } = req.body;
    const updates = {};
    if (vehicleModel) updates.vehicleModel = vehicleModel;
    if (vehicleColor) updates.vehicleColor = vehicleColor;
    if (vehicleYear) updates.vehicleYear = parseInt(vehicleYear);
    if (vehicleCapacity) updates.vehicleCapacity = parseInt(vehicleCapacity);

    const updated = await Driver.findByIdAndUpdate(driver._id, updates, { new: true });
    return res.status(200).json(new apiResponse(200, updated, 'Driver profile updated'));
});

const uploadDriverDocument = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found. Register as driver first.');

    const { type } = req.body;
    const localFilePath = req.file?.path;
    if (!type) throw new apiError(400, 'Document type is required');
    if (!localFilePath) throw new apiError(400, 'Document file is required');

    const validTypes = ['citizenship', 'driving_license', 'police_clearance', 'vehicle_registration', 'vehicle_plate_back', 'insurance', 'bluebook', 'profile_photo', 'vehicle_photo'];
    if (!validTypes.includes(type)) throw new apiError(400, `Document type must be one of: ${validTypes.join(', ')}`);

    const result = await uploadOnCloudinary(localFilePath);
    if (!result?.secure_url) throw new apiError(500, 'Failed to upload document');

    const document = await Document.findOneAndUpdate(
        { driverId: driver._id, type },
        {
            fileUrl: result.secure_url,
            status: 'pending',
            rejectionReason: null,
            verifiedBy: null,
            verifiedAt: null,
        },
        { upsert: true, new: true }
    );

    return res.status(201).json(new apiResponse(201, document, 'Document uploaded. Pending review.'));
});

const goOnline = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');
    if (driver.status !== 'approved') throw new apiError(403, `Driver account is ${driver.status}`);

    driver.isOnline = true;
    driver.lastActiveAt = new Date();
    await driver.save();
    return res.status(200).json(new apiResponse(200, { isOnline: true }, 'You are now online'));
});

const goOffline = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');
    if (driver.isOnRide) throw new apiError(400, 'Cannot go offline while on a ride');

    driver.isOnline = false;
    driver.lastActiveAt = new Date();
    await driver.save();
    return res.status(200).json(new apiResponse(200, { isOnline: false }, 'You are now offline'));
});

const updateDriverLocation = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.body;
    if (longitude === undefined || latitude === undefined) {
        throw new apiError(400, 'Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    if (isNaN(lng) || isNaN(lat)) throw new apiError(400, 'Invalid coordinates');
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) throw new apiError(400, 'Coordinates out of range');

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    driver.currentLocation = { type: 'Point', coordinates: [lng, lat] };
    driver.lastActiveAt = new Date();
    await driver.save();
    return res.status(200).json(new apiResponse(200, {}, 'Location updated'));
});

const getNearbyTrips = asyncHandler(async (req, res) => {
    const { longitude, latitude, maxDistance = 5000 } = req.query;
    if (!longitude || !latitude) throw new apiError(400, 'Longitude and latitude are required');

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');
    if (driver.status !== 'approved') throw new apiError(403, 'Driver account not approved');
    if (!driver.isOnline) throw new apiError(400, 'You must be online to see nearby trips');

    const compatibleTypes = COMPATIBLE_VEHICLE_TYPES[driver.vehicleType] || [driver.vehicleType];
    const dist = Math.min(parseInt(maxDistance) || 5000, 50000);

    const trips = await Trip.find({
        status: 'pending',
        vehicleType: { $in: compatibleTypes },
        'pickup.location': {
            $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                $maxDistance: dist,
            },
        },
    })
    .limit(20)
    .populate('userId', 'name rating avatarUrl');

    return res.status(200).json(new apiResponse(200, trips, 'Nearby trips fetched'));
});

const getMyEarnings = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id }).select('earnings walletBalance topupBalance totalRides rating totalRatings cancelledRides');
    if (!driver) throw new apiError(404, 'Driver profile not found');
    return res.status(200).json(new apiResponse(200, driver, 'Earnings fetched'));
});

// Top up the prepaid fee balance the per-ride platform fee is deducted from.
// Standby payment: no real gateway yet — the amount is recorded and credited
// immediately. Swap for a verified gateway callback when integrating eSewa/
// Khalti/bank for real.
const topUpDriverBalance = asyncHandler(async (req, res) => {
    const { amount, method } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) throw new apiError(400, 'Valid amount is required');
    if (parsedAmount > 100000) throw new apiError(400, 'Maximum top-up amount is NPR 100,000');
    if (!['khalti', 'esewa', 'bank'].includes(method)) {
        throw new apiError(400, 'Payment method must be khalti, esewa or bank');
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const transaction = await Transaction.create({
        driverId: driver._id,
        amount: parsedAmount,
        type: 'wallet_topup',
        method,
        status: 'completed',
        gatewayRef: `STANDBY_${Date.now()}`,
        note: 'Driver fee-balance top-up (standby payment)',
    });

    const updated = await Driver.findByIdAndUpdate(
        driver._id,
        { $inc: { topupBalance: parsedAmount } },
        { new: true }
    ).select('topupBalance');

    return res.status(201).json(
        new apiResponse(201, { transaction, topupBalance: updated.topupBalance }, 'Top-up successful')
    );
});

const MIN_WITHDRAWAL = 100;

const requestWithdrawal = asyncHandler(async (req, res) => {
    const { amount, method, destination = {}, note } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) throw new apiError(400, 'Valid amount is required');
    if (parsedAmount < MIN_WITHDRAWAL) throw new apiError(400, `Minimum withdrawal is NPR ${MIN_WITHDRAWAL}`);

    if (!['bank', 'khalti', 'esewa'].includes(method)) {
        throw new apiError(400, 'Method must be bank, khalti or esewa');
    }

    // Validate destination details per method
    if (method === 'bank') {
        if (!destination.bankName || !destination.accountName || !destination.accountNumber) {
            throw new apiError(400, 'Bank name, account name and account number are required');
        }
    } else if (!destination.walletId) {
        throw new apiError(400, `Your ${method} ID / phone number is required`);
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    // Atomically hold the funds so a driver can't request more than they have.
    const held = await Driver.findOneAndUpdate(
        { _id: driver._id, walletBalance: { $gte: parsedAmount } },
        { $inc: { walletBalance: -parsedAmount } },
        { new: true }
    );
    if (!held) throw new apiError(400, 'Insufficient wallet balance');

    const withdrawal = await Withdrawal.create({
        driverId: driver._id,
        amount: parsedAmount,
        method,
        destination: {
            bankName: destination.bankName || null,
            accountName: destination.accountName || null,
            accountNumber: destination.accountNumber || null,
            walletId: destination.walletId || null,
        },
        note: note?.trim() || null,
        status: 'pending',
    });

    return res.status(201).json(
        new apiResponse(201, { withdrawal, walletBalance: held.walletBalance }, 'Withdrawal requested')
    );
});

const getMyWithdrawals = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id }).select('_id');
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const withdrawals = await Withdrawal.find({ driverId: driver._id })
        .sort({ createdAt: -1 })
        .limit(50);

    return res.status(200).json(new apiResponse(200, withdrawals, 'Withdrawals fetched'));
});

export {
    registerAsDriver, getMyDriverProfile, updateDriverProfile, uploadDriverDocument,
    goOnline, goOffline, updateDriverLocation, getNearbyTrips, getMyEarnings,
    requestWithdrawal, getMyWithdrawals, topUpDriverBalance,
};
