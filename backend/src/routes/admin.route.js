import { Router } from 'express';
import { verifyAdminJwt } from '../middlewares/admin.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
    ingestDocuments, ingestRawText, getSources, removeSource, searchKnowledge, askKnowledge, chatKnowledge, agenticChat,
} from '../controller/rag.controller.js';
import { listApiLogs, apiLogStats, getApiLog, clearApiLogs } from '../controller/apiLog.controller.js';
import { apiError } from '../utils/apiError.js';
import {
    login, logout, refreshAdminToken, getMe, updateMyProfile, uploadMyAvatar, deleteMyAvatar,
    createAdmin, listAdmins, updateAdminPermissions, toggleAdminStatus, deleteAdmin,
    getDashboardStats, getDashboardRecentTrips, getNavCounts, markNavSeen,
    getAnalyticsOverview, getAnalyticsTrips, getAnalyticsUsers, getAnalyticsTopDrivers, getAnalyticsVehicleDistribution,
    getUsers, getUserById, updateUserStatus, updateUser, getUserTrips, getUserTransactions,
    getSuppliers, getSupplierById, verifySupplier, updateSupplierPlan, toggleSupplierStatus,
    getDrivers, getDriverById, updateDriverStatus, updateDriver, deleteDriver, verifyDriver, getDriverDocuments, getDriverTrips, getDriverEarnings,
    grantDriverMoney, getWithdrawals, processWithdrawal,
    getPricing, updatePricing,
    getEmergencies, getEmergencyById, updateEmergency, updateEmergencyPriority, assignEmergency, addEmergencyNote,
    getAllDocuments, verifyDocument, rejectDocument, updateDocument, deleteDocument, seedTestDocument,
    getTrips, getTripByIdAdmin, getTripBids, cancelTripAdmin,
    getTransactions, getTransactionById, getTransactionSummary, exportTransactions,
    getSubscriptions, getSubscriptionById, updateSubscriptionStatus, assignDriverToSubscription,
    getSupportTickets, getSupportTicketById, updateTicketStatus, replyToTicket, assignTicket, addTicketComment, editTicketComment, deleteTicketComment, deleteTicket, getSupportAgents, getSupportAgentRatings, getSupportSettingsAdmin, updateSupportSettings,
    broadcastNotification, getNotificationHistory, getNotificationRecipients,
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
adminRouter.put('/users/:id', updateUser);
adminRouter.patch('/users/:id', updateUser);
adminRouter.get('/users/:id/trips', getUserTrips);
adminRouter.get('/users/:id/transactions', getUserTransactions);

// Suppliers
adminRouter.get('/suppliers', getSuppliers);
adminRouter.get('/suppliers/:id', getSupplierById);
adminRouter.patch('/suppliers/:id/verify', verifySupplier);
adminRouter.patch('/suppliers/:id/plan', updateSupplierPlan);
adminRouter.patch('/suppliers/:id/toggle', toggleSupplierStatus);

// Drivers
adminRouter.get('/drivers', getDrivers);
adminRouter.get('/drivers/:id', getDriverById);
adminRouter.put('/drivers/:id/status', updateDriverStatus);
adminRouter.patch('/drivers/:id/status', updateDriverStatus);
adminRouter.patch('/drivers/:id/verify', verifyDriver);
adminRouter.put('/drivers/:id', updateDriver);
adminRouter.patch('/drivers/:id', updateDriver);
adminRouter.delete('/drivers/:id', deleteDriver);
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
adminRouter.get('/emergencies/:id', getEmergencyById);
adminRouter.patch('/emergencies/:id', updateEmergency);
adminRouter.patch('/emergencies/:id/priority', updateEmergencyPriority);
adminRouter.patch('/emergencies/:id/assign', assignEmergency);
adminRouter.post('/emergencies/:id/notes', addEmergencyNote);

// Documents
adminRouter.get('/documents', getAllDocuments);
adminRouter.post('/documents/seed-test', seedTestDocument); // DEV/TEST only
adminRouter.put('/documents/:id/verify', verifyDocument);
adminRouter.patch('/documents/:id/verify', verifyDocument);
adminRouter.put('/documents/:id/reject', rejectDocument);
adminRouter.patch('/documents/:id/reject', rejectDocument);
adminRouter.patch('/documents/:id', updateDocument);
adminRouter.delete('/documents/:id', deleteDocument);

// Trips
adminRouter.get('/trips', getTrips);
adminRouter.get('/trips/:id', getTripByIdAdmin);
adminRouter.get('/trips/:id/bids', getTripBids);
adminRouter.patch('/trips/:id/cancel', cancelTripAdmin);

// Transactions
adminRouter.get('/transactions', getTransactions);
adminRouter.get('/transactions/summary', getTransactionSummary);
adminRouter.get('/transactions/export', exportTransactions);
adminRouter.get('/transactions/:id', getTransactionById);

// Subscriptions
adminRouter.get('/subscriptions', getSubscriptions);
adminRouter.get('/subscriptions/:id', getSubscriptionById);
adminRouter.patch('/subscriptions/:id/status', updateSubscriptionStatus);
adminRouter.patch('/subscriptions/:id/assign-driver', assignDriverToSubscription);

// Support
adminRouter.get('/support-agents', getSupportAgents);
adminRouter.get('/support-agents/:id/ratings', getSupportAgentRatings);
adminRouter.get('/support-settings', getSupportSettingsAdmin);
adminRouter.patch('/support-settings', updateSupportSettings);
adminRouter.get('/support', getSupportTickets);
adminRouter.get('/support/:id', getSupportTicketById);
adminRouter.put('/support/:id/status', updateTicketStatus);
adminRouter.patch('/support/:id', updateTicketStatus);
adminRouter.post('/support/:id/reply', upload.single('attachment'), replyToTicket);
adminRouter.post('/support/:id/messages', upload.single('attachment'), replyToTicket);
adminRouter.patch('/support/:id/assign', assignTicket);
adminRouter.post('/support/:id/comments', addTicketComment);
adminRouter.patch('/support/:id/comments/:commentId', editTicketComment);
adminRouter.delete('/support/:id/comments/:commentId', deleteTicketComment);
adminRouter.delete('/support/:id', deleteTicket); // super admin only; closed tickets only

// Notifications
adminRouter.post('/notifications/broadcast', broadcastNotification);
adminRouter.get('/notifications/history', getNotificationHistory);
adminRouter.get('/notifications/recipients', getNotificationRecipients);
// My own notifications (e.g. ticket assigned to me)
adminRouter.get('/notifications/mine', getMyAdminNotifications);
adminRouter.patch('/notifications/mine/read-all', markAllMyNotificationsRead);
adminRouter.patch('/notifications/:id/read', markMyNotificationRead);

// Knowledge Base (RAG). Superadmin always allowed; others need manageKnowledge.
// (Mirrors the frontend hasPermission() rule, which auto-grants superadmin.)
const requireKnowledge = (req, res, next) => {
    if (req.admin?.role === 'superadmin' || req.admin?.permissions?.manageKnowledge) return next();
    throw new apiError(403, 'Insufficient permissions');
};
// Managing documents (list/ingest/delete) + raw search stay gated to superadmin
// or the manageKnowledge permission.
adminRouter.get('/knowledge/sources', requireKnowledge, getSources);
adminRouter.post('/knowledge/ingest', requireKnowledge, upload.array('files', 50), ingestDocuments);
adminRouter.post('/knowledge/text', requireKnowledge, ingestRawText);
adminRouter.post('/knowledge/search', requireKnowledge, searchKnowledge);
adminRouter.delete('/knowledge/sources/:source', requireKnowledge, removeSource);
// Asking / chatting against the KB is read-only and available to ANY authenticated
// admin (support agents included) — this powers the admin "AI" section.
adminRouter.post('/knowledge/ask', askKnowledge);
adminRouter.post('/knowledge/chat', chatKnowledge);

// Agentic AI data assistant — queries LIVE app data (users, drivers, trips,
// payments, etc.) via whitelisted tools. Gated separately from the knowledge
// permission since it reaches personal data (phone numbers, ratings, etc.).
const requireAgenticAI = (req, res, next) => {
    if (req.admin?.role === 'superadmin' || req.admin?.permissions?.useAgenticAI) return next();
    throw new apiError(403, 'Insufficient permissions');
};
adminRouter.post('/agentic/chat', requireAgenticAI, agenticChat);

// API Log viewer — shows captured request/response traffic across the whole
// platform (web, mobile, backend). Superadmin only: it exposes full request and
// response payloads for every domain, so it is strictly more sensitive than any
// single-domain permission.
const requireSuperadmin = (req, res, next) => {
    if (req.admin?.role === 'superadmin') return next();
    throw new apiError(403, 'Superadmin only');
};
adminRouter.get('/api-logs', requireSuperadmin, listApiLogs);
adminRouter.get('/api-logs/stats', requireSuperadmin, apiLogStats);
adminRouter.get('/api-logs/:id', requireSuperadmin, getApiLog);
adminRouter.delete('/api-logs', requireSuperadmin, clearApiLogs);

export { adminRouter };
