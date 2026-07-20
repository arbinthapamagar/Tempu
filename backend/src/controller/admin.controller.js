import { Admin } from '../models/admin.model.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { Document } from '../models/doeument.model.js';
import { Trip } from '../models/trip.model.js';
import { Bid } from '../models/bid.model.js';
import { Subscription } from '../models/subscription.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Withdrawal } from '../models/withdrawal.model.js';
import { Pricing, defaultPricing, VEHICLE_TYPES } from '../models/pricing.model.js';
import { Emergency } from '../models/emergency.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { Supplier } from '../models/supplier.model.js';
import { getSupportSettings } from '../models/supportSettings.model.js';
import { AdminNotification } from '../models/adminNotification.model.js';
import { Notification } from '../models/notification.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadOnCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { sendEmail } from '../config/sendEmail.js';
import { grantEmailTemplate } from '../utils/grantEmailTemplate.js';
import { emergencyEmailTemplate } from '../utils/emergencyEmailTemplate.js';
import { notificationEmailTemplate } from '../utils/notificationEmailTemplate.js';
import { processQueue, postAgentGreeting } from '../utils/supportAssign.js';
import jwt from 'jsonwebtoken';

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Permission gate with an implicit superadmin bypass: superadmins hold every
// capability regardless of the stored permission flags (mirrors the frontend's
// hasPermission), and it's resilient to admin docs that predate a permission
// being added to the schema (flag === undefined would otherwise deny access).
const can = (admin, key) => admin?.role === 'superadmin' || admin?.permissions?.[key] === true;

function getPeriodStart(period) {
    const now = new Date();
    if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
    } else if (period === 'year') {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        return d;
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
}

// Resolve an analytics date window from the query: either an explicit custom
// range (?start=YYYY-MM-DD&end=YYYY-MM-DD) or a named period (week/month/year).
// Returns the match object + whether to group by month (long ranges).
function getAnalyticsRange(query) {
    const { period = 'month', start, end } = query;
    if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        const days = (endDate - startDate) / 86400000;
        return { match: { $gte: startDate, $lte: endDate }, groupByMonth: days > 92 };
    }
    return { match: { $gte: getPeriodStart(period) }, groupByMonth: period === 'year' };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Auth

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new apiError(400, 'Email and password are required');

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) throw new apiError(401, 'Invalid credentials');
    if (!admin.isActive) throw new apiError(403, 'Admin account is deactivated');

    const isValid = await admin.isPasswordCorrect(password);
    if (!isValid) throw new apiError(401, 'Invalid credentials');

    const accessToken = admin.generateAccessToken();
    const refreshToken = admin.generateRefreshToken();
    admin.refreshToken = refreshToken;
    admin.lastLoginAt = new Date();
    await admin.save();

    const adminResponse = await Admin.findById(admin._id).select('-password -refreshToken');

    return res
        .status(200)
        .cookie('adminAccessToken', accessToken, cookieOptions)
        .cookie('adminRefreshToken', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(new apiResponse(200, { admin: adminResponse, accessToken, refreshToken }, 'Login successful'));
});

const logout = asyncHandler(async (req, res) => {
    await Admin.findByIdAndUpdate(req.admin._id, { refreshToken: null });
    return res
        .status(200)
        .clearCookie('adminAccessToken', cookieOptions)
        .clearCookie('adminRefreshToken', cookieOptions)
        .json(new apiResponse(200, {}, 'Logged out successfully'));
});

const refreshAdminToken = asyncHandler(async (req, res) => {
    const incomingToken = req.cookies?.adminRefreshToken || req.body.refreshToken;
    if (!incomingToken) throw new apiError(401, 'Refresh token is required');

    let decoded;
    try {
        decoded = jwt.verify(incomingToken, process.env.ADMIN_REFRESH_TOKEN_SECRET);
    } catch {
        throw new apiError(401, 'Invalid or expired refresh token');
    }

    const admin = await Admin.findById(decoded._id);
    if (!admin || admin.refreshToken !== incomingToken) {
        throw new apiError(401, 'Refresh token is invalid or expired');
    }

    const accessToken = admin.generateAccessToken();
    const newRefreshToken = admin.generateRefreshToken();
    admin.refreshToken = newRefreshToken;
    await admin.save();

    return res
        .status(200)
        .cookie('adminAccessToken', accessToken, cookieOptions)
        .cookie('adminRefreshToken', newRefreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(new apiResponse(200, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed'));
});

const getMe = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.admin._id).select('-password -refreshToken');
    return res.status(200).json(new apiResponse(200, admin, 'Profile fetched'));
});

// Update your own profile: name, email, phone, and optionally password.
const uploadMyAvatar = asyncHandler(async (req, res) => {
    const localFilePath = req.file?.path;
    if (!localFilePath) throw new apiError(400, 'Avatar file is required');

    const result = await uploadOnCloudinary(localFilePath);
    if (!result?.secure_url) throw new apiError(500, 'Failed to upload avatar');

    const admin = await Admin.findById(req.admin._id);
    if (admin.avatarUrl) {
        const parts = admin.avatarUrl.split('/');
        await deleteFromCloudinary(parts[parts.length - 1].split('.')[0]);
    }
    admin.avatarUrl = result.secure_url;
    await admin.save();

    return res.status(200).json(new apiResponse(200, { avatarUrl: admin.avatarUrl }, 'Avatar uploaded'));
});

const deleteMyAvatar = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.admin._id);
    if (admin.avatarUrl) {
        const parts = admin.avatarUrl.split('/');
        await deleteFromCloudinary(parts[parts.length - 1].split('.')[0]);
        admin.avatarUrl = null;
        await admin.save();
    }
    return res.status(200).json(new apiResponse(200, { avatarUrl: null }, 'Avatar removed'));
});

const updateMyProfile = asyncHandler(async (req, res) => {
    const { name, email, phone, currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.admin._id);
    if (!admin) throw new apiError(404, 'Admin not found');

    if (email && email.toLowerCase().trim() !== admin.email) {
        const exists = await Admin.findOne({ email: email.toLowerCase().trim(), _id: { $ne: admin._id } });
        if (exists) throw new apiError(409, 'Email already in use');
        admin.email = email.toLowerCase().trim();
    }
    if (phone && phone !== admin.phone) {
        const exists = await Admin.findOne({ phone, _id: { $ne: admin._id } });
        if (exists) throw new apiError(409, 'Phone already in use');
        admin.phone = phone;
    }
    if (name) admin.name = name;
    if (typeof req.body.supportGreeting === 'string') admin.supportGreeting = req.body.supportGreeting.trim();

    if (newPassword) {
        if (!currentPassword) throw new apiError(400, 'Current password is required to change password');
        const ok = await admin.isPasswordCorrect(currentPassword);
        if (!ok) throw new apiError(401, 'Current password is incorrect');
        if (newPassword.length < 6) throw new apiError(400, 'New password must be at least 6 characters');
        admin.password = newPassword; // hashed by the pre-save hook
    }

    await admin.save();

    const updated = await Admin.findById(admin._id).select('-password -refreshToken');
    return res.status(200).json(new apiResponse(200, updated, 'Profile updated'));
});

const createAdmin = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageAdmins) throw new apiError(403, 'Insufficient permissions');

    const { name, email, phone, password, role, permissions } = req.body;
    if (!name || !email || !phone || !password || !role) {
        throw new apiError(400, 'All fields are required');
    }
    const validRoles = ['headmaster', 'moderator'];
    if (!validRoles.includes(role)) throw new apiError(400, 'Role must be headmaster or moderator');

    const existing = await Admin.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) throw new apiError(409, 'Admin already exists with this email or phone');

    const admin = await Admin.create({
        name,
        email: email.toLowerCase(),
        phone,
        password,
        role,
        createdBy: req.admin._id,
    });

    if (permissions && typeof permissions === 'object') {
        const safePermissions = {};
        Object.keys(permissions).forEach(perm => {
            safePermissions[perm] = permissions[perm] && (req.admin.permissions[perm] === true);
        });
        await Admin.findByIdAndUpdate(admin._id, { permissions: safePermissions });
    }

    const adminResponse = await Admin.findById(admin._id).select('-password -refreshToken');
    return res.status(201).json(new apiResponse(201, adminResponse, 'Admin created'));
});

const listAdmins = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageAdmins) throw new apiError(403, 'Insufficient permissions');

    const admins = await Admin.find().select('-password -refreshToken').sort({ createdAt: -1 }).lean();

    // The single support rating is stored permanently on each admin (accrued as
    // customers rate their tickets), so it is independent of the tickets and
    // survives their deletion. Expose it as { avg, count } for the UI.
    const withRatings = admins.map((a) => {
        const r = a.supportRating || {};
        return { ...a, supportRating: { avg: r.average || 0, count: r.count || 0 } };
    });

    return res.status(200).json(new apiResponse(200, withRatings, 'Admins fetched'));
});

const updateAdminPermissions = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageAdmins) throw new apiError(403, 'Insufficient permissions');

    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
        throw new apiError(400, 'Permissions object is required');
    }

    const target = await Admin.findById(req.params.id);
    if (!target) throw new apiError(404, 'Admin not found');
    if (target.role === 'superadmin') throw new apiError(403, 'Cannot modify superadmin permissions');
    if (target._id.toString() === req.admin._id.toString()) throw new apiError(403, 'Cannot modify your own permissions');

    const updated = await Admin.findByIdAndUpdate(
        req.params.id,
        { permissions },
        { new: true }
    ).select('-password -refreshToken');

    return res.status(200).json(new apiResponse(200, updated, 'Permissions updated'));
});

const toggleAdminStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageAdmins) throw new apiError(403, 'Insufficient permissions');

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') throw new apiError(400, 'isActive boolean is required');

    const target = await Admin.findById(req.params.id);
    if (!target) throw new apiError(404, 'Admin not found');
    if (target.role === 'superadmin') throw new apiError(403, 'Cannot deactivate superadmin');
    if (target._id.toString() === req.admin._id.toString()) throw new apiError(403, 'Cannot deactivate yourself');

    const updated = await Admin.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password -refreshToken');
    return res.status(200).json(new apiResponse(200, updated, `Admin ${isActive ? 'activated' : 'deactivated'}`));
});

const deleteAdmin = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageAdmins) throw new apiError(403, 'Insufficient permissions');

    const target = await Admin.findById(req.params.id);
    if (!target) throw new apiError(404, 'Admin not found');
    if (target.role === 'superadmin') throw new apiError(403, 'Cannot delete superadmin');
    if (target._id.toString() === req.admin._id.toString()) throw new apiError(403, 'Cannot delete yourself');

    await Admin.findByIdAndDelete(req.params.id);
    return res.status(200).json(new apiResponse(200, {}, 'Admin deleted'));
});

// Dashboard 

const getDashboardStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        totalUsers,
        activeDrivers,
        tripsToday,
        revenueTodayResult,
        pendingDocuments,
        openTickets,
        activeSubscriptions,
        pendingDrivers,
    ] = await Promise.all([
        User.countDocuments(),
        Driver.countDocuments({ status: 'approved', isOnline: true }),
        Trip.countDocuments({ createdAt: { $gte: today } }),
        Transaction.aggregate([
            { $match: { type: 'platform_fee', status: 'completed', createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Document.countDocuments({ status: 'pending' }),
        SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
        Subscription.countDocuments({ status: 'active' }),
        Driver.countDocuments({ status: 'pending' }),
    ]);

    return res.status(200).json(new apiResponse(200, {
        totalUsers,
        activeDrivers,
        tripsToday,
        revenueToday: revenueTodayResult[0]?.total || 0,
        pendingDocuments,
        openTickets,
        activeSubscriptions,
        pendingDrivers,
    }, 'Dashboard stats fetched'));
});

const NAV_KEYS = ['drivers', 'documents', 'withdrawals', 'support', 'emergencies'];

// Sidebar badge counts: items needing attention that arrived AFTER the admin
// last viewed that section (i.e. only NEW items). Permission-gated per key.
const getNavCounts = asyncHandler(async (req, res) => {
    const p = req.admin.permissions || {};
    const me = await Admin.findById(req.admin._id).select('navSeen');
    const seen = me?.navSeen || {};
    const since = (key) => ({ createdAt: { $gt: seen[key] || new Date(0) } });
    const zero = Promise.resolve(0);

    const tasks = {
        drivers: p.manageDrivers ? Driver.countDocuments({ status: 'pending', ...since('drivers') }) : zero,
        documents: p.verifyDocuments ? Document.countDocuments({ status: 'pending', ...since('documents') }) : zero,
        withdrawals: p.managePayments ? Withdrawal.countDocuments({ status: 'pending', ...since('withdrawals') }) : zero,
        support: p.handleSupport ? SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] }, ...since('support') }) : zero,
        emergencies: p.handleSupport ? Emergency.countDocuments({ status: 'active', ...since('emergencies') }) : zero,
    };
    const keys = Object.keys(tasks);
    const values = await Promise.all(keys.map((k) => tasks[k]));
    const counts = {};
    keys.forEach((k, i) => { counts[k] = values[i]; });
    return res.status(200).json(new apiResponse(200, counts, 'Nav counts fetched'));
});

// Mark a nav section as seen (clears its "new" badge for this admin).
const markNavSeen = asyncHandler(async (req, res) => {
    const { key } = req.body;
    if (!NAV_KEYS.includes(key)) throw new apiError(400, `key must be one of: ${NAV_KEYS.join(', ')}`);
    await Admin.findByIdAndUpdate(req.admin._id, { [`navSeen.${key}`]: new Date() });
    return res.status(200).json(new apiResponse(200, { key }, 'Marked seen'));
});

const getDashboardRecentTrips = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);

    const trips = await Trip.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name phone')
        .populate({ path: 'driverId', populate: { path: 'userId', select: 'name' } });

    const formatted = trips.map(t => ({
        _id: t._id,
        riderName: t.userId?.name,
        driverName: t.driverId?.userId?.name || null,
        vehicleType: t.vehicleType,
        status: t.status,
        finalPrice: t.finalPrice,
        offeredPrice: t.offeredPrice,
        createdAt: t.createdAt,
    }));

    return res.status(200).json(new apiResponse(200, formatted, 'Recent trips fetched'));
});

// Analytics

