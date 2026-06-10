import { api } from './client'

export const subscriptionsApi = {
  list: (params) => api.get('/admin/subscriptions', { params }),
  get: (id) => api.get(`/admin/subscriptions/${id}`),
  updateStatus: (id, status) => api.patch(`/admin/subscriptions/${id}/status`, { status }),
  assignDriver: (id, driverId) => api.patch(`/admin/subscriptions/${id}/assign-driver`, { driverId }),
}
