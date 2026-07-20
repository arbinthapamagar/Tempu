import { Router } from 'express';
import { verifyUserJwt } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import { getProfile, updateProfile, uploadAvatar, deleteAvatar, changePassword, updateFcmToken } from '../controller/users/user.profile.controller.js';
import { updateLocation, getSavedAddresses, addSavedAddress, updateSavedAddress, deleteSavedAddress } from '../controller/users/user.location.controller.js';
import { getWallet, getTransactions, topUpWallet } from '../controller/users/user.wallet.controller.js';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controller/users/user.notification.controller.js';
import { getTripHistory, getTripById, getFareQuote } from '../controller/users/user.trip.controller.js';
import { createReview, getMyReviews, driverCreateReview } from '../controller/users/user.review.controller.js';
import {
    getMySubscriptions, createSubscription, getSubscriptionById,
    cancelSubscription, pauseSubscription, resumeSubscription,
} from '../controller/users/user.subscription.controller.js';
import { createTicket, getMyTickets, getTicketById, addMessage, getSupportConfig, rateTicket } from '../controller/users/user.support.controller.js';
import {
    registerAsDriver, getMyDriverProfile, updateDriverProfile, uploadDriverDocument,
    goOnline, goOffline, updateDriverLocation, getNearbyTrips, getMyEarnings,
    requestWithdrawal, getMyWithdrawals, topUpDriverBalance,
} from '../controller/users/user.driver.controller.js';
import { triggerEmergency, getMyEmergencies } from '../controller/users/user.emergency.controller.js';
import { verifyDriverProfile } from '../middlewares/driver.middleware.js';

const userRouter = Router();
userRouter.use(verifyUserJwt);

// Profile
userRouter.get('/profile', getProfile);
userRouter.put('/profile', updateProfile);
userRouter.post('/profile/avatar', upload.single('avatar'), uploadAvatar);
userRouter.delete('/profile/avatar', deleteAvatar);
userRouter.put('/password', changePassword);
userRouter.put('/fcm-token', updateFcmToken);

// Location
userRouter.put('/location', updateLocation);
userRouter.get('/saved-addresses', getSavedAddresses);
userRouter.post('/saved-addresses', addSavedAddress);
userRouter.put('/saved-addresses/:id', updateSavedAddress);
userRouter.delete('/saved-addresses/:id', deleteSavedAddress);

// Wallet & Transactions
userRouter.get('/wallet', getWallet);
userRouter.post('/wallet/topup', topUpWallet);
userRouter.get('/transactions', getTransactions);

// Notifications
userRouter.get('/notifications', getNotifications);
userRouter.put('/notifications/read-all', markAllAsRead);
userRouter.put('/notifications/:id/read', markAsRead);
userRouter.delete('/notifications/:id', deleteNotification);

// Trips
userRouter.get('/fare-quote', getFareQuote);
userRouter.get('/trips', getTripHistory);
userRouter.get('/trips/:id', getTripById);

// Reviews
userRouter.post('/reviews', createReview);
userRouter.post('/reviews/driver', verifyDriverProfile, driverCreateReview);
userRouter.get('/reviews', getMyReviews);

// Subscriptions
userRouter.get('/subscriptions', getMySubscriptions);
userRouter.post('/subscriptions', createSubscription);
userRouter.get('/subscriptions/:id', getSubscriptionById);
userRouter.put('/subscriptions/:id/cancel', cancelSubscription);
userRouter.put('/subscriptions/:id/pause', pauseSubscription);
userRouter.put('/subscriptions/:id/resume', resumeSubscription);

// Support Tickets
userRouter.get('/support/settings', getSupportConfig);
userRouter.get('/support', getMyTickets);
userRouter.post('/support', createTicket);
userRouter.get('/support/:id', getTicketById);
userRouter.post('/support/:id/messages', upload.single('attachment'), addMessage);
userRouter.post('/support/:id/rate', rateTicket);

// Emergency / SOS
userRouter.post('/emergency', triggerEmergency);
userRouter.get('/emergency', getMyEmergencies);

// Driver Profile
userRouter.post('/driver/register', registerAsDriver);
userRouter.get('/driver', getMyDriverProfile);
userRouter.put('/driver', updateDriverProfile);
userRouter.post('/driver/documents', upload.single('document'), uploadDriverDocument);
userRouter.put('/driver/go-online', goOnline);
userRouter.put('/driver/go-offline', goOffline);
userRouter.put('/driver/location', updateDriverLocation);
userRouter.get('/driver/nearby-trips', getNearbyTrips);
userRouter.get('/driver/earnings', getMyEarnings);
userRouter.post('/driver/topup', verifyDriverProfile, topUpDriverBalance);
userRouter.post('/driver/withdrawals', verifyDriverProfile, requestWithdrawal);
userRouter.get('/driver/withdrawals', verifyDriverProfile, getMyWithdrawals);

export { userRouter };