const getAnalyticsOverview = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const { match: dateMatch } = getAnalyticsRange(req.query);

    const [
        totalTrips,
        completedTrips,
        cancelledTrips,
        newUsers,
        activeUsers,
        activeDrivers,
        revenueResult,
    ] = await Promise.all([
        Trip.countDocuments({ createdAt: dateMatch }),
        Trip.countDocuments({ status: 'completed', createdAt: dateMatch }),
        Trip.countDocuments({ status: 'cancelled', createdAt: dateMatch }),
        User.countDocuments({ createdAt: dateMatch }),
        User.countDocuments({ accountStatus: 'active' }),
        Driver.countDocuments({ status: 'approved' }),
        Transaction.aggregate([
            { $match: { type: 'platform_fee', status: 'completed', createdAt: dateMatch } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    return res.status(200).json(new apiResponse(200, {
        totalTrips,
        completedTrips,
        cancelledTrips,
        newUsers,
        activeUsers,
        activeDrivers,
        totalRevenue: revenueResult[0]?.total || 0,
    }, 'Analytics overview fetched'));
});

const getAnalyticsTrips = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const { match: dateMatch, groupByMonth } = getAnalyticsRange(req.query);

    const groupId = groupByMonth
        ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
        : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

    const [tripsData, revenueData] = await Promise.all([
        Trip.aggregate([
            { $match: { createdAt: dateMatch } },
            {
                $group: {
                    _id: groupId,
                    trips: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
        Transaction.aggregate([
            { $match: { type: 'platform_fee', status: 'completed', createdAt: dateMatch } },
            {
                $group: {
                    _id: groupByMonth
                        ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
                        : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
                    revenue: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
    ]);

    const revenueMap = new Map();
    revenueData.forEach(item => {
        const key = groupByMonth
            ? `${item._id.year}-${item._id.month}`
            : `${item._id.year}-${item._id.month}-${item._id.day}`;
        revenueMap.set(key, item.revenue);
    });

    const formatted = tripsData.map(item => {
        const key = groupByMonth
            ? `${item._id.year}-${item._id.month}`
            : `${item._id.year}-${item._id.month}-${item._id.day}`;
        const label = groupByMonth
            ? MONTH_NAMES[item._id.month - 1]
            : `${item._id.day}/${item._id.month}`;
        return {
            date: label,
            trips: item.trips,
            completed: item.completed,
            cancelled: item.cancelled,
            revenue: revenueMap.get(key) || 0,
        };
    });

    return res.status(200).json(new apiResponse(200, formatted, 'Trips analytics fetched'));
});

const getAnalyticsUsers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const { match: dateMatch, groupByMonth } = getAnalyticsRange(req.query);

    const groupId = groupByMonth
        ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
        : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

    const [usersData, driversData] = await Promise.all([
        User.aggregate([
            { $match: { createdAt: dateMatch } },
            { $group: { _id: groupId, users: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
        Driver.aggregate([
            { $match: { createdAt: dateMatch } },
            { $group: { _id: groupId, drivers: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
    ]);

    const driversMap = new Map();
    driversData.forEach(item => {
        const key = groupByMonth
            ? `${item._id.year}-${item._id.month}`
            : `${item._id.year}-${item._id.month}-${item._id.day}`;
        driversMap.set(key, item.drivers);
    });

    const formatted = usersData.map(item => {
        const key = groupByMonth
            ? `${item._id.year}-${item._id.month}`
            : `${item._id.year}-${item._id.month}-${item._id.day}`;
        const label = groupByMonth
            ? MONTH_NAMES[item._id.month - 1]
            : `${item._id.day}/${item._id.month}`;
        return {
            date: label,
            users: item.users,
            drivers: driversMap.get(key) || 0,
        };
    });

    return res.status(200).json(new apiResponse(200, formatted, 'Users analytics fetched'));
});

const getAnalyticsTopDrivers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const drivers = await Driver.find({ status: 'approved' })
        .sort({ totalRides: -1, rating: -1 })
        .limit(10)
        .populate('userId', 'name phone avatarUrl');

    const formatted = drivers.map(d => ({
        _id: d._id,
        name: d.userId?.name || 'Unknown',
        phone: d.userId?.phone,
        avatarUrl: d.userId?.avatarUrl,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        rides: d.totalRides,
        rating: d.rating,
        earnings: d.earnings,
    }));

    return res.status(200).json(new apiResponse(200, formatted, 'Top drivers fetched'));
});

const getAnalyticsVehicleDistribution = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const { period = 'month' } = req.query;
    const startDate = getPeriodStart(period);

    const data = await Trip.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    const VEHICLE_COLORS = {
        bike: '#6366f1', tuktuk: '#f59e0b', taxi: '#10b981',
        scooter: '#8b5cf6', comfort: '#ec4899', tuktuk_delivery: '#3b82f6',
    };

    const formatted = data.map(item => ({
        name: item._id,
        value: total > 0 ? Math.round((item.count / total) * 100) : 0,
        count: item.count,
        color: VEHICLE_COLORS[item._id] || '#9ca3af',
    }));

    return res.status(200).json(new apiResponse(200, formatted, 'Vehicle distribution fetched'));
});

// Users

const getUsers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, search, role, userType, verified, joinedFrom, joinedTo } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.accountStatus = status;
    if (userType) filter.userType = userType;
    if (role) filter.role = role;
    if (verified === 'true') filter.isPhoneVerified = true;
    else if (verified === 'false') filter.isPhoneVerified = false;
    const minRating = parseFloat(req.query.minRating);
    const maxRating = parseFloat(req.query.maxRating);
    if (!Number.isNaN(minRating) || !Number.isNaN(maxRating)) {
        filter['rating.average'] = {};
        if (!Number.isNaN(minRating)) filter['rating.average'].$gte = minRating;
        if (!Number.isNaN(maxRating)) filter['rating.average'].$lt = maxRating;
    }
    if (joinedFrom || joinedTo) {
        filter.createdAt = {};
        if (joinedFrom) filter.createdAt.$gte = new Date(joinedFrom);
        if (joinedTo) filter.createdAt.$lte = new Date(joinedTo);
    }
    if (search) {
        filter.$or = [
            { name: { $regex: escapeRegex(search), $options: 'i' } },
            { phone: { $regex: escapeRegex(search), $options: 'i' } },
            { email: { $regex: escapeRegex(search), $options: 'i' } },
        ];
    }

    const [users, total] = await Promise.all([
        User.find(filter).select('-password -refreshToken -otp').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        User.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, users, 'Users fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getUserById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    const user = await User.findById(req.params.id)
        .select('-password -refreshToken -otp')
        .populate('driverProfile')
        .populate('subscription');
    if (!user) throw new apiError(404, 'User not found');
    return res.status(200).json(new apiResponse(200, user, 'User fetched'));
});

const updateUserStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');
    const { status, accountStatus } = req.body;
    const newStatus = accountStatus || status;
    const validStatuses = ['active', 'suspended', 'banned'];
    if (!validStatuses.includes(newStatus)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const user = await User.findByIdAndUpdate(req.params.id, { accountStatus: newStatus }, { new: true })
        .select('-password -refreshToken -otp');
    if (!user) throw new apiError(404, 'User not found');

    return res.status(200).json(new apiResponse(200, user, `User status updated to ${newStatus}`));
});

const updateUser = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    // Only these profile fields are editable from the admin settings popup.
    const allowed = ['name', 'email', 'phone', 'gender', 'dateOfBirth', 'userType', 'accountStatus', 'preferredPaymentMethod'];
    const enums = {
        gender: ['female', 'male', 'other'],
        userType: ['regular', 'parent', 'business'],
        accountStatus: ['active', 'suspended', 'banned'],
        preferredPaymentMethod: ['cash', 'khalti', 'esewa', 'wallet'],
    };

    const update = {};
    for (const key of allowed) {
        if (req.body[key] === undefined) continue;
        const value = req.body[key];
        if (enums[key] && value !== '' && !enums[key].includes(value)) {
            throw new apiError(400, `${key} must be one of: ${enums[key].join(', ')}`);
        }
        update[key] = value === '' ? undefined : value;
    }

    if (!Object.keys(update).length) throw new apiError(400, 'No editable fields provided');

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        .select('-password -refreshToken -otp');
    if (!user) throw new apiError(404, 'User not found');

    return res.status(200).json(new apiResponse(200, user, 'User updated'));
});

const getUserTrips = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (parseInt(page) - 1) * limitNum;

    const [trips, total] = await Promise.all([
        Trip.find({ userId: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('driverId', 'vehicleType vehiclePlate'),
        Trip.countDocuments({ userId: req.params.id }),
    ]);

    return res.status(200).json(
        new apiResponse(200, trips, 'User trips fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getUserTransactions = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (parseInt(page) - 1) * limitNum;

    const [transactions, total] = await Promise.all([
        Transaction.find({ userId: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Transaction.countDocuments({ userId: req.params.id }),
    ]);

    return res.status(200).json(
        new apiResponse(200, transactions, 'User transactions fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

// Suppliers

const getSuppliers = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'manageSuppliers')) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, search, city, plan, verified } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (city) filter.city = city;
    if (plan) filter.plan = plan;
    if (verified === 'true') filter.isVerified = true;
    else if (verified === 'false') filter.isVerified = false;
    if (search) {
        filter.$or = [
            { businessName: { $regex: escapeRegex(search), $options: 'i' } },
            { contactPerson: { $regex: escapeRegex(search), $options: 'i' } },
            { phone: { $regex: escapeRegex(search), $options: 'i' } },
            { email: { $regex: escapeRegex(search), $options: 'i' } },
        ];
    }

    const [suppliers, total] = await Promise.all([
        Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Supplier.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, suppliers, 'Suppliers fetched', { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getSupplierById = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'manageSuppliers')) throw new apiError(403, 'Insufficient permissions');

    const supplier = await Supplier.findById(req.params.id).populate('verifiedBy', 'name email');
    if (!supplier) throw new apiError(404, 'Supplier not found');
    return res.status(200).json(new apiResponse(200, supplier, 'Supplier fetched'));
});

const verifySupplier = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'manageSuppliers')) throw new apiError(403, 'Insufficient permissions');

    const supplier = await Supplier.findByIdAndUpdate(
        req.params.id,
        { isVerified: true, verifiedBy: req.admin._id },
        { new: true }
    );
    if (!supplier) throw new apiError(404, 'Supplier not found');
    return res.status(200).json(new apiResponse(200, supplier, 'Supplier verified'));
});

const updateSupplierPlan = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'manageSuppliers')) throw new apiError(403, 'Insufficient permissions');

    const { plan } = req.body;
    const validPlans = ['basic', 'premium'];
    if (!validPlans.includes(plan)) throw new apiError(400, `Plan must be one of: ${validPlans.join(', ')}`);

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { plan }, { new: true });
    if (!supplier) throw new apiError(404, 'Supplier not found');
    return res.status(200).json(new apiResponse(200, supplier, `Supplier plan updated to ${plan}`));
});

const toggleSupplierStatus = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'manageSuppliers')) throw new apiError(403, 'Insufficient permissions');

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') throw new apiError(400, 'isActive must be a boolean');

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!supplier) throw new apiError(404, 'Supplier not found');
    return res.status(200).json(new apiResponse(200, supplier, `Supplier ${isActive ? 'activated' : 'deactivated'}`));
});

// Drivers

const getDrivers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, search, vehicleType, verified } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (vehicleType) filter.vehicleType = vehicleType;
    if (verified === 'true') filter.isVerified = true;
    else if (verified === 'false') filter.isVerified = false;
    const minRating = parseFloat(req.query.minRating);
    const maxRating = parseFloat(req.query.maxRating);
    if (!Number.isNaN(minRating) || !Number.isNaN(maxRating)) {
        filter.rating = {};
        if (!Number.isNaN(minRating)) filter.rating.$gte = minRating;
        if (!Number.isNaN(maxRating)) filter.rating.$lt = maxRating;
    }
    const minRides = parseInt(req.query.minRides);
    const maxRides = parseInt(req.query.maxRides);
    if (!Number.isNaN(minRides) || !Number.isNaN(maxRides)) {
        filter.totalRides = {};
        if (!Number.isNaN(minRides)) filter.totalRides.$gte = minRides;
        if (!Number.isNaN(maxRides)) filter.totalRides.$lte = maxRides;
    }
    const minEarnings = parseFloat(req.query.minEarnings);
    const maxEarnings = parseFloat(req.query.maxEarnings);
    if (!Number.isNaN(minEarnings) || !Number.isNaN(maxEarnings)) {
        filter.earnings = {};
        if (!Number.isNaN(minEarnings)) filter.earnings.$gte = minEarnings;
        if (!Number.isNaN(maxEarnings)) filter.earnings.$lte = maxEarnings;
    }

    let query = Driver.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name phone email avatarUrl accountStatus');

    const [drivers, total] = await Promise.all([query, Driver.countDocuments(filter)]);

    return res.status(200).json(
        new apiResponse(200, drivers, 'Drivers fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getDriverById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const driver = await Driver.findById(req.params.id)
        .populate('userId', 'name phone email avatarUrl accountStatus');
    if (!driver) throw new apiError(404, 'Driver not found');

    const documents = await Document.find({ driverId: driver._id });
    return res.status(200).json(new apiResponse(200, { driver, documents }, 'Driver fetched'));
});

const updateDriverStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');
    const { status } = req.body;
    const validStatuses = ['approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(status)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { status, isVerified: status === 'approved' },
        { new: true }
    );
    if (!driver) throw new apiError(404, 'Driver not found');

    if (status === 'approved') {
        await User.findByIdAndUpdate(driver.userId, { role: 'driver' });
    } else if (status === 'rejected' || status === 'suspended') {
        await User.findByIdAndUpdate(driver.userId, { role: 'passenger' });
    }

    const notifTitle = status === 'approved' ? 'Account Approved' : status === 'rejected' ? 'Account Rejected' : 'Account Suspended';
    const notifBody = status === 'approved'
        ? 'Your driver account has been approved. You can now go online and accept trips.'
        : `Your driver account has been ${status}.`;
    const notifType = status === 'approved' ? 'account_approved' : status === 'rejected' ? 'account_rejected' : 'account_suspended';

    await Notification.create({
        userId: driver.userId,
        title: notifTitle,
        body: notifBody,
        type: notifType,
        refId: driver._id,
    });

    return res.status(200).json(new apiResponse(200, driver, `Driver status updated to ${status}`));
});

