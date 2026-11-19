import { api, request } from './client';
import { appendFile } from './formFile';

export const userApi = {
  // Profile
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  updateFcmToken: (fcmToken) => api.put('/users/fcm-token', { fcmToken }),
  uploadAvatar: async (uri) => {
    const form = new FormData();
    await appendFile(form, 'avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' });
    return request('POST', '/users/profile/avatar', form);
  },
  deleteAvatar: () => api.del('/users/profile/avatar'),

  // Location
  updateLocation: ({ latitude, longitude }) => api.put('/users/location', { latitude, longitude }),
  getSavedAddresses: () => api.get('/users/saved-addresses'),
  addSavedAddress: (data) => api.post('/users/saved-addresses', data),
  updateSavedAddress: (id, data) => api.put(`/users/saved-addresses/${id}`, data),
  deleteSavedAddress: (id) => api.del(`/users/saved-addresses/${id}`),

  // Wallet & Transactions
  getWallet: () => api.get('/users/wallet'),
  // Gateway top-ups: initiate returns { transactionId, paymentUrl }; the
  // status call settles it with the gateway and returns the new balance.
  getPaymentMethods: () => api.get('/users/payment-methods'),
  initiateWalletTopup: ({ amount, method }) => api.post('/users/wallet/topup/initiate', { amount, method }),
  getWalletTopup: (id) => api.get(`/users/wallet/topup/${id}`),
  getTransactions: (page = 1, limit = 20) =>
    api.get(`/users/transactions?page=${page}&limit=${limit}`),

  // Notifications
  getNotifications: (page = 1) =>
    api.get(`/users/notifications?page=${page}&limit=30`),
  markNotificationRead: (id) => api.put(`/users/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/users/notifications/read-all'),
  deleteNotification: (id) => api.del(`/users/notifications/${id}`),

  // Trips
  // status: a single status or a comma list; omit for all trips. The
  // response carries per-status totals in data.counts.
  getTripHistory: (page = 1, { limit = 20, status } = {}) =>
    api.get(`/users/trips?page=${page}&limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  getTripById: (id) => api.get(`/users/trips/${id}`),
  // The rider's trip still in play (pending/accepted/arriving/started) or null.
  getActiveTrip: () => api.get('/users/trips/active'),

  // Reviews
  createReview: (data) => api.post('/users/reviews', data),
  driverCreateReview: (data) => api.post('/users/reviews/driver', data),
  getMyReviews: (page = 1) => api.get(`/users/reviews?page=${page}&limit=20`),

  // Subscriptions
  getMySubscriptions: () => api.get('/users/subscriptions'),
  createSubscription: (data) => api.post('/users/subscriptions', data),
  getSubscriptionById: (id) => api.get(`/users/subscriptions/${id}`),
  cancelSubscription: (id) => api.put(`/users/subscriptions/${id}/cancel`),
  pauseSubscription: (id) => api.put(`/users/subscriptions/${id}/pause`),
  resumeSubscription: (id) => api.put(`/users/subscriptions/${id}/resume`),

  // Support
  getSupportSettings: () => api.get('/users/support/settings'),
  getMyTickets: (page = 1) => api.get(`/users/support?page=${page}&limit=20`),
  getTicketById: (id) => api.get(`/users/support/${id}`),
  createTicket: (data) => api.post('/users/support', data),
  addTicketMessage: (id, message) => api.post(`/users/support/${id}/messages`, { message }),
  rateTicket: (id, score, comment = '', tags = []) => api.post(`/users/support/${id}/rate`, { score, comment, tags }),
  // Voice note / document attachment on a ticket. `file` = { uri, name, type }.
  sendTicketAttachment: async (id, { message, file }) => {
    const form = new FormData();
    if (message) form.append('message', message);
    await appendFile(form, 'attachment', { uri: file.uri, name: file.name, type: file.type });
    return request('POST', `/users/support/${id}/messages`, form);
  },

  // Place search / geocoding (backend proxy → Google when admin key is set,
  // else free OpenStreetMap). Returns { provider, predictions:[{id, placeId,
  // title, subtitle, coords}] }. coords is null for Google → resolve via geoPlace.
  geoAutocomplete: (q) => api.get(`/users/geo/autocomplete?q=${encodeURIComponent(q)}`),
  geoPlace: (placeId) => api.get(`/users/geo/place?placeId=${encodeURIComponent(placeId)}`),
  // Driving route between two {lat,lng}. Returns { provider, polyline:[{latitude,
  // longitude}], distanceText, distanceMeters, durationText, durationSeconds }.
  geoDirections: (from, to) =>
    api.get(`/users/geo/directions?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`),

  // Fare quote (standard fare from Pricing Control - used as the bid floor)
  getFareQuote: (params) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/users/fare-quote?${qs}`);
  },

  // Emergency / SOS
  triggerEmergency: (data) => api.post('/users/emergency', data),
  getMyEmergencies: () => api.get('/users/emergency'),

  // Driver
  registerAsDriver: (data) => api.post('/users/driver/register', data),
  getMyDriverProfile: () => api.get('/users/driver'),
  updateDriverProfile: (data) => api.put('/users/driver', data),
  // `file` = { uri, name, mimeType } — a photo or a PDF.
  uploadDriverDocument: async (type, file) => {
    const form = new FormData();
    const mimeType = file.mimeType || 'image/jpeg';
    const name = file.name || (mimeType === 'application/pdf' ? 'document.pdf' : 'document.jpg');
    await appendFile(form, 'document', { uri: file.uri, name, type: mimeType });
    form.append('type', type);
    return request('POST', '/users/driver/documents', form);
  },
  goOnline: () => api.put('/users/driver/go-online'),
  goOffline: () => api.put('/users/driver/go-offline'),
  updateDriverLocation: ({ lat, lng }) =>
    api.put('/users/driver/location', { latitude: lat, longitude: lng }),
  getNearbyTrips: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/users/driver/nearby-trips${qs ? `?${qs}` : ''}`);
  },
  getMyEarnings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/users/driver/earnings${qs ? `?${qs}` : ''}`);
  },
  // Today/week/month totals + a per-day series for the earnings chart.
  getEarningsBreakdown: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/users/driver/earnings/breakdown${qs ? `?${qs}` : ''}`);
  },
  requestWithdrawal: (data) => api.post('/users/driver/withdrawals', data),
  getMyWithdrawals: () => api.get('/users/driver/withdrawals'),
  // Top up the prepaid fee balance (standby payment — no real gateway yet).
  initiateDriverTopup: ({ amount, method }) => api.post('/users/driver/topup/initiate', { amount, method }),
  getDriverTopup: (id) => api.get(`/users/driver/topup/${id}`),
};
