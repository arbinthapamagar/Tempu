import { api } from './client'

export const usersApi = {
  list: (params) => api.get('/admin/users', { params }),
  get: (id) => api.get(`/admin/users/${id}`),
  updateStatus: (id, accountStatus) => api.patch(`/admin/users/${id}/status`, { accountStatus }),
  update: (id, data) => api.patch(`/admin/users/${id}`, data),
  delete: (id) => api.delete(`/admin/users/${id}`),
  trips: (id, params) => api.get(`/admin/users/${id}/trips`, { params }),
  transactions: (id, params) => api.get(`/admin/users/${id}/transactions`, { params }),
}
