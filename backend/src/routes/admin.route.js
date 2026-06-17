import { Router } from 'express';
import { verifyAdminJwt } from '../middlewares/admin.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
    login, logout, refreshAdminToken, getMe, updateMyProfile, uploadMyAvatar, deleteMyAvatar,
    createAdmin, listAdmins, updateAdminPermissions, toggleAdminStatus, deleteAdmin,
    getDashboardStats, getDashboardRecentTrips, getNavCounts, markNavSeen,
    getAnalyticsOverview, getAnalyticsTrips, getAnalyticsUsers, getAnalyticsTopDrivers, getAnalyticsVehicleDistribution,
    getUsers, getUserById, updateUserStatus, getUserTrips, getUserTransactions,
    getDrivers, getDriverById, updateDriverStatus, verifyDriver, getDriverDocuments, getDriverTrips, getDriverEarnings,
    grantDriverMoney, getWithdrawals, processWithdrawal,
    getPricing, updatePricing,
    getEmergencies, updateEmergency,
    getAllDocuments, verifyDocument, rejectDocument, seedTestDocument,
    getTrips, getTripByIdAdmin, getTripBids, cancelTripAdmin,
    getTransactions, getTransactionById, getTransactionSummary,
    getSubscriptions, getSubscriptionById, updateSubscriptionStatus, assignDriverToSubscription,
    getSupportTickets, getSupportTicketById, updateTicketStatus, replyToTicket, assignTicket, addTicketComment, editTicketComment, deleteTicketComment, getSupportAgents, getSupportSettingsAdmin, updateSupportSettings,
    broadcastNotification, getNotificationHistory,
    getMyAdminNotifications, markMyNotificationRead, markAllMyNotificationsRead,
} from '../controller/admin.controller.js';

const adminRouter = Router();

// Public
adminRouter.post('/login', login);
adminRouter.post('/refresh-token', refreshAdminToken);

// Protected
adminRouter.use(verifyAdminJwt);
adminRouter.post('/logout', logout);
adminRouter.get('/me', getMe);
adminRouter.patch('/me', updateMyProfile);
adminRouter.post('/me/avatar', upload.single('avatar'), uploadMyAvatar);
adminRouter.delete('/me/avatar', deleteMyAvatar);

// Admin management
adminRouter.get('/admins', listAdmins);
adminRouter.post('/admins', createAdmin);
adminRouter.patch('/admins/:id', updateAdminPermissions);
adminRouter.patch('/admins/:id/toggle', toggleAdminStatus);
adminRouter.delete('/admins/:id', deleteAdmin);

// Dashboard
adminRouter.get('/dashboard/stats', getDashboardStats);
adminRouter.get('/nav-counts', getNavCounts);
adminRouter.patch('/nav-seen', markNavSeen);
adminRouter.get('/dashboard/recent-trips', getDashboardRecentTrips);

// Analytics
adminRouter.get('/analytics/overview', getAnalyticsOverview);
adminRouter.get('/analytics/trips', getAnalyticsTrips);
adminRouter.get('/analytics/users', getAnalyticsUsers);
adminRouter.get('/analytics/top-drivers', getAnalyticsTopDrivers);
adminRouter.get('/analytics/vehicle-distribution', getAnalyticsVehicleDistribution);

// Users
adminRouter.get('/users', getUsers);
adminRouter.get('/users/:id', getUserById);
adminRouter.put('/users/:id/status', updateUserStatus);
adminRouter.patch('/users/:id/status', updateUserStatus);
adminRouter.get('/users/:id/trips', getUserTrips);
adminRouter.get('/users/:id/transactions', getUserTransactions);

// Drivers
adminRouter.get('/drivers', getDrivers);
adminRouter.get('/drivers/:id', getDriverById);
adminRouter.put('/drivers/:id/status', updateDriverStatus);
adminRouter.patch('/drivers/:id/status', updateDriverStatus);
adminRouter.patch('/drivers/:id/verify', verifyDriver);
adminRouter.get('/drivers/:id/documents', getDriverDocuments);
adminRouter.get('/drivers/:id/trips', getDriverTrips);
adminRouter.get('/drivers/:id/earnings', getDriverEarnings);
adminRouter.post('/drivers/:id/grant', grantDriverMoney);

// Withdrawals (driver cashout requests)
adminRouter.get('/withdrawals', getWithdrawals);
adminRouter.patch('/withdrawals/:id', processWithdrawal);

// Pricing control
adminRouter.get('/pricing', getPricing);
adminRouter.put('/pricing', updatePricing);

// Emergency / SOS alerts
adminRouter.get('/emergencies', getEmergencies);
adminRouter.patch('/emergencies/:id', updateEmergency);

// Documents
adminRouter.get('/documents', getAllDocuments);
adminRouter.post('/documents/seed-test', seedTestDocument); // DEV/TEST only
adminRouter.put('/documents/:id/verify', verifyDocument);
adminRouter.patch('/documents/:id/verify', verifyDocument);
adminRouter.put('/documents/:id/reject', rejectDocument);
adminRouter.patch('/documents/:id/reject', rejectDocument);

// Trips
adminRouter.get('/trips', getTrips);
adminRouter.get('/trips/:id', getTripByIdAdmin);
adminRouter.get('/trips/:id/bids', getTripBids);
adminRouter.patch('/trips/:id/cancel', cancelTripAdmin);

// Transactions
adminRouter.get('/transactions', getTransactions);
adminRouter.get('/transactions/summary', getTransactionSummary);
adminRouter.get('/transactions/:id', getTransactionById);

// Subscriptions
adminRouter.get('/subscriptions', getSubscriptions);
adminRouter.get('/subscriptions/:id', getSubscriptionById);
adminRouter.patch('/subscriptions/:id/status', updateSubscriptionStatus);
adminRouter.patch('/subscriptions/:id/assign-driver', assignDriverToSubscription);

// Support
adminRouter.get('/support-agents', getSupportAgents);
adminRouter.get('/support-settings', getSupportSettingsAdmin);
adminRouter.patch('/support-settings', updateSupportSettings);
adminRouter.get('/support', getSupportTickets);
adminRouter.get('/support/:id', getSupportTicketById);
adminRouter.put('/support/:id/status', updateTicketStatus);
adminRouter.patch('/support/:id', updateTicketStatus);
adminRouter.post('/support/:id/reply', replyToTicket);
adminRouter.post('/support/:id/messages', replyToTicket);
adminRouter.patch('/support/:id/assign', assignTicket);
adminRouter.post('/support/:id/comments', addTicketComment);
adminRouter.patch('/support/:id/comments/:commentId', editTicketComment);
adminRouter.delete('/support/:id/comments/:commentId', deleteTicketComment);

// Notifications
adminRouter.post('/notifications/broadcast', broadcastNotification);
adminRouter.get('/notifications/history', getNotificationHistory);
// My own notifications (e.g. ticket assigned to me)
adminRouter.get('/notifications/mine', getMyAdminNotifications);
adminRouter.patch('/notifications/mine/read-all', markAllMyNotificationsRead);
adminRouter.patch('/notifications/:id/read', markMyNotificationRead);

export { adminRouter };