const updateDriver = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    // Editable vehicle fields from the admin settings popup.
    const allowed = ['vehicleType', 'vehiclePlate', 'vehicleModel', 'vehicleColor', 'vehicleYear', 'vehicleCapacity'];
    const vehicleTypes = ['bike', 'scooter', 'tuktuk', 'tuktuk_delivery', 'taxi', 'comfort'];

    const update = {};
    for (const key of allowed) {
        if (req.body[key] === undefined) continue;
        const value = req.body[key];
        if (key === 'vehicleType' && value !== '' && !vehicleTypes.includes(value)) {
            throw new apiError(400, `vehicleType must be one of: ${vehicleTypes.join(', ')}`);
        }
        update[key] = value === '' ? null : value;
    }

    if (!Object.keys(update).length) throw new apiError(400, 'No editable fields provided');

    const driver = await Driver.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        .populate('userId', 'name phone email gender avatarUrl');
    if (!driver) throw new apiError(404, 'Driver not found');

    return res.status(200).json(new apiResponse(200, driver, 'Driver updated'));
});

const deleteDriver = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) throw new apiError(404, 'Driver not found');

    // The person reverts to a plain passenger once their driver profile is removed.
    await User.findByIdAndUpdate(driver.userId, { role: 'passenger', driverProfile: null });

    return res.status(200).json(new apiResponse(200, { _id: driver._id }, 'Driver deleted'));
});

const verifyDriver = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { isVerified: true, status: 'approved' },
        { new: true }
    ).populate('userId', 'name phone');
    if (!driver) throw new apiError(404, 'Driver not found');

    await Notification.create({
        userId: driver.userId._id,
        title: 'Account Verified',
        body: 'Your driver account has been verified and approved.',
        type: 'account_approved',
        refId: driver._id,
    });

    return res.status(200).json(new apiResponse(200, driver, 'Driver verified'));
});

const getDriverDocuments = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const documents = await Document.find({ driverId: req.params.id }).sort({ createdAt: -1 });
    return res.status(200).json(new apiResponse(200, documents, 'Driver documents fetched'));
});

const getDriverTrips = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (parseInt(page) - 1) * limitNum;

    const driver = await Driver.findById(req.params.id);
    if (!driver) throw new apiError(404, 'Driver not found');

    const [trips, total] = await Promise.all([
        Trip.find({ driverId: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone'),
        Trip.countDocuments({ driverId: req.params.id }),
    ]);

    return res.status(200).json(
        new apiResponse(200, trips, 'Driver trips fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getDriverEarnings = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const driver = await Driver.findById(req.params.id);
    if (!driver) throw new apiError(404, 'Driver not found');

    const [transactions, completedTrips, earningsResult] = await Promise.all([
        Transaction.find({ driverId: req.params.id, type: 'trip_earning', status: 'completed' })
            .sort({ createdAt: -1 })
            .limit(20),
        Trip.countDocuments({ driverId: req.params.id, status: 'completed' }),
        Transaction.aggregate([
            { $match: { driverId: driver._id, type: 'trip_earning', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    return res.status(200).json(new apiResponse(200, {
        totalEarnings: driver.earnings,
        totalRides: driver.totalRides,
        completedTrips,
        recentTransactions: transactions,
        calculatedEarnings: earningsResult[0]?.total || 0,
    }, 'Driver earnings fetched'));
});

// Driver payouts (grants & withdrawals)

// Admin grants / credits money to a driver's withdrawable wallet balance.
const grantDriverMoney = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const { amount, note } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) throw new apiError(400, 'Valid amount is required');
    if (parsedAmount > 1000000) throw new apiError(400, 'Maximum grant is NPR 1,000,000');

    const trimmedNote = note?.trim() || null;

    const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { $inc: { walletBalance: parsedAmount } },
        { new: true }
    ).populate('userId', 'name email');
    if (!driver) throw new apiError(404, 'Driver not found');

    const transaction = await Transaction.create({
        driverId: driver._id,
        amount: parsedAmount,
        type: 'admin_credit',
        method: 'wallet',
        status: 'completed',
        note: trimmedNote,
    });

    // In-app notification (carries the note). _skipEmail: the dedicated grant
    // email below is richer than the generic notification email, so suppress
    // the auto-email from the Notification post-save hook for this one.
    const grantNotification = new Notification({
        userId: driver.userId._id,
        title: 'Money Added to Your Wallet',
        body: `NPR ${parsedAmount} has been credited to your wallet${trimmedNote ? ` - ${trimmedNote}` : ''}.`,
        type: 'payment',
        refId: transaction._id,
    });
    grantNotification._skipEmail = true;
    await grantNotification.save();

    // Email with the grant template (fire-and-forget; won't block the response)
    if (driver.userId?.email) {
        sendEmail({
            sendTo: driver.userId.email,
            subject: 'Funds added to your Tempu wallet',
            html: grantEmailTemplate({ name: driver.userId.name, amount: parsedAmount, note: trimmedNote, balance: driver.walletBalance, reference: transaction._id }),
        }).catch((err) => console.error('Grant email error:', err?.message));
    }

    return res.status(200).json(new apiResponse(200, {
        walletBalance: driver.walletBalance,
        transaction,
    }, `NPR ${parsedAmount} granted to driver`));
});

const getWithdrawals = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    const [withdrawals, total] = await Promise.all([
        Withdrawal.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate({ path: 'driverId', select: 'earnings walletBalance userId', populate: { path: 'userId', select: 'name phone avatarUrl' } })
            .populate('processedBy', 'name'),
        Withdrawal.countDocuments(filter),
    ]);

    return res.status(200).json(new apiResponse(200, {
        withdrawals,
        pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
    }, 'Withdrawals fetched'));
});

// Process a withdrawal: approve, reject (refunds the held amount) or mark paid.
const processWithdrawal = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const { action, adminNote } = req.body;
    if (!['approve', 'reject', 'paid'].includes(action)) {
        throw new apiError(400, 'Action must be approve, reject or paid');
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) throw new apiError(404, 'Withdrawal not found');
    if (['rejected', 'paid'].includes(withdrawal.status)) {
        throw new apiError(400, `Withdrawal is already ${withdrawal.status}`);
    }

    if (action === 'approve') {
        if (withdrawal.status !== 'pending') throw new apiError(400, 'Only pending requests can be approved');
        withdrawal.status = 'approved';
    } else if (action === 'reject') {
        // Refund the held amount back to the driver's wallet.
        await Driver.findByIdAndUpdate(withdrawal.driverId, { $inc: { walletBalance: withdrawal.amount } });
        withdrawal.status = 'rejected';
    } else if (action === 'paid') {
        const transaction = await Transaction.create({
            driverId: withdrawal.driverId,
            amount: withdrawal.amount,
            type: 'wallet_withdrawal',
            method: withdrawal.method === 'bank' ? 'wallet' : withdrawal.method,
            status: 'completed',
        });
        withdrawal.status = 'paid';
        withdrawal.transactionId = transaction._id;
    }

    withdrawal.adminNote = adminNote?.trim() || withdrawal.adminNote;
    withdrawal.processedBy = req.admin._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    const driver = await Driver.findById(withdrawal.driverId).select('userId');
    if (driver) {
        const messages = {
            approve: `Your withdrawal of NPR ${withdrawal.amount} has been approved and is being processed.`,
            reject: `Your withdrawal of NPR ${withdrawal.amount} was rejected and refunded to your wallet${adminNote ? ` - ${adminNote}` : ''}.`,
            paid: `Your withdrawal of NPR ${withdrawal.amount} has been paid out.`,
        };
        await Notification.create({
            userId: driver.userId,
            title: 'Withdrawal Update',
            body: messages[action],
            type: 'payment',
            refId: withdrawal._id,
        });
    }

    return res.status(200).json(new apiResponse(200, withdrawal, `Withdrawal ${withdrawal.status}`));
});

// Pricing control

// Returns the singleton pricing config, creating it with defaults on first access.
const getPricing = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    let pricing = await Pricing.findOne({ key: 'global' });
    if (!pricing) pricing = await Pricing.create(defaultPricing());

    // Backfill any vehicle types missing from an older-shaped document so the
    // admin UI (which iterates the current vehicle list) always has data.
    const defaults = defaultPricing();
    let changed = false;
    for (const k of VEHICLE_TYPES) {
        if (!pricing.vehicles?.[k]) { pricing.vehicles[k] = defaults.vehicles[k]; changed = true; }
        for (const city of pricing.cities) {
            if (!city.vehicleOverrides?.[k]) { city.vehicleOverrides[k] = { override: false, baseFare: 0 }; changed = true; }
        }
    }
    if (changed) { pricing.markModified('vehicles'); pricing.markModified('cities'); await pricing.save(); }

    return res.status(200).json(new apiResponse(200, pricing, 'Pricing fetched'));
});

// Replaces the editable config. The admin UI sends the whole object; we assign
// known top-level sections and let the schema coerce/validate types.
const updatePricing = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    let pricing = await Pricing.findOne({ key: 'global' });
    if (!pricing) pricing = new Pricing(defaultPricing());

    const body = req.body || {};
    const scalarFields = ['electricityCost', 'vatPercent', 'commissionPercent', 'profitMarginPercent'];
    for (const f of scalarFields) {
        if (body[f] != null) {
            const v = parseFloat(body[f]);
            if (isNaN(v) || v < 0) throw new apiError(400, `Invalid ${f}`);
            pricing[f] = v;
        }
    }

    const objectFields = ['premium', 'longDistanceDiscount', 'driverFee', 'vehicles'];
    for (const f of objectFields) {
        if (body[f] && typeof body[f] === 'object') {
            pricing[f] = { ...pricing[f]?.toObject?.() ?? pricing[f], ...body[f] };
            pricing.markModified(f);
        }
    }

    if (Array.isArray(body.timeSlots)) {
        pricing.timeSlots = body.timeSlots;
        pricing.markModified('timeSlots');
    }
    if (Array.isArray(body.cities)) {
        pricing.cities = body.cities;
        pricing.markModified('cities');
    }

    pricing.updatedBy = req.admin._id;
    await pricing.save();

    return res.status(200).json(new apiResponse(200, pricing, 'Pricing updated'));
});

