import { Bid } from '../models/bid.model.js';
import { Trip } from '../models/trip.model.js';
import { Driver } from '../models/driver.model.js';
import { Notification } from '../models/notification.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { compatibleTypes, isDispatchExpired, isWithinCurrentRing } from '../config/dispatch.js';

const createBid = asyncHandler(async (req, res) => {
    const { tripId, amount, message } = req.body;
    if (!tripId || !amount) throw new apiError(400, 'Trip ID and amount are required');

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');
    if (driver.status !== 'approved') throw new apiError(403, 'Driver account not approved');
    if (!driver.isOnline) throw new apiError(400, 'You must be online to place bids');

    const trip = await Trip.findById(tripId);
    if (!trip) throw new apiError(404, 'Trip not found');
    if (trip.status !== 'pending') throw new apiError(400, 'Trip is no longer accepting bids');

    // Prevent driver from bidding on their own trip
    if (trip.userId.toString() === req.user._id.toString()) {
        throw new apiError(400, 'Cannot bid on your own trip');
    }

    // Check vehicle type compatibility
    const compatibleTrips = compatibleTypes(driver.vehicleType);
    if (!compatibleTrips.includes(trip.vehicleType)) {
        throw new apiError(400, 'Your vehicle type is not compatible with this trip');
    }

    // Enforce the time-tiered dispatch ring server-side: a driver may bid only
    // while the trip's current ring (100 m → 500 m → 1 km, etc., widening once
    // per minute) actually reaches them. This makes the tiers authoritative,
    // not just a filter on what the app happens to show.
    if (isDispatchExpired(trip.vehicleType, trip.createdAt)) {
        throw new apiError(400, 'This request has expired — no driver was found in time');
    }
    const driverCoords = driver.currentLocation?.coordinates;
    if (!isWithinCurrentRing(trip.vehicleType, trip.createdAt, driverCoords, trip.pickup.location.coordinates)) {
        throw new apiError(400, 'This request has not reached your area yet — please wait');
    }

    const existingBid = await Bid.findOne({ tripId, driverId: driver._id, status: 'pending' });
    if (existingBid) throw new apiError(400, 'You have already placed a bid on this trip');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const bid = await Bid.create({
        tripId,
        driverId: driver._id,
        amount: parseFloat(amount),
        message: message || null,
        expiresAt,
    });

    await Notification.create({
        userId: trip.userId,
        title: 'New Bid Received',
        body: `A driver offered NPR ${amount} for your trip`,
        type: 'bid_received',
        refId: bid._id,
    });

    return res.status(201).json(new apiResponse(201, bid, 'Bid placed'));
});

const getBidsForTrip = asyncHandler(async (req, res) => {
    const trip = await Trip.findOne({ _id: req.params.tripId, userId: req.user._id });
    if (!trip) throw new apiError(404, 'Trip not found');

    // Lazily retire an exhausted request so its state is authoritative even if
    // the rider's app closed before the client-side timeout: once past the last
    // dispatch tier with no acceptance, the trip is cancelled by the system.
    if (trip.status === 'pending' && isDispatchExpired(trip.vehicleType, trip.createdAt)) {
        trip.status = 'cancelled';
        trip.cancelledBy = 'system';
        trip.cancelReason = 'no_driver_found';
        trip.cancelledAt = new Date();
        await trip.save();
    }
    if (trip.status !== 'pending') throw new apiError(404, 'Trip not found or no longer accepting bids');

    const bids = await Bid.find({
        tripId: req.params.tripId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
    })
        .sort({ amount: 1 })
        .populate({
            path: 'driverId',
            select: 'vehicleType vehiclePlate vehicleModel vehicleColor rating totalRides currentLocation',
            populate: { path: 'userId', select: 'name avatarUrl' },
        });

    return res.status(200).json(new apiResponse(200, bids, 'Bids fetched'));
});

const acceptBid = asyncHandler(async (req, res) => {
    // Atomically claim the bid - only succeeds if still pending
    const bid = await Bid.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        { status: 'accepted' },
        { new: true }
    );
    if (!bid) throw new apiError(404, 'Bid not found or already processed');

    // Atomically claim the trip - only succeeds if still pending
    const trip = await Trip.findOneAndUpdate(
        { _id: bid.tripId, userId: req.user._id, status: 'pending' },
        {
            driverId: bid.driverId,
            finalPrice: bid.amount,
            status: 'accepted',
            acceptedAt: new Date(),
        },
        { new: true }
    );
    if (!trip) {
        // Trip already accepted by another bid - rollback our bid acceptance
        await Bid.findByIdAndUpdate(req.params.id, { status: 'pending' });
        throw new apiError(400, 'Trip is no longer available');
    }

    // Bulk reject other pending bids
    await Bid.updateMany(
        { tripId: bid.tripId, _id: { $ne: bid._id }, status: 'pending' },
        { status: 'rejected' }
    );

    await Driver.findByIdAndUpdate(bid.driverId, { isOnRide: true });

    await Notification.create({
        driverId: bid.driverId,
        title: 'Bid Accepted',
        body: `Your bid of NPR ${bid.amount} was accepted`,
        type: 'bid_accepted',
        refId: trip._id,
    });

    return res.status(200).json(new apiResponse(200, { bid, trip }, 'Bid accepted'));
});

const rejectBid = asyncHandler(async (req, res) => {
    const bid = await Bid.findById(req.params.id);
    if (!bid) throw new apiError(404, 'Bid not found');

    const trip = await Trip.findOne({ _id: bid.tripId, userId: req.user._id });
    if (!trip) throw new apiError(403, 'Unauthorized');
    if (bid.status !== 'pending') throw new apiError(400, 'Bid is not pending');

    bid.status = 'rejected';
    await bid.save();

    return res.status(200).json(new apiResponse(200, bid, 'Bid rejected'));
});

const getMyBids = asyncHandler(async (req, res) => {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const { status, page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;
    const filter = { driverId: driver._id };
    if (status) filter.status = status;

    const [bids, total] = await Promise.all([
        Bid.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('tripId', 'pickup dropoff offeredPrice status vehicleType'),
        Bid.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, {
            bids,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'My bids fetched')
    );
});

export { createBid, getBidsForTrip, acceptBid, rejectBid, getMyBids };
