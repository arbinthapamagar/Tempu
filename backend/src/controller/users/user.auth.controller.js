import { User } from '../../models/user.model.js';
import { apiError } from '../../utils/apiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { verifyEmailTemplate } from '../../utils/verifyEmailTemplate.js';
import { forgetPasswordTemplate } from '../../utils/forgetPasswordTemplete.js';
import { sendEmail } from '../../config/sendEmail.js';
import { generateOtp, otpExpireTime } from '../../utils/generateOtp.js';
import jwt from 'jsonwebtoken';

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};

const userRegister = asyncHandler(async (req, res) => {
    const { name, phone, email, password, confirmPassword, dateOfBirth, gender } = req.body;

    if (!name || !phone || !password || !gender) {
        throw new apiError(400, 'Name, phone, password, and gender are required');
    }

    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(phone.trim())) throw new apiError(400, 'Invalid phone number format');

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) throw new apiError(400, 'Invalid email format');
    }
    if (password.length < 8) throw new apiError(400, 'Password must be at least 8 characters');
    if (confirmPassword && password !== confirmPassword) throw new apiError(400, 'Passwords do not match');

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) throw new apiError(409, 'User already exists with this phone number');

    const otpCode = generateOtp();
    const otpExpiry = otpExpireTime();

    const user = await User.create({
        name: name.trim(),
        password,
        phone: phone.trim(),
        email: email?.trim().toLowerCase() || null,
        dateOfBirth: dateOfBirth || null,
        gender,
        otp: { code: otpCode, expiresAt: otpExpiry, attempts: 0 },
    });

    if (email) {
        await sendEmail({
            sendTo: email,
            subject: 'Verify your account - Shakti',
            html: verifyEmailTemplate({ name, otp: otpCode }),
        });
    }

    const tempToken = jwt.sign({ _id: user._id }, process.env.TEMP_TOKEN_SECRET, { expiresIn: '10m' });
    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');

    return res.status(201).json(
        new apiResponse(201, { user: userResponse, tempToken }, 'Registered successfully. Please verify OTP.')
    );
});

const verifyOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const tempToken = req.headers.authorization?.replace('Bearer ', '');

    if (!otp) throw new apiError(400, 'OTP is required');
    if (!tempToken) throw new apiError(401, 'Temp token is required');

    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.TEMP_TOKEN_SECRET);
    } catch {
        throw new apiError(401, 'Invalid or expired temp token');
    }

    const user = await User.findById(decoded._id);
    if (!user) throw new apiError(404, 'User not found');
    if (!user.otp?.code) throw new apiError(400, 'OTP not requested');
    if (user.otp.expiresAt < new Date()) throw new apiError(400, 'OTP expired');

    if ((user.otp.attempts || 0) >= 5) {
        user.otp = { code: null, expiresAt: null, attempts: 0 };
        await user.save();
        throw new apiError(400, 'Too many incorrect attempts. Please request a new OTP');
    }

    if (String(user.otp.code) !== String(otp)) {
        user.otp.attempts = (user.otp.attempts || 0) + 1;
        await user.save();
        throw new apiError(400, 'Invalid OTP');
    }

    user.isPhoneVerified = true;
    user.otp.code = null;
    user.otp.expiresAt = null;
    user.otp.attempts = 0;

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');

    return res
        .status(200)
        .cookie('accessToken', accessToken, cookieOptions)
        .cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 100 * 24 * 60 * 60 * 1000 })
        .json(new apiResponse(200, { user: userResponse, accessToken, refreshToken }, 'OTP verified successfully'));
});

const login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) throw new apiError(400, 'Phone and password are required');

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) throw new apiError(401, 'Invalid credentials');
    if (user.accountStatus === 'banned') throw new apiError(403, 'Account has been banned');
    if (user.accountStatus === 'suspended') throw new apiError(403, 'Account has been suspended');

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) throw new apiError(401, 'Invalid credentials');

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    const userResponse = await User.findById(user._id).select('-password -refreshToken -otp');

    return res
        .status(200)
        .cookie('accessToken', accessToken, cookieOptions)
        .cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 100 * 24 * 60 * 60 * 1000 })
        .json(new apiResponse(200, { user: userResponse, accessToken, refreshToken }, 'Login successful'));
});

