import { api } from './client'

export const supportApi = {
  list: (params) => api.get('/admin/support', { params }),
  get: (id) => api.get(`/admin/support/${id}`),
  update: (id, data) => api.patch(`/admin/support/${id}`, data),
  reply: (id, message) => api.post(`/admin/support/${id}/reply`, { message }),
  assign: (id, adminId) => api.patch(`/admin/support/${id}/assign`, { adminId }),
}
