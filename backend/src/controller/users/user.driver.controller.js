import { User } from '../../models/user.model.js';
import { Driver } from '../../models/driver.model.js';
import { Subscription } from '../../models/subscription.model.js';
import { Document } from '../../models/doeument.model.js';
import { Trip } from '../../models/trip.model.js';
import { Withdrawal } from '../../models/withdrawal.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../../utils/cloudinary.js';
import { sendEmail } from '../../config/sendEmail.js';
import { currentDispatchRadius, maxDispatchRadius, compatibleTypes } from '../../config/dispatch.js';
import { welcomeDriverTemplate } from '../../utils/welcomeEmailTemplate.js';


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
    // Is this driver also serving a subscription (primary or backup on an
    // active/paused parent plan)? Used to show the subscription illustration too.
    const subscriptionDriver = !!(await Subscription.exists({
        status: { $in: ['active', 'paused'] },
        $or: [{ primaryDriver: driver._id }, { backupDrivers: driver._id }],
    }));
    return res.status(200).json(new apiResponse(200, { driver, documents, subscriptionDriver }, 'Driver profile fetched'));
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
    const { longitude, latitude } = req.query;
    if (!longitude || !latitude) throw new apiError(400, 'Longitude and latitude are required');

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');
    if (driver.status !== 'approved') throw new apiError(403, 'Driver account not approved');
    if (!driver.isOnline) throw new apiError(400, 'You must be online to see nearby trips');
    // A driver already on a ride is not offered new requests.
    if (driver.isOnRide) {
        return res.status(200).json(new apiResponse(200, [], 'You are on a ride'));
    }

    const serves = compatibleTypes(driver.vehicleType);

    // Upper bound for the candidate search = the widest final ring across the
    // request types this driver can serve. Per-trip, time-tiered filtering
    // below narrows it to whichever ring each trip has reached for its age.
    const searchRadius = Math.max(...serves.map(maxDispatchRadius));
    const driverCoords = [parseFloat(longitude), parseFloat(latitude)];

    // $geoNear must name the index because the trips collection has two 2dsphere
    // indexes (pickup.location + dropoff.location); distanceField gives us the
    // metres to each pickup so we can apply the per-trip ring below.
    const candidates = await Trip.aggregate([
        {
            $geoNear: {
                near: { type: 'Point', coordinates: driverCoords },
                key: 'pickup.location',
                distanceField: 'distanceMeters',
                maxDistance: searchRadius,
                spherical: true,
                query: { status: 'pending', vehicleType: { $in: serves } },
            },
        },
        { $limit: 40 },
    ]);

    // A trip is only offered to this driver if they're inside the ring the trip
    // has widened to for its current age (100 m → 500 m → 1 km for scooter,
    // etc.). currentDispatchRadius returns null once past the last tier, so an
    // expired ("no driver found") trip is dropped here too.
    const now = Date.now();
    const visible = candidates
        .filter((t) => {
            const radius = currentDispatchRadius(t.vehicleType, t.createdAt, now);
            return radius !== null && t.distanceMeters <= radius;
        })
        .slice(0, 20);

    // Aggregation returns plain docs — populate the rider fields the app needs.
    const trips = await Trip.populate(visible, { path: 'userId', select: 'name rating avatarUrl' });

    return res.status(200).json(new apiResponse(200, trips, 'Nearby trips fetched'));
});

const getMyEarnings = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id }).select('earnings walletBalance topupBalance totalRides rating totalRatings cancelledRides');
    if (!driver) throw new apiError(404, 'Driver profile not found');
    return res.status(200).json(new apiResponse(200, driver, 'Earnings fetched'));
});

// Earnings breakdown for the driver app: today / this-week / this-month totals
// plus a per-day series for a chart. Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD to
// filter the chart range (defaults to the last 7 days). All day bucketing is in
// Nepal time (UTC+5:45).
const NEPAL_TZ = 'Asia/Kathmandu';
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// UTC instant of Nepal-local midnight for the day containing `d`.
function nepalStartOfDay(d) {
    const wall = new Date(d.getTime() + NEPAL_OFFSET_MS);
    wall.setUTCHours(0, 0, 0, 0);
    return new Date(wall.getTime() - NEPAL_OFFSET_MS);
}

const getEarningsBreakdown = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id }).select('_id');
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const now = new Date();
    const startToday = nepalStartOfDay(now);
    // Start of the current week (Monday) in Nepal time.
    const wallNow = new Date(now.getTime() + NEPAL_OFFSET_MS);
    const daysSinceMon = (wallNow.getUTCDay() + 6) % 7;
    const startWeek = new Date(startToday.getTime() - daysSinceMon * 86400000);
    // Start of the current month in Nepal time.
    const wallMonth = new Date(now.getTime() + NEPAL_OFFSET_MS);
    wallMonth.setUTCDate(1); wallMonth.setUTCHours(0, 0, 0, 0);
    const startMonth = new Date(wallMonth.getTime() - NEPAL_OFFSET_MS);

    const base = { driverId: driver._id, type: 'trip_earning', status: 'completed' };

    // Totals (single pass since the earliest of the three boundaries).
    const earliest = new Date(Math.min(startToday.getTime(), startWeek.getTime(), startMonth.getTime()));
    const [totalsAgg] = await Transaction.aggregate([
        { $match: { ...base, createdAt: { $gte: earliest } } },
        {
            $group: {
                _id: null,
                today: { $sum: { $cond: [{ $gte: ['$createdAt', startToday] }, '$amount', 0] } },
                week: { $sum: { $cond: [{ $gte: ['$createdAt', startWeek] }, '$amount', 0] } },
                month: { $sum: { $cond: [{ $gte: ['$createdAt', startMonth] }, '$amount', 0] } },
            },
        },
    ]);
    const totals = {
        today: totalsAgg?.today || 0,
        week: totalsAgg?.week || 0,
        month: totalsAgg?.month || 0,
    };

    // Chart range: ?from/?to, else the last 7 days.
    const from = req.query.from ? nepalStartOfDay(new Date(req.query.from)) : nepalStartOfDay(new Date(now.getTime() - 6 * 86400000));
    const toDayStart = req.query.to ? nepalStartOfDay(new Date(req.query.to)) : startToday;
    const to = new Date(toDayStart.getTime() + 86400000 - 1); // end of the 'to' day

    const rows = await Transaction.aggregate([
        { $match: { ...base, createdAt: { $gte: from, $lte: to } } },
        {
            $group: {
                _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: NEPAL_TZ } },
                amount: { $sum: '$amount' },
                rides: { $sum: 1 },
            },
        },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r]));

    // Fill every day in the range so the chart has one bar per day (capped at 92).
    const series = [];
    const maxDays = 92;
    for (let t = from.getTime(), i = 0; t <= to.getTime() && i < maxDays; t += 86400000, i++) {
        const key = new Date(t + NEPAL_OFFSET_MS).toISOString().slice(0, 10);
        const hit = byDay.get(key);
        series.push({ date: key, amount: hit?.amount || 0, rides: hit?.rides || 0 });
    }

    return res.status(200).json(
        new apiResponse(200, {
            totals,
            series,
            range: { from: from.toISOString(), to: to.toISOString() },
        }, 'Earnings breakdown')
    );
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
    requestWithdrawal, getMyWithdrawals, topUpDriverBalance, getEarningsBreakdown,
};