// Emergency / SOS

const getEmergencies = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    const [emergencies, total, activeCount] = await Promise.all([
        Emergency.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone avatarUrl')
            .populate('handledBy', 'name')
            .populate('assignedTo', 'name'),
        Emergency.countDocuments(filter),
        Emergency.countDocuments({ status: 'active' }),
    ]);

    return res.status(200).json(new apiResponse(200, {
        emergencies,
        activeCount,
        pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
    }, 'Emergencies fetched'));
});

// Fully-populated single emergency for the admin detail view.
async function buildEmergencyPayload(id) {
    const emergency = await Emergency.findById(id)
        .populate('userId', 'name phone email avatarUrl')
        .populate({ path: 'driverId', select: 'userId vehicleType vehiclePlate vehicleModel vehicleColor status rating', populate: { path: 'userId', select: 'name phone email' } })
        .populate('handledBy', 'name')
        .populate('assignedTo', 'name')
        .populate('notes.authorId', 'name');
    if (!emergency) return null;
    return emergency.toObject();
}

const getEmergencyById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const payload = await buildEmergencyPayload(req.params.id);
    if (!payload) throw new apiError(404, 'Emergency not found');
    return res.status(200).json(new apiResponse(200, payload, 'Emergency fetched'));
});

const assignEmergency = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { adminId } = req.body;
    const assigneeId = adminId || req.admin._id;

    const emergency = await Emergency.findByIdAndUpdate(
        req.params.id,
        { assignedTo: assigneeId },
        { new: true }
    );
    if (!emergency) throw new apiError(404, 'Emergency not found');

    // In-app notify the assignee (skip when self-assigning).
    if (String(assigneeId) !== String(req.admin._id)) {
        await AdminNotification.create({
            adminId: assigneeId,
            title: 'Emergency assigned to you',
            body: 'An SOS alert has been assigned to you for follow-up.',
            type: 'emergency',
            link: `/emergencies?focus=${emergency._id}`,
        }).catch(() => {});
    }

    return res.status(200).json(new apiResponse(200, await buildEmergencyPayload(emergency._id), 'Emergency assigned'));
});

const addEmergencyNote = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const body = (req.body.body || '').trim();
    if (!body) throw new apiError(400, 'Note cannot be empty');

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) throw new apiError(404, 'Emergency not found');

    emergency.notes.push({ authorId: req.admin._id, body });
    await emergency.save();

    return res.status(200).json(new apiResponse(200, await buildEmergencyPayload(emergency._id), 'Note added'));
});

const updateEmergency = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');

    const { status } = req.body;
    if (!['acknowledged', 'resolved'].includes(status)) {
        throw new apiError(400, 'Status must be acknowledged or resolved');
    }

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) throw new apiError(404, 'Emergency not found');

    emergency.status = status;
    emergency.handledBy = req.admin._id;
    if (status === 'acknowledged' && !emergency.acknowledgedAt) emergency.acknowledgedAt = new Date();
    if (status === 'resolved') emergency.resolvedAt = new Date();
    await emergency.save();

    // Reassure the person who raised it. Suppress the generic auto-email from
    // the Notification hook - we send a dedicated, richer SOS email below.
    const sosNotification = new Notification({
        userId: emergency.userId,
        title: status === 'resolved' ? 'Emergency Resolved' : 'Help Is On The Way',
        body: status === 'resolved'
            ? 'Your emergency alert has been resolved by our team.'
            : 'Our team has received your emergency alert and is responding.',
        type: 'general',
        refId: emergency._id,
    });
    sosNotification._skipEmail = true;
    await sosNotification.save();

    // Dedicated SOS email to the customer (fire-and-forget; won't block response).
    const sosUser = await User.findById(emergency.userId).select('name email');
    if (sosUser?.email) {
        sendEmail({
            sendTo: sosUser.email,
            subject: status === 'resolved' ? 'Your Tempu SOS has been resolved' : 'Tempu is responding to your SOS',
            html: emergencyEmailTemplate({ name: sosUser.name, status }),
        }).catch((err) => console.error('SOS email error:', err?.message));
    }

    return res.status(200).json(new apiResponse(200, emergency, `Emergency ${status}`));
});

// Documents

const getAllDocuments = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.verifyDocuments) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    const [documents, total] = await Promise.all([
        Document.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate({
                path: 'driverId',
                select: 'vehicleType vehiclePlate userId',
                populate: { path: 'userId', select: 'name phone' },
            }),
        Document.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, documents, 'Documents fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const verifyDocument = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.verifyDocuments) throw new apiError(403, 'Insufficient permissions');

    const document = await Document.findByIdAndUpdate(
        req.params.id,
        { status: 'approved', verifiedBy: req.admin._id, verifiedAt: new Date(), rejectionReason: null },
        { new: true }
    ).populate({ path: 'driverId', populate: { path: 'userId', select: 'name _id' } });

    if (!document) throw new apiError(404, 'Document not found');

    await Notification.create({
        userId: document.driverId.userId._id,
        title: 'Document Approved',
        body: `Your ${document.type.replace(/_/g, ' ')} has been approved`,
        type: 'document_verified',
        refId: document._id,
    });

    return res.status(200).json(new apiResponse(200, document, 'Document approved'));
});

const rejectDocument = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.verifyDocuments) throw new apiError(403, 'Insufficient permissions');
    const { reason, rejectionReason } = req.body;
    const rejectReason = rejectionReason || reason;

    const document = await Document.findByIdAndUpdate(
        req.params.id,
        { status: 'rejected', verifiedBy: req.admin._id, verifiedAt: new Date(), rejectionReason: rejectReason || null },
        { new: true }
    ).populate({ path: 'driverId', populate: { path: 'userId', select: 'name _id' } });

    if (!document) throw new apiError(404, 'Document not found');

    await Notification.create({
        userId: document.driverId.userId._id,
        title: 'Document Rejected',
        body: `Your ${document.type.replace(/_/g, ' ')} was rejected. ${rejectReason ? `Reason: ${rejectReason}` : ''}`,
        type: 'document_rejected',
        refId: document._id,
    });

    return res.status(200).json(new apiResponse(200, document, 'Document rejected'));
});

// Edit a document's type and/or expiry date. Gated by the editDocuments permission.
const updateDocument = asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin' && !req.admin.permissions.editDocuments) throw new apiError(403, 'Insufficient permissions');

    const updates = {};
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt || null;
    if (!Object.keys(updates).length) throw new apiError(400, 'Nothing to update');

    const document = await Document.findByIdAndUpdate(req.params.id, updates, { new: true })
        .populate({ path: 'driverId', select: 'vehicleType vehiclePlate userId', populate: { path: 'userId', select: 'name phone' } });
    if (!document) throw new apiError(404, 'Document not found');

    return res.status(200).json(new apiResponse(200, document, 'Document updated'));
});

// Permanently delete a document. Gated by the deleteDocuments permission.
const deleteDocument = asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin' && !req.admin.permissions.deleteDocuments) throw new apiError(403, 'Insufficient permissions');

    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) throw new apiError(404, 'Document not found');

    return res.status(200).json(new apiResponse(200, { _id: req.params.id }, 'Document deleted'));
});

// Trips

const getTrips = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageTrips) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, vehicleType, search, paymentMethod } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (vehicleType) filter.vehicleType = vehicleType;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const [trips, total] = await Promise.all([
        Trip.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone')
            .populate('driverId', 'vehiclePlate vehicleType'),
        Trip.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, trips, 'Trips fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getTripByIdAdmin = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageTrips) throw new apiError(403, 'Insufficient permissions');

    const trip = await Trip.findById(req.params.id)
        .populate('userId', 'name phone')
        .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone' } });
    if (!trip) throw new apiError(404, 'Trip not found');
    return res.status(200).json(new apiResponse(200, trip, 'Trip fetched'));
});

const getTripBids = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageTrips) throw new apiError(403, 'Insufficient permissions');

    const bids = await Bid.find({ tripId: req.params.id })
        .populate({ path: 'driverId', select: 'vehicleType vehiclePlate rating', populate: { path: 'userId', select: 'name phone' } })
        .sort({ createdAt: -1 });

    return res.status(200).json(new apiResponse(200, bids, 'Trip bids fetched'));
});

const cancelTripAdmin = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageTrips) throw new apiError(403, 'Insufficient permissions');

    const { reason } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) throw new apiError(404, 'Trip not found');
    if (['completed', 'cancelled'].includes(trip.status)) {
        throw new apiError(400, `Cannot cancel a trip with status: ${trip.status}`);
    }

    trip.status = 'cancelled';
    trip.cancelledBy = 'system';
    trip.cancelReason = reason || 'Cancelled by admin';
    trip.cancelledAt = new Date();
    await trip.save();

    if (trip.userId) {
        await Notification.create({
            userId: trip.userId,
            title: 'Trip Cancelled',
            body: reason || 'Your trip has been cancelled by admin.',
            type: 'trip_cancelled',
            refId: trip._id,
        });
    }

    return res.status(200).json(new apiResponse(200, trip, 'Trip cancelled'));
});

