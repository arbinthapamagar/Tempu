import { Admin } from '../models/admin.model.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { Document } from '../models/doeument.model.js';
import { Trip } from '../models/trip.model.js';
import { Subscription } from '../models/subscription.model.js';
import { Transaction } from '../models/transaction.model.js';
import { SupportTicket } from '../models/supportTicket.model.js';
import { Notification } from '../models/notification.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

    // Only grant permissions the creator themselves has
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

    const admins = await Admin.find().select('-password -refreshToken').sort({ createdAt: -1 });
    return res.status(200).json(new apiResponse(200, admins, 'Admins fetched'));
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

// ─── Users ────────────────────────────────────────────────────────────────────

const getUsers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageUsers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, search, role } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.accountStatus = status;
    if (role) filter.role = role;
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
        new apiResponse(200, {
            users,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Users fetched')
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
    const { status } = req.body;
    const validStatuses = ['active', 'suspended', 'banned'];
    if (!validStatuses.includes(status)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const user = await User.findByIdAndUpdate(req.params.id, { accountStatus: status }, { new: true })
        .select('-password -refreshToken -otp');
    if (!user) throw new apiError(404, 'User not found');

    return res.status(200).json(new apiResponse(200, user, `User status updated to ${status}`));
});

// ─── Drivers ──────────────────────────────────────────────────────────────────

const getDrivers = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageDrivers) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, search } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    let query = Driver.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name phone email avatarUrl accountStatus');

    const [drivers, total] = await Promise.all([query, Driver.countDocuments(filter)]);

    return res.status(200).json(
        new apiResponse(200, {
            drivers,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Drivers fetched')
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

// ─── Documents ────────────────────────────────────────────────────────────────

const getPendingDocuments = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.verifyDocuments) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const [documents, total] = await Promise.all([
        Document.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate({
                path: 'driverId',
                select: 'vehicleType vehiclePlate userId',
                populate: { path: 'userId', select: 'name phone' },
            }),
        Document.countDocuments({ status: 'pending' }),
    ]);

    return res.status(200).json(
        new apiResponse(200, {
            documents,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Pending documents fetched')
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
    const { reason } = req.body;

    const document = await Document.findByIdAndUpdate(
        req.params.id,
        { status: 'rejected', verifiedBy: req.admin._id, verifiedAt: new Date(), rejectionReason: reason || null },
        { new: true }
    ).populate({ path: 'driverId', populate: { path: 'userId', select: 'name _id' } });

    if (!document) throw new apiError(404, 'Document not found');

    await Notification.create({
        userId: document.driverId.userId._id,
        title: 'Document Rejected',
        body: `Your ${document.type.replace(/_/g, ' ')} was rejected. ${reason ? `Reason: ${reason}` : ''}`,
        type: 'document_rejected',
        refId: document._id,
    });

    return res.status(200).json(new apiResponse(200, document, 'Document rejected'));
});

// ─── Trips ────────────────────────────────────────────────────────────────────

const getTrips = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.manageTrips) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, vehicleType } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (vehicleType) filter.vehicleType = vehicleType;

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
        new apiResponse(200, {
            trips,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Trips fetched')
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

// ─── Analytics ────────────────────────────────────────────────────────────────

const getAnalytics = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.viewAnalytics) throw new apiError(403, 'Insufficient permissions');

    const [
        totalUsers, activeUsers,
        totalDrivers, approvedDrivers, pendingDrivers,
        totalTrips, completedTrips, pendingTrips, cancelledTrips,
        totalSubscriptions, activeSubscriptions,
        revenueResult,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ accountStatus: 'active' }),
        Driver.countDocuments(),
        Driver.countDocuments({ status: 'approved' }),
        Driver.countDocuments({ status: 'pending' }),
        Trip.countDocuments(),
        Trip.countDocuments({ status: 'completed' }),
        Trip.countDocuments({ status: 'pending' }),
        Trip.countDocuments({ status: 'cancelled' }),
        Subscription.countDocuments(),
        Subscription.countDocuments({ status: 'active' }),
        Transaction.aggregate([
            { $match: { type: 'platform_fee', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    return res.status(200).json(
        new apiResponse(200, {
            users: { total: totalUsers, active: activeUsers },
            drivers: { total: totalDrivers, approved: approvedDrivers, pending: pendingDrivers },
            trips: { total: totalTrips, completed: completedTrips, pending: pendingTrips, cancelled: cancelledTrips },
            subscriptions: { total: totalSubscriptions, active: activeSubscriptions },
            revenue: { platformFees: revenueResult[0]?.total || 0 },
        }, 'Analytics fetched')
    );
});

// ─── Support ──────────────────────────────────────────────────────────────────

const getSupportTickets = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');

    const { page = 1, limit = 20, status, category } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [tickets, total] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'name phone')
            .populate('assignedTo', 'name'),
        SupportTicket.countDocuments(filter),
    ]);

    return res.status(200).json(
        new apiResponse(200, {
            tickets,
            pagination: { total, page: parseInt(page), limit: limitNum, pages: Math.ceil(total / limitNum) },
        }, 'Support tickets fetched')
    );
});

const getSupportTicketById = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const ticket = await SupportTicket.findById(req.params.id)
        .populate('userId', 'name phone')
        .populate('assignedTo', 'name');
    if (!ticket) throw new apiError(404, 'Ticket not found');
    return res.status(200).json(new apiResponse(200, ticket, 'Ticket fetched'));
});

const updateTicketStatus = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { status, assignTo } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) throw new apiError(400, `Status must be one of: ${validStatuses.join(', ')}`);

    const updates = { status };
    if (status === 'resolved') updates.resolvedAt = new Date();
    if (assignTo) updates.assignedTo = assignTo;

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ticket) throw new apiError(404, 'Ticket not found');
    return res.status(200).json(new apiResponse(200, ticket, 'Ticket status updated'));
});

const addAdminMessage = asyncHandler(async (req, res) => {
    if (!req.admin.permissions.handleSupport) throw new apiError(403, 'Insufficient permissions');
    const { message } = req.body;
    if (!message) throw new apiError(400, 'Message is required');

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new apiError(404, 'Ticket not found');
    if (ticket.status === 'closed') throw new apiError(400, 'Cannot reply to a closed ticket');

    ticket.messages.push({ senderId: req.admin._id, senderType: 'admin', message });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();

    return res.status(200).json(new apiResponse(200, ticket, 'Message added'));
});

export {
    login, logout, refreshAdminToken, getMe,
    createAdmin, listAdmins, updateAdminPermissions, toggleAdminStatus, deleteAdmin,
    getUsers, getUserById, updateUserStatus,
    getDrivers, getDriverById, updateDriverStatus,
    getPendingDocuments, verifyDocument, rejectDocument,
    getTrips, getTripByIdAdmin, getAnalytics,
    getSupportTickets, getSupportTicketById, updateTicketStatus, addAdminMessage,
};