const logout = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return res
        .status(200)
        .clearCookie('accessToken', cookieOptions)
        .clearCookie('refreshToken', cookieOptions)
        .json(new apiResponse(200, {}, 'Logged out successfully'));
});

const refreshToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) throw new apiError(401, 'Refresh token is required');

    let decoded;
    try {
        decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
        throw new apiError(401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== incomingRefreshToken) {
        throw new apiError(401, 'Refresh token is invalid or has been used');
    }

    const accessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();
    user.refreshToken = newRefreshToken;
    await user.save();

    return res
        .status(200)
        .cookie('accessToken', accessToken, cookieOptions)
        .cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 100 * 24 * 60 * 60 * 1000 })
        .json(new apiResponse(200, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed'));
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone) throw new apiError(400, 'Phone number is required');

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) throw new apiError(404, 'User not found');

    const otpCode = generateOtp();
    const otpExpiry = otpExpireTime();
    user.otp = { code: otpCode, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    if (user.email) {
        await sendEmail({
            sendTo: user.email,
            subject: 'Password Reset - Shakti',
            html: forgetPasswordTemplate({ name: user.name, otp: otpCode }),
        });
    }

    const tempToken = jwt.sign({ _id: user._id, purpose: 'reset' }, process.env.TEMP_TOKEN_SECRET, { expiresIn: '10m' });
    return res.status(200).json(new apiResponse(200, { tempToken }, 'OTP sent for password reset'));
});

const resetPassword = asyncHandler(async (req, res) => {
    const { otp, newPassword, confirmPassword } = req.body;
    const tempToken = req.headers.authorization?.replace('Bearer ', '');

    if (!otp || !newPassword) throw new apiError(400, 'OTP and new password are required');
    if (confirmPassword && newPassword !== confirmPassword) throw new apiError(400, 'Passwords do not match');
    if (newPassword.length < 8) throw new apiError(400, 'Password must be at least 8 characters');
    if (!tempToken) throw new apiError(401, 'Temp token is required');

    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.TEMP_TOKEN_SECRET);
    } catch {
        throw new apiError(401, 'Invalid or expired temp token');
    }

    if (decoded.purpose !== 'reset') throw new apiError(401, 'Invalid token purpose');

    const user = await User.findById(decoded._id);
    if (!user) throw new apiError(404, 'User not found');
    if (!user.otp?.code) throw new apiError(400, 'OTP not requested');
    if (user.otp.expiresAt < new Date()) throw new apiError(400, 'OTP expired');

    if ((user.otp.attempts || 0) >= 5) {
        user.otp = { code: null, expiresAt: null, attempts: 0 };
        await user.save();
        throw new apiError(400, 'Too many incorrect attempts. Please request a new OTP');
    }

    if (String(user.otp.code) !== String(otp)) {
        user.otp.attempts = (user.otp.attempts || 0) + 1;
        await user.save();
        throw new apiError(400, 'Invalid OTP');
    }

    user.password = newPassword;
    user.otp.code = null;
    user.otp.expiresAt = null;
    user.otp.attempts = 0;
    user.refreshToken = null;
    await user.save();

    return res.status(200).json(new apiResponse(200, {}, 'Password reset successful'));
});

const resendOtp = asyncHandler(async (req, res) => {
    const tempToken = req.headers.authorization?.replace('Bearer ', '');
    if (!tempToken) throw new apiError(401, 'Temp token is required');

    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.TEMP_TOKEN_SECRET);
    } catch {
        throw new apiError(401, 'Invalid or expired temp token');
    }

    const user = await User.findById(decoded._id);
    if (!user) throw new apiError(404, 'User not found');
    if (user.isPhoneVerified) throw new apiError(400, 'Phone already verified');

    const otpCode = generateOtp();
    const otpExpiry = otpExpireTime();
    user.otp = { code: otpCode, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    if (user.email) {
        await sendEmail({
            sendTo: user.email,
            subject: 'New OTP - Shakti',
            html: verifyEmailTemplate({ name: user.name, otp: otpCode }),
        });
    }

    const newTempToken = jwt.sign({ _id: user._id }, process.env.TEMP_TOKEN_SECRET, { expiresIn: '10m' });
    return res.status(200).json(new apiResponse(200, { tempToken: newTempToken }, 'OTP resent successfully'));
});

export { userRegister, verifyOtp, login, logout, refreshToken, forgotPassword, resetPassword, resendOtp };
