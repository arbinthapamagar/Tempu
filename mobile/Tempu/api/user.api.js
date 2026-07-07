import { api, request } from './client';

export const userApi = {
  // Profile
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  updateFcmToken: (fcmToken) => api.put('/users/fcm-token', { fcmToken }),
  uploadAvatar: async (uri) => {
    const { tokenStore } = await import('./tokenStore');
    const { accessToken } = tokenStore.get();
    const { BASE_URL } = await import('./client');
    const form = new FormData();
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' });
    const res = await fetch(`${BASE_URL}/users/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
    return json;
  },
  deleteAvatar: () => api.del('/users/profile/avatar'),

  // Location
  updateLocation: (coordinates) => api.put('/users/location', { coordinates }),
  getSavedAddresses: () => api.get('/users/saved-addresses'),
  addSavedAddress: (data) => api.post('/users/saved-addresses', data),
  updateSavedAddress: (id, data) => api.put(`/users/saved-addresses/${id}`, data),
  deleteSavedAddress: (id) => api.del(`/users/saved-addresses/${id}`),

  // Wallet & Transactions
  getWallet: () => api.get('/users/wallet'),
  topUpWallet: ({ amount, method, gatewayRef }) =>
    api.post('/users/wallet/topup', { amount, method, gatewayRef }),
  getTransactions: (page = 1, limit = 20) =>
    api.get(`/users/transactions?page=${page}&limit=${limit}`),

  // Notifications
  getNotifications: (page = 1) =>
    api.get(`/users/notifications?page=${page}&limit=30`),
  markNotificationRead: (id) => api.put(`/users/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/users/notifications/read-all'),
  deleteNotification: (id) => api.del(`/users/notifications/${id}`),

  // Trips
  getTripHistory: (page = 1) =>
    api.get(`/users/trips?page=${page}&limit=20`),
  getTripById: (id) => api.get(`/users/trips/${id}`),

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
  // Voice note / document attachment on a ticket. `file` = { uri, name, type }.
  sendTicketAttachment: async (id, { message, file }) => {
    const { tokenStore } = await import('./tokenStore');
    const { accessToken } = tokenStore.get();
    const { BASE_URL } = await import('./client');
    const form = new FormData();
    if (message) form.append('message', message);
    form.append('attachment', { uri: file.uri, name: file.name, type: file.type });
    const res = await fetch(`${BASE_URL}/users/support/${id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to send attachment');
    return json;
  },

  // Fare quote (standard fare from Pricing Control — used as the bid floor)
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
  uploadDriverDocument: async (type, uri) => {
    const { tokenStore } = await import('./tokenStore');
    const { accessToken } = tokenStore.get();
    const { BASE_URL } = await import('./client');
    const form = new FormData();
    form.append('document', { uri, name: 'document.jpg', type: 'image/jpeg' });
    form.append('type', type);
    const res = await fetch(`${BASE_URL}/users/driver/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
    return json;
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
  requestWithdrawal: (data) => api.post('/users/driver/withdrawals', data),
  getMyWithdrawals: () => api.get('/users/driver/withdrawals'),
};
