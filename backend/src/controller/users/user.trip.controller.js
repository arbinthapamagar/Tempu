import { Trip } from '../../models/trip.model.js';
import { Pricing } from '../../models/pricing.model.js';
import { computeStandardFare } from '../../utils/fareCalc.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

function metresBetween([lng1, lat1], [lng2, lat2]) {
    const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// Standard fare for a vehicle/route, so the app can show it and floor the bid.
const getFareQuote = asyncHandler(async (req, res) => {
    const { vehicleType, distanceKm, city, lat1, lng1, lat2, lng2 } = req.query;
    if (!vehicleType) throw new apiError(400, 'vehicleType is required');

    let km = parseFloat(distanceKm);
    if (!km && lat1 && lng1 && lat2 && lng2) {
        km = metresBetween([parseFloat(lng1), parseFloat(lat1)], [parseFloat(lng2), parseFloat(lat2)]) / 1000;
    }
    if (!km || km <= 0) throw new apiError(400, 'distanceKm or pickup/dropoff coordinates are required');

    const pricing = await Pricing.findOne({ key: 'global' });
    const standardFare = pricing ? computeStandardFare(pricing, { vehicleType, distanceKm: km, cityName: city || null }) : null;

    return res.status(200).json(new apiResponse(200, { vehicleType, distanceKm: km, standardFare }, 'Fare quote'));
});

const getTripHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId: req.user._id };
    // status may be a single value or a comma list (e.g. "cancelled,expired").
    if (status) {
        const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
        filter.status = list.length > 1 ? { $in: list } : list[0];
    }

    const [trips, total, byStatus] = await Promise.all([
        Trip.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'driverId',
                select: 'vehicleType vehiclePlate vehicleModel vehicleColor rating userId',
                populate: { path: 'userId', select: 'name avatarUrl' },
            }),
        Trip.countDocuments(filter),
        // Totals per status across ALL of the rider's trips, so filter chips
        // show real counts rather than counts of the loaded page.
        Trip.aggregate([
            { $match: { userId: req.user._id } },
            { $group: { _id: '$status', n: { $sum: 1 } } },
        ]),
    ]);
    const counts = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));

    return res.status(200).json(
        new apiResponse(200, {
            trips,
            counts,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
        }, 'Trip history fetched')
    );
});

const getTripById = asyncHandler(async (req, res) => {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id })
        .populate({
            path: 'driverId',
            select: 'vehicleType vehiclePlate vehicleModel vehicleColor rating currentLocation userId',
            populate: { path: 'userId', select: 'name phone avatarUrl' },
        });
    if (!trip) throw new apiError(404, 'Trip not found');
    return res.status(200).json(new apiResponse(200, trip, 'Trip fetched'));
});

// The rider's trip that is still in play (posted, accepted, driver on the way
// or in progress), so the app can resume it after being closed. Null if none.
const ACTIVE_STATUSES = ['pending', 'accepted', 'arriving', 'started'];
const getActiveTrip = asyncHandler(async (req, res) => {
    const trip = await Trip.findOne({ userId: req.user._id, status: { $in: ACTIVE_STATUSES } })
        .sort({ createdAt: -1 })
        .populate({
            path: 'driverId',
            select: 'vehicleType vehiclePlate vehicleModel vehicleColor rating currentLocation userId',
            populate: { path: 'userId', select: 'name phone avatarUrl' },
        });
    return res.status(200).json(new apiResponse(200, trip || null, trip ? 'Active trip' : 'No active trip'));
});

export { getTripHistory, getTripById, getFareQuote, getActiveTrip };