// Transactions

const getTransactions = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, type, method } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (method) filter.method = method;

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone')
            .populate({ path: 'driverId', select: 'vehicleType', populate: { path: 'userId', select: 'name phone' } })
            .populate('tripId', 'vehicleType pickup dropoff'),
        Transaction.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, transactions, 'Transactions fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const exportTransactions = asyncHandler(async (req, res) => {
    if (!can(req.admin, 'managePayments')) throw new apiError(403, 'Insufficient permissions');

    const { status, type, method } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (method) filter.method = method;

    // Quote fields containing CSV-significant chars, and neutralize spreadsheet
    // formula injection: a value beginning with = + - @ (or tab/CR) is prefixed
    // with a single quote so Excel/Sheets render it as text, not a formula.
    const escape = (v) => {
        let s = v == null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Transaction ID', 'Date', 'Type', 'Status', 'Method', 'Amount', 'User', 'Phone'];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.write(header.join(',') + '\r\n');

    // Stream every matching row with a cursor so the full result set is neither
    // truncated (no arbitrary cap) nor held in memory all at once.
    const cursor = Transaction.find(filter)
        .sort({ createdAt: -1 })
        .populate('userId', 'name phone')
        .cursor();

    for await (const t of cursor) {
        const row = [
            t._id,
            t.createdAt ? new Date(t.createdAt).toISOString() : '',
            t.type,
            t.status,
            t.method,
            t.amount,
            t.userId?.name,
            t.userId?.phone,
        ].map(escape).join(',');
        res.write(row + '\r\n');
    }

    return res.end();
});

const getTransactionById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const transaction = await Transaction.findById(req.params.id)
        .populate('userId', 'name phone')
        .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone' } })
        .populate('tripId');
    if (!transaction) throw new apiError(404, 'Transaction not found');
    return res.status(200).json(new apiResponse(200, transaction, 'Transaction fetched'));
});

const getTransactionSummary = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.managePayments) throw new apiError(403, 'Insufficient permissions');

    const [totalRevenue, pendingAmount, totalRefunds, methodBreakdown] = await Promise.all([
        Transaction.aggregate([
            { $match: { type: 'platform_fee', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Transaction.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Transaction.aggregate([
            { $match: { type: 'refund', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Transaction.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    return res.status(200).json(new apiResponse(200, {
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingAmount: pendingAmount[0]?.total || 0,
        totalRefunds: totalRefunds[0]?.total || 0,
        methodBreakdown,
    }, 'Transaction summary fetched'));
});

// Subscriptions

const getSubscriptions = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageSubscriptions) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, plan } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (plan) filter.plan = plan;

    const [subscriptions, total] = await Promise.all([
        Subscription.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone email')
            .populate({ path: 'primaryDriver', select: 'vehicleType vehiclePlate', populate: { path: 'userId', select: 'name phone' } }),
        Subscription.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, subscriptions, 'Subscriptions fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

const getSubscriptionById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageSubscriptions) throw new apiError(403, 'Insufficient permissions');

    const subscription = await Subscription.findById(req.params.id)
        .populate('userId', 'name phone email')
        .populate({ path: 'primaryDriver', populate: { path: 'userId', select: 'name phone' } });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription fetched'));
});

const updateSubscriptionStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageSubscriptions) throw new apiError(403, 'Insufficient permissions');

    const { status } = req.body;
    const validStatuses = ['active', 'paused', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const subscription = await Subscription.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!subscription) throw new apiError(404, 'Subscription not found');
    return res.status(200).json(new apiResponse(200, subscription, 'Subscription status updated'));
});

const assignDriverToSubscription = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageSubscriptions) throw new apiError(403, 'Insufficient permissions');

    const { driverId } = req.body;
    const driver = await Driver.findById(driverId);
    if (!driver) throw new apiError(404, 'Driver not found');
    if (driver.status !== 'approved') throw new apiError(400, 'Driver must be approved');

    const subscription = await Subscription.findByIdAndUpdate(
        req.params.id,
        { primaryDriver: driverId },
        { new: true }
    ).populate('userId', 'name phone');
    if (!subscription) throw new apiError(404, 'Subscription not found');

    return res.status(200).json(new apiResponse(200, subscription, 'Driver assigned to subscription'));
});

// Support

const getSupportTickets = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, category, assigned } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Role-based visibility, enforced on the server (never trusted to the client):
    //   - Moderators are HARD-scoped to their own assigned tickets. They never
    //     see the unassigned queue, and never another agent's conversations.
    //   - Supervisors (admin/superadmin) see everything, and can additionally
    //     view just the queue (assigned=unassigned) or just their own (=me).
    const isSupervisor = ['admin', 'superadmin'].includes(req.admin.role);

    if (!isSupervisor) {
        filter.assignedTo = req.admin._id;
    } else if (assigned === 'unassigned') {
        filter.assignedTo = null;              // the queue — supervisors only
    } else if (assigned === 'me') {
        filter.assignedTo = req.admin._id;
    }

    // Status-tab counts are scoped to what this admin is allowed to see.
    const countMatch = isSupervisor ? {} : { assignedTo: req.admin._id };

    const [tickets, total, byStatus] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone email avatarUrl')
            .populate('driverId', 'vehicleType vehiclePlate')
            .populate('assignedTo', 'name'),
        SupportTicket.countDocuments(filter),
        SupportTicket.aggregate([{ $match: countMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    byStatus.forEach((s) => { if (s._id in counts) counts[s._id] = s.count; counts.all += s.count; });

    return res.status(200).json(
        new apiResponse(200, { tickets, counts }, 'Support tickets fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

// Fully-populated ticket. Shared by all support endpoints so they always return
// the same shape to the admin UI. (Support capabilities are global now - see
// getSupportSettingsAdmin - not per ticket/user.)
async function buildTicketPayload(id) {
    const ticket = await SupportTicket.findById(id)
        .populate('userId', 'name phone email avatarUrl')
        .populate({ path: 'driverId', select: 'userId vehicleType vehiclePlate vehicleModel vehicleColor status rating', populate: { path: 'userId', select: 'name phone email' } })
        .populate('assignedTo', 'name')
        .populate('comments.authorId', 'name')
        .populate('comments.mentions', 'name');
    if (!ticket) return null;
    return ticket.toObject();
}

const getSupportTicketById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const payload = await buildTicketPayload(req.params.id);
    if (!payload) throw new apiError(404, 'Ticket not found');
    return res.status(200).json(new apiResponse(200, payload, 'Ticket fetched'));
});

const updateTicketStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');

    // A ticket can only be CLOSED once it has been resolved (fulfilled) - never
    // straight from open/in_progress. Reopening (back to open) is always allowed.
    if (status === 'closed' && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        throw new apiError(400, 'Resolve the ticket before closing it');
    }

    const wasActive = ['open', 'in_progress'].includes(ticket.status);
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = ticket.resolvedAt || new Date();
    if (status === 'closed') ticket.closedAt = new Date();
    if (status === 'open' || status === 'in_progress') {
        // Reopened: clear resolution/closure timestamps.
        ticket.resolvedAt = null;
        ticket.closedAt = null;
    }
    await ticket.save();

    // Resolving/closing an active ticket frees an agent slot - pull the queue.
    const nowInactive = ['resolved', 'closed'].includes(status);
    if (wasActive && nowInactive) processQueue().catch(() => {});

    return res.status(200).json(new apiResponse(200, ticket, 'Ticket updated'));
});

const replyToTicket = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const message = (req.body.message || '').trim();
    const hasFile = !!req.file;
    if (!message && !hasFile) throw new apiError(400, 'A message or attachment is required');

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');
    if (ticket.status === 'closed') throw new apiError(400, 'Cannot reply to a closed ticket');

    const entry = { senderId: req.admin._id, senderType: 'admin', message };
    if (hasFile) {
        const result = await uploadOnCloudinary(req.file.path);
        if (!result?.secure_url) throw new apiError(500, 'Failed to upload attachment');
        entry.attachmentUrl = result.secure_url;
        entry.attachmentType = (req.file.mimetype || '').startsWith('audio/') ? 'audio' : 'file';
        entry.attachmentName = req.file.originalname || null;
    }

    ticket.messages.push(entry);
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();

    return res.status(200).json(new apiResponse(200, ticket, 'Reply sent'));
});

