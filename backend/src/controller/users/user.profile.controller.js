import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';

const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-password -refreshToken -otp')
        .populate('driverProfile')
        .populate('subscription');
    return res.status(200).json(new apiResponse(200, user, 'Profile fetched'));
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, email, dateOfBirth, gender, preferredPaymentMethod, userType } = req.body;

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) throw new apiError(400, 'Invalid email format');
        const emailExists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
        if (emailExists) throw new apiError(409, 'Email already in use');
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (dateOfBirth) updates.dateOfBirth = dateOfBirth;
    if (gender) updates.gender = gender;
    if (preferredPaymentMethod) updates.preferredPaymentMethod = preferredPaymentMethod;
    if (userType) updates.userType = userType;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password -refreshToken -otp');
    return res.status(200).json(new apiResponse(200, user, 'Profile updated'));
});

const uploadAvatar = asyncHandler(async (req, res) => {
    const localFilePath = req.file?.path;
    if (!localFilePath) throw new apiError(400, 'Avatar file is required');

    const result = await uploadOnCloudinary(localFilePath);
    if (!result?.secure_url) throw new apiError(500, 'Failed to upload avatar');

    if (req.user.avatarUrl) {
        const parts = req.user.avatarUrl.split('/');
        const publicId = parts[parts.length - 1].split('.')[0];
        await deleteFromCloudinary(publicId);
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatarUrl: result.secure_url },
        { new: true }
    ).select('-password -refreshToken -otp');

    return res.status(200).json(new apiResponse(200, { avatarUrl: user.avatarUrl }, 'Avatar uploaded'));
});

const deleteAvatar = asyncHandler(async (req, res) => {
    if (req.user.avatarUrl) {
        const parts = req.user.avatarUrl.split('/');
        const publicId = parts[parts.length - 1].split('.')[0];
        await deleteFromCloudinary(publicId);
    }
    await User.findByIdAndUpdate(req.user._id, { avatarUrl: null });
    return res.status(200).json(new apiResponse(200, { avatarUrl: null }, 'Avatar removed'));
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) throw new apiError(400, 'Current and new password are required');
    if (confirmPassword && newPassword !== confirmPassword) throw new apiError(400, 'Passwords do not match');
    if (newPassword.length < 8) throw new apiError(400, 'Password must be at least 8 characters');

    const user = await User.findById(req.user._id);
    const isValid = await user.isPasswordCorrect(currentPassword);
    if (!isValid) throw new apiError(401, 'Current password is incorrect');

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    return res.status(200).json(new apiResponse(200, {}, 'Password changed successfully'));
});

const updateFcmToken = asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken) throw new apiError(400, 'FCM token is required');
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    return res.status(200).json(new apiResponse(200, {}, 'FCM token updated'));
});

export { getProfile, updateProfile, uploadAvatar, deleteAvatar, changePassword, updateFcmToken };
