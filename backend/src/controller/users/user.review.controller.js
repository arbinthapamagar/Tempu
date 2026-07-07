import { Review } from '../../models/review.model.js';
import { Trip } from '../../models/trip.model.js';
import { Driver } from '../../models/driver.model.js';
import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const createReview = asyncHandler(async (req, res) => {
    const { tripId, rating, comment } = req.body;
    if (!tripId || !rating) throw new apiError(400, 'Trip ID and rating are required');
    if (rating < 1 || rating > 5) throw new apiError(400, 'Rating must be between 1 and 5');

    const trip = await Trip.findOne({ _id: tripId, userId: req.user._id, status: 'completed' });
    if (!trip) throw new apiError(404, 'Completed trip not found');
    if (trip.isRatedByRider) throw new apiError(400, 'Trip already rated');
    if (!trip.driverId) throw new apiError(400, 'No driver assigned to this trip');

    const review = await Review.create({
        tripId,
        fromUser: req.user._id,
        toDriver: trip.driverId,
        rating: parseInt(rating),
        comment: comment || null,
        reviewType: 'rider_to_driver',
    });

    trip.isRatedByRider = true;
    await trip.save();

    // Atomic running average update - prevents race condition
    await Driver.findByIdAndUpdate(
        trip.driverId,
        [
            {
                $set: {
                    totalRatings: { $add: ['$totalRatings', 1] },
                    rating: {
                        $round: [
                            {
                                $divide: [
                                    { $add: [{ $multiply: ['$rating', '$totalRatings'] }, parseInt(rating)] },
                                    { $add: ['$totalRatings', 1] },
                                ],
                            },
                            2,
                        ],
                    },
                },
            },
        ]
    );

    return res.status(201).json(new apiResponse(201, review, 'Review submitted'));
});

const getMyReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find({ fromUser: req.user._id })
        .sort({ createdAt: -1 })
        .populate({
            path: 'toDriver',
            select: 'vehicleType rating userId',
            populate: { path: 'userId', select: 'name avatarUrl' },
        })
        .populate('tripId', 'pickup dropoff');
    return res.status(200).json(new apiResponse(200, reviews, 'Reviews fetched'));
});

const driverCreateReview = asyncHandler(async (req, res) => {
    const { tripId, rating, comment } = req.body;
    if (!tripId || !rating) throw new apiError(400, 'Trip ID and rating are required');
    if (rating < 1 || rating > 5) throw new apiError(400, 'Rating must be between 1 and 5');

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) throw new apiError(404, 'Driver profile not found');

    const trip = await Trip.findOne({ _id: tripId, driverId: driver._id, status: 'completed' });
    if (!trip) throw new apiError(404, 'Completed trip not found');
    if (trip.isRatedByDriver) throw new apiError(400, 'Trip already rated');

    const review = await Review.create({
        tripId,
        fromUser: req.user._id,
        toUser: trip.userId,
        rating: parseInt(rating),
        comment: comment || null,
        reviewType: 'driver_to_rider',
    });

    trip.isRatedByDriver = true;
    await trip.save();

    // Update rider's rating atomically
    await User.findByIdAndUpdate(
        trip.userId,
        [
            {
                $set: {
                    'rating.total': { $add: ['$rating.total', 1] },
                    'rating.average': {
                        $round: [
                            {
                                $divide: [
                                    { $add: [{ $multiply: ['$rating.average', '$rating.total'] }, parseInt(rating)] },
                                    { $add: ['$rating.total', 1] },
                                ],
                            },
                            2,
                        ],
                    },
                },
            },
        ]
    );

    return res.status(201).json(new apiResponse(201, review, 'Review submitted'));
});

export { createReview, getMyReviews, driverCreateReview };
