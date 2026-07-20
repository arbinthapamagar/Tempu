import { Subscription } from '../../models/subscription.model.js';
import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const getMySubscriptions = asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .populate({
            path: 'primaryDriver',
            select: 'vehicleType vehiclePlate rating userId',
            populate: { path: 'userId', select: 'name phone avatarUrl' },
        });
    return res.status(200).json(new apiResponse(200, subscriptions, 'Subscriptions fetched'));
});

const createSubscription = asyncHandler(async (req, res) => {
    const {
        vehicleType, monthlyPrice,
        pickup, dropoff, pickupTime, dropoffTime, startDate, endDate,
        childName, childAge, schoolName, childPhoto,
    } = req.body;

    // Subscriptions are parent/kid plans only.
    if (!vehicleType || !monthlyPrice || !pickup || !dropoff || !startDate || !endDate) {
        throw new apiError(400, 'Required fields are missing');
    }
    if (!childName || !schoolName) {
        throw new apiError(400, 'Child name and school name are required');
    }
    if (!pickup.address || !pickup.location?.coordinates) {
        throw new apiError(400, 'Pickup address and coordinates are required');
    }
    if (!dropoff.address || !dropoff.location?.coordinates) {
        throw new apiError(400, 'Dropoff address and coordinates are required');
    }

    const subscription = await Subscription.create({
        userId: req.user._id,
        plan: 'parent',
        vehicleType,
        monthlyPrice: parseFloat(monthlyPrice),
        pickup, dropoff, pickupTime, dropoffTime,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        childName: childName || null,
        childAge: childAge || null,
        schoolName: schoolName || null,
        childPhoto: childPhoto || null,
    });

    await User.findByIdAndUpdate(req.user._id, {
        subscription: subscription._id,
        userType: 'parent',
    });

    return res.status(201).json(new apiResponse(201, subscription, 'Subscription created'));
});

const getSubscriptionById = asyncHandler(async (req, res) => {
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user._id })
        .populate({
            path: 'primaryDriver',
            select: 'vehicleType vehiclePlate rating userId',
            populate: { path: 'userId', select: 'name phone avatarUrl' },
        });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription fetched'));
});

const cancelSubscription = asyncHandler(async (req, res) => {
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user._id });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    if (subscription.status === 'cancelled') throw new apiError(400, 'Already cancelled');

    subscription.status = 'cancelled';
    await subscription.save();
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription cancelled'));
});

const pauseSubscription = asyncHandler(async (req, res) => {
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user._id });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    if (subscription.status !== 'active') throw new apiError(400, 'Only active subscriptions can be paused');

    subscription.status = 'paused';
    await subscription.save();
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription paused'));
});

const resumeSubscription = asyncHandler(async (req, res) => {
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user._id });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    if (subscription.status !== 'paused') throw new apiError(400, 'Only paused subscriptions can be resumed');

    subscription.status = 'active';
    await subscription.save();
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription resumed'));
});

export { getMySubscriptions, createSubscription, getSubscriptionById, cancelSubscription, pauseSubscription, resumeSubscription };