const assignTicket = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { adminId } = req.body;
    const assigneeId = adminId || req.admin._id;

    const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { assignedTo: assigneeId },
        { new: true }
    ).populate('assignedTo', 'name');
    if (!ticket) throw new apiError(404, 'Ticket not found');

    const ref = String(ticket._id).slice(-8).toUpperCase();
    const link = `/support/${ticket._id}`;
    const base = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
    const isSelfAssign = String(assigneeId) === String(req.admin._id);
    const assigneeName = ticket.assignedTo?.name || 'an agent';

    // 1) Notify the assignee - including when they assign it to themselves.
    if (isSelfAssign) {
        await AdminNotification.create({
            adminId: assigneeId,
            title: 'You took a ticket',
            body: `You self-assigned ticket #${ref} - "${ticket.subject}".`,
            type: 'ticket_assigned',
            link,
            refId: ticket._id,
        });
    } else {
        await AdminNotification.create({
            adminId: assigneeId,
            title: 'Ticket assigned to you',
            body: `${req.admin.name} assigned ticket #${ref} - "${ticket.subject}".`,
            type: 'ticket_assigned',
            link,
            refId: ticket._id,
        });
        // Email too (best-effort).
        const assignee = await Admin.findById(assigneeId).select('name email');
        if (assignee?.email) {
            sendEmail({
                sendTo: assignee.email,
                subject: `Support ticket #${ref} assigned to you`,
                html: notificationEmailTemplate({
                    name: assignee.name,
                    title: `${req.admin.name} assigned a ticket to you`,
                    body: `Ticket "${ticket.subject}" is now yours.`,
                    link: base ? `${base}${link}` : null,
                    linkLabel: 'Open ticket',
                }),
            }).catch((err) => console.error('Assign email error:', err?.message));
        }
    }

    // 2) When a moderator does the assigning, keep admins/superadmins in the loop.
    if (req.admin.role === 'moderator') {
        const supervisors = await Admin.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
        const notes = supervisors
            .filter((s) => String(s._id) !== String(assigneeId))
            .map((s) => ({
                adminId: s._id,
                title: 'Ticket assigned by moderator',
                body: isSelfAssign
                    ? `${req.admin.name} self-assigned ticket #${ref} - "${ticket.subject}".`
                    : `${req.admin.name} assigned ticket #${ref} to ${assigneeName} - "${ticket.subject}".`,
                type: 'ticket_assigned',
                link,
                refId: ticket._id,
            }));
        if (notes.length) await AdminNotification.insertMany(notes);
    }

    // Post the agent's personal intro line to the thread (if they set one).
    postAgentGreeting(ticket._id, assigneeId).catch(() => {});

    return res.status(200).json(new apiResponse(200, ticket, 'Ticket assigned'));
});

// Admin's own in-app notifications
const getMyAdminNotifications = asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
        AdminNotification.find({ adminId: req.admin._id }).sort({ createdAt: -1 }).limit(30),
        AdminNotification.countDocuments({ adminId: req.admin._id, isRead: false }),
    ]);
    return res.status(200).json(new apiResponse(200, { items, unread }, 'Notifications fetched'));
});

const markMyNotificationRead = asyncHandler(async (req, res) => {
    await AdminNotification.findOneAndUpdate({ _id: req.params.id, adminId: req.admin._id }, { isRead: true });
    return res.status(200).json(new apiResponse(200, {}, 'Marked read'));
});

const markAllMyNotificationsRead = asyncHandler(async (req, res) => {
    await AdminNotification.updateMany({ adminId: req.admin._id, isRead: false }, { isRead: true });
    return res.status(200).json(new apiResponse(200, {}, 'All marked read'));
});

// Global support capabilities (one setting applied to ALL tickets/users).
const SUPPORT_PERMISSION_KEYS = ['voiceMessages', 'documents', 'audioCall', 'videoCall'];

const getSupportSettingsAdmin = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const s = await getSupportSettings();
    return res.status(200).json(new apiResponse(200, s, 'Support settings fetched'));
});

const updateSupportSettings = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const s = await getSupportSettings();
    SUPPORT_PERMISSION_KEYS.forEach((k) => {
        if (typeof req.body[k] === 'boolean') s[k] = req.body[k];
    });
    // Auto-assignment controls.
    if (typeof req.body.autoAssign === 'boolean') s.autoAssign = req.body.autoAssign;
    if (req.body.agentCapacity != null) {
        const cap = Number(req.body.agentCapacity);
        if (Number.isFinite(cap) && cap >= 1) s.agentCapacity = Math.floor(cap);
    }
    // Working hours shown to customers in the AI's opening greeting.
    if (typeof req.body.workingHours === 'string') s.workingHours = req.body.workingHours.trim();
    s.updatedBy = req.admin._id;
    await s.save();

    // Raising capacity / turning auto-assign on may let queued tickets flow.
    processQueue().catch(() => {});

    return res.status(200).json(new apiResponse(200, s, 'Support settings updated'));
});

// Admins who can be assigned to / mentioned on support tickets. Available to
// any support-capable admin (unlike the full admin list, which needs manageAdmins).
const getSupportAgents = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const agents = await Admin.find({ isActive: { $ne: false }, 'permissions.handleSupport': true })
        .select('name email role')
        .sort({ name: 1 })
        .lean();

    // Per-agent active load (open/in_progress) and support rating (avg + count).
    const [loads, ratings] = await Promise.all([
        SupportTicket.aggregate([
            { $match: { assignedTo: { $ne: null }, status: { $in: ['open', 'in_progress'] } } },
            { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
        ]),
        SupportTicket.aggregate([
            { $match: { 'rating.score': { $gte: 1 }, 'rating.agentId': { $ne: null } } },
            { $group: { _id: '$rating.agentId', avg: { $avg: '$rating.score' }, count: { $sum: 1 } } },
        ]),
    ]);
    const loadMap = new Map(loads.map((l) => [String(l._id), l.n]));
    const ratingMap = new Map(ratings.map((r) => [String(r._id), r]));

    const enriched = agents.map((a) => {
        const r = ratingMap.get(String(a._id));
        return {
            ...a,
            activeTickets: loadMap.get(String(a._id)) || 0,
            avgRating: r ? Math.round(r.avg * 10) / 10 : null,
            ratingCount: r ? r.count : 0,
        };
    });
    return res.status(200).json(new apiResponse(200, enriched, 'Support agents fetched'));
});

// One agent's rating summary + individual customer feedback, for their profile.
// An agent may view their OWN ratings; supervisors (admin/superadmin) any agent's.
const getSupportAgentRatings = asyncHandler(async (req, res) => {
    const isSupervisor = ['admin', 'superadmin'].includes(req.admin.role);
    if (!isSupervisor && !req.admin.permissions?.handleSupport) {
        throw new apiError(403, 'Insufficient permissions');
    }
    const agentId = req.params.id;
    if (!isSupervisor && String(agentId) !== String(req.admin._id)) {
        throw new apiError(403, 'You can only view your own ratings');
    }

    const tickets = await SupportTicket.find({ 'rating.agentId': agentId, 'rating.score': { $gte: 1 } })
        .select('subject rating userId guest')
        .populate('userId', 'name')
        .sort({ 'rating.ratedAt': -1 })
        .limit(100)
        .lean();

    const items = tickets.map((t) => ({
        ticketId: t._id,
        subject: t.subject,
        score: t.rating.score,
        comment: t.rating.comment || '',
        tags: t.rating.tags || [],
        ratedAt: t.rating.ratedAt,
        customer: t.userId?.name || t.guest?.name || 'Customer',
    }));
    const count = items.length;
    const avg = count ? Math.round((items.reduce((s, i) => s + i.score, 0) / count) * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].reduce((m, n) => { m[n] = items.filter((i) => i.score === n).length; return m; }, {});

    return res.status(200).json(
        new apiResponse(200, { summary: { avg, count, distribution }, items }, 'Agent ratings')
    );
});

// Internal note on a ticket (admin-only), with optional @mentions of other admins.
const addTicketComment = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { body } = req.body;
    if (!body || !body.trim()) throw new apiError(400, 'Comment body is required');

    // Normalise mentions to an array of ids; ignore self-mentions and dupes.
    const mentions = [...new Set((Array.isArray(req.body.mentions) ? req.body.mentions : [])
        .map((m) => String(m))
        .filter((m) => m && m !== String(req.admin._id)))];

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');

    ticket.comments.push({ authorId: req.admin._id, body: body.trim(), mentions });
    await ticket.save();

    // Email mentioned admins (best-effort; won't block the response).
    if (mentions.length) {
        const mentioned = await Admin.find({ _id: { $in: mentions } }).select('name email');
        const base = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
        const link = base ? `${base}/support/${ticket._id}` : null;
        const ref = String(ticket._id).slice(-8).toUpperCase();
        mentioned.forEach((a) => {
            if (!a.email) return;
            sendEmail({
                sendTo: a.email,
                subject: `You were mentioned on support ticket #${ref}`,
                html: notificationEmailTemplate({
                    name: a.name,
                    title: `${req.admin.name} mentioned you on a support ticket`,
                    body: `On "${ticket.subject}": ${body.trim()}`,
                    link,
                    linkLabel: 'Open ticket',
                }),
            }).catch((err) => console.error('Mention email error:', err?.message));
        });
    }

    return res.status(200).json(new apiResponse(200, await buildTicketPayload(ticket._id), 'Comment added'));
});

// Edit an internal note. Author-only. Customer-facing `messages` are NOT editable.
const editTicketComment = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { body } = req.body;
    if (!body || !body.trim()) throw new apiError(400, 'Comment body is required');

    const mentions = [...new Set((Array.isArray(req.body.mentions) ? req.body.mentions : [])
        .map((m) => String(m))
        .filter((m) => m && m !== String(req.admin._id)))];

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');

    const comment = ticket.comments.id(req.params.commentId);
    if (!comment) throw new apiError(404, 'Comment not found');
    if (String(comment.authorId) !== String(req.admin._id)) {
        throw new apiError(403, 'You can only edit your own notes');
    }

    comment.body = body.trim();
    comment.mentions = mentions;
    await ticket.save();

    return res.status(200).json(new apiResponse(200, await buildTicketPayload(ticket._id), 'Comment updated'));
});

// Delete an internal note. Author or superadmin. Customer-facing `messages` are NOT deletable.
const deleteTicketComment = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');

    const comment = ticket.comments.id(req.params.commentId);
    if (!comment) throw new apiError(404, 'Comment not found');

    const isAuthor = String(comment.authorId) === String(req.admin._id);
    if (!isAuthor && req.admin.role !== 'superadmin') {
        throw new apiError(403, 'You can only delete your own notes');
    }

    ticket.comments.pull(req.params.commentId);
    await ticket.save();

    return res.status(200).json(new apiResponse(200, await buildTicketPayload(ticket._id), 'Comment deleted'));
});

