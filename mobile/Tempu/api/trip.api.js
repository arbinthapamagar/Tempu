import { api } from './client';

export const tripApi = {
  create: (data) => api.post('/trips', data),
  getById: (id) => api.get(`/trips/${id}`),
  cancel: (id, reason) => api.put(`/trips/${id}/cancel`, { reason }),
  updateStatus: (id, status) => api.put(`/trips/${id}/status`, { status }),
  getNearbyDrivers: (params) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/trips/nearby-drivers?${qs}`);
  },
};

export const bidApi = {
  getForTrip: (tripId) => api.get(`/bids/trip/${tripId}`),
  accept: (bidId) => api.put(`/bids/${bidId}/accept`),
  reject: (bidId) => api.put(`/bids/${bidId}/reject`),
  // Driver side
  create: ({ tripId, amount, message }) =>
    api.post('/bids', { tripId, amount, message }),
  getMyBids: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/bids/my-bids${qs ? `?${qs}` : ''}`);
  },
};
