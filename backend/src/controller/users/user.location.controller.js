import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const updateLocation = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.body;
    if (longitude === undefined || latitude === undefined) {
        throw new apiError(400, 'Longitude and latitude are required');
    }
    await User.findByIdAndUpdate(req.user._id, {
        currentLocation: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
    });
    return res.status(200).json(new apiResponse(200, {}, 'Location updated'));
});

const getSavedAddresses = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('savedAddresses');
    return res.status(200).json(new apiResponse(200, user.savedAddresses, 'Saved addresses fetched'));
});

// Clients send the point either flat ({ latitude, longitude }) or nested the
// way the mobile map picker hands it over ({ coordinates: { latitude, longitude } }).
function pointFrom(body) {
    const c = body.coordinates || body;
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

const addSavedAddress = asyncHandler(async (req, res) => {
    const label = String(req.body.label || '').trim().toLowerCase();
    const address = String(req.body.address || '').trim();
    const point = pointFrom(req.body);
    if (!label || !address || !point) {
        throw new apiError(400, 'label, address, longitude, and latitude are required');
    }
    const { longitude, latitude } = point;

    const user = await User.findById(req.user._id);
    const newAddress = {
        label,
        address,
        location: { type: 'Point', coordinates: [longitude, latitude] },
    };

    const existingIndex = user.savedAddresses.findIndex(a => a.label === label);
    if (existingIndex >= 0) {
        user.savedAddresses[existingIndex] = newAddress;
    } else {
        user.savedAddresses.push(newAddress);
    }
    await user.save();

    return res.status(201).json(new apiResponse(201, user.savedAddresses, 'Address saved'));
});

const updateSavedAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { label, address } = req.body;
    const point = pointFrom(req.body);

    const user = await User.findById(req.user._id);
    const idx = user.savedAddresses.findIndex(a => a._id.toString() === id);
    if (idx === -1) throw new apiError(404, 'Address not found');

    if (label) user.savedAddresses[idx].label = label;
    if (address) user.savedAddresses[idx].address = address;
    if (point) {
        user.savedAddresses[idx].location = {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
        };
    }
    await user.save();
    return res.status(200).json(new apiResponse(200, user.savedAddresses, 'Address updated'));
});

const deleteSavedAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    const idx = user.savedAddresses.findIndex(a => a._id.toString() === id);
    if (idx === -1) throw new apiError(404, 'Address not found');

    user.savedAddresses.splice(idx, 1);
    await user.save();
    return res.status(200).json(new apiResponse(200, user.savedAddresses, 'Address deleted'));
});

export { updateLocation, getSavedAddresses, addSavedAddress, updateSavedAddress, deleteSavedAddress };