// Permanently delete a ticket. Restricted to super admins, and only once the
// ticket is closed - so an active conversation can never be wiped out.
const deleteTicket = asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new apiError(403, 'Only a super admin can delete tickets');

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');
    if (ticket.status !== 'closed') throw new apiError(400, 'Only closed tickets can be deleted');

    await ticket.deleteOne();
    return res.status(200).json(new apiResponse(200, { _id: ticket._id }, 'Ticket deleted'));
});

// ─── Notifications ────────────────────────────────────────────────────────────
// Notifications

// Send a notification to a group audience AND/OR a specific bulk-selected set of
// users, drivers and admins. Body:
//   { title, body, type,
//     target?: 'all'|'users'|'drivers',     // optional group broadcast (back-compat)
//     userIds?: [], driverIds?: [], adminIds?: [] }   // specific recipients
// Users/drivers get in-app Notification docs; admins get AdminNotification docs.
const broadcastNotification = asyncHandler(async (req, res) => {
    const { title, body, type = 'general' } = req.body;
    if (!title || !body) throw new apiError(400, 'Title and body are required');

    // `target`/`targetType` = optional group broadcast. null/'none' = specific-only.
    const audience = req.body.target || req.body.targetType || null;
    const pickIds = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);
    const reqUserIds = pickIds(req.body.userIds);
    const reqDriverIds = pickIds(req.body.driverIds);
    const reqAdminIds = pickIds(req.body.adminIds);

    const VALID_TYPES = ['trip_request','bid_received','bid_accepted','driver_arriving','trip_started','trip_completed','trip_cancelled','subscription_alert','document_verified','document_rejected','account_approved','account_suspended','account_rejected','payment','general'];
    const safeType = VALID_TYPES.includes(type) ? type : 'general';

    const userIdSet = new Set(reqUserIds);     // -> Notification { userId }
    const driverIdSet = new Set(reqDriverIds); // -> Notification { driverId }
    const adminIdSet = new Set(reqAdminIds);   // -> AdminNotification { adminId }

    if (audience === 'all' || audience === 'users') {
        const users = await User.find({ accountStatus: 'active' }).select('_id');
        users.forEach(u => userIdSet.add(u._id.toString()));
    }
    if (audience === 'all' || audience === 'drivers') {
        const drivers = await Driver.find({ status: 'approved' }).select('_id');
        drivers.forEach(d => driverIdSet.add(d._id.toString()));
    }

    const userDocs = [...userIdSet].map(userId => ({ userId, title, body, type: safeType }));
    const driverDocs = [...driverIdSet].map(driverId => ({ driverId, title, body, type: safeType }));
    const adminDocs = [...adminIdSet].map(adminId => ({ adminId, title, body, type: safeType }));

    if (!userDocs.length && !driverDocs.length && !adminDocs.length) {
        return res.status(200).json(new apiResponse(200, { sent: 0 }, 'No recipients selected'));
    }

    // insertMany is bulk + skips the per-doc email hook (in-app only - no email blast).
    await Promise.all([
        userDocs.length ? Notification.insertMany(userDocs, { ordered: false }) : null,
        driverDocs.length ? Notification.insertMany(driverDocs, { ordered: false }) : null,
        adminDocs.length ? AdminNotification.insertMany(adminDocs, { ordered: false }) : null,
    ]);

    const breakdown = { users: userDocs.length, drivers: driverDocs.length, admins: adminDocs.length };
    const sent = breakdown.users + breakdown.drivers + breakdown.admins;
    return res.status(200).json(new apiResponse(200, { sent, ...breakdown }, `Notification sent to ${sent} recipient(s)`));
});

// Searchable recipient list for the notification composer's pickers.
// GET /admin/notifications/recipients?type=users|drivers|admins&search=&limit=
const getNotificationRecipients = asyncHandler(async (req, res) => {
    const { type, search = '' } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const term = String(search).trim();
    const rx = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    let data = [];
    if (type === 'users') {
        const filter = rx ? { $or: [{ name: rx }, { phone: rx }, { email: rx }] } : {};
        const users = await User.find(filter).select('name phone email').sort({ createdAt: -1 }).limit(limit);
        data = users.map(u => ({ id: u._id, label: u.name || u.phone || 'User', sub: u.phone || u.email || '' }));
    } else if (type === 'drivers') {
        // Driver names live on the populated User, so when searching we scan a wider
        // set and filter in memory; otherwise just take the most recent `limit`.
        const drivers = await Driver.find({})
            .select('userId vehicleType vehiclePlate status')
            .populate({ path: 'userId', select: 'name phone email' })
            .sort({ createdAt: -1 })
            .limit(rx ? 500 : limit);
        let mapped = drivers
            .filter(d => d.userId)
            .map(d => ({
                id: d._id,
                label: d.userId.name || d.userId.phone || 'Driver',
                sub: [d.vehiclePlate || d.vehicleType, d.userId.phone].filter(Boolean).join(' · '),
                _hay: `${d.userId.name || ''} ${d.userId.phone || ''} ${d.vehiclePlate || ''}`,
            }));
        if (rx) mapped = mapped.filter(m => rx.test(m._hay));
        data = mapped.slice(0, limit).map(({ _hay, ...m }) => m);
    } else if (type === 'admins') {
        const filter = rx ? { $or: [{ name: rx }, { email: rx }] } : {};
        const admins = await Admin.find(filter).select('name email role').sort({ createdAt: -1 }).limit(limit);
        data = admins.map(a => ({ id: a._id, label: a.name || a.email || 'Admin', sub: [a.role, a.email].filter(Boolean).join(' · ') }));
    } else {
        throw new apiError(400, 'Invalid recipient type (use users|drivers|admins)');
    }

    return res.status(200).json(new apiResponse(200, data, 'Recipients fetched'));
});

const getNotificationHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = { type: 'general' };

    const [notifications, total] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone'),
        Notification.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, notifications, 'Notification history fetched', { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) })
    );
});

// DEV/TEST ONLY: seed a dummy pending document so the admin queue has data
// Creates (or reuses) a test driver + user and inserts one pending Document.
// Disabled in production. Call: POST /api/v1/admin/documents/seed-test
const seedTestDocument = asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        throw new apiError(403, 'Disabled in production');
    }

    const { type = 'driving_license', fileUrl } = req.body || {};
    // Default to a placeholder image; pass fileUrl (e.g. a .pdf) to test other formats.
    const docUrl = fileUrl || 'https://placehold.co/600x400/orange/white.png?text=Test+Document';

    // Reuse an existing user, or create a throwaway test user
    let user = await User.findOne().sort({ createdAt: 1 });
    if (!user) {
        user = await User.create({
            name: 'Test Driver',
            phone: '9700000001',
            email: 'test.driver@example.com',
            password: 'password',
            gender: 'male',
            isPhoneVerified: true,
            accountStatus: 'active',
        });
    }

    // Reuse a driver for that user, or create one
    let driver = await Driver.findOne({ userId: user._id });
    if (!driver) {
        const suffix = Date.now().toString().slice(-6);
        driver = await Driver.create({
            userId: user._id,
            vehicleType: 'taxi',
            vehiclePlate: `BA-${suffix}`,
            licenseNumber: `LIC-${suffix}`,
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            status: 'pending',
        });
    }

    // Insert / upsert a pending document with a public placeholder image
    const document = await Document.findOneAndUpdate(
        { driverId: driver._id, type },
        {
            fileUrl: docUrl,
            status: 'pending',
            rejectionReason: null,
            verifiedBy: null,
            verifiedAt: null,
        },
        { upsert: true, new: true }
    );

    const populated = await Document.findById(document._id).populate({
        path: 'driverId',
        select: 'vehicleType vehiclePlate userId',
        populate: { path: 'userId', select: 'name phone' },
    });

    return res.status(201).json(new apiResponse(201, populated, 'Test document created'));
});

export {
    login, logout, refreshAdminToken, getMe, updateMyProfile, uploadMyAvatar, deleteMyAvatar,
    createAdmin, listAdmins, updateAdminPermissions, toggleAdminStatus, deleteAdmin,
    getDashboardStats, getDashboardRecentTrips, getNavCounts, markNavSeen,
    getAnalyticsOverview, getAnalyticsTrips, getAnalyticsUsers, getAnalyticsTopDrivers, getAnalyticsVehicleDistribution,
    getUsers, getUserById, updateUserStatus, updateUser, getUserTrips, getUserTransactions,
    getSuppliers, getSupplierById, verifySupplier, updateSupplierPlan, toggleSupplierStatus,
    getDrivers, getDriverById, updateDriverStatus, updateDriver, deleteDriver, verifyDriver, getDriverDocuments, getDriverTrips, getDriverEarnings,
    grantDriverMoney, getWithdrawals, processWithdrawal,
    getPricing, updatePricing,
    getEmergencies, getEmergencyById, updateEmergency, assignEmergency, addEmergencyNote,
    getAllDocuments, verifyDocument, rejectDocument, updateDocument, deleteDocument, seedTestDocument,
    getTrips, getTripByIdAdmin, getTripBids, cancelTripAdmin,
    getTransactions, getTransactionById, getTransactionSummary, exportTransactions,
    getSubscriptions, getSubscriptionById, updateSubscriptionStatus, assignDriverToSubscription,
    getSupportTickets, getSupportTicketById, updateTicketStatus, replyToTicket, assignTicket, addTicketComment, editTicketComment, deleteTicketComment, deleteTicket, getSupportAgents, getSupportAgentRatings, getSupportSettingsAdmin, updateSupportSettings,
    broadcastNotification, getNotificationHistory, getNotificationRecipients,
    getMyAdminNotifications, markMyNotificationRead, markAllMyNotificationsRead,
};
