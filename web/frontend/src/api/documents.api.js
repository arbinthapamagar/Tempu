import { api } from './client'

export const documentsApi = {
  list: (params) => api.get('/admin/documents', { params }),
  // One entry per driver with all of their documents.
  byDriver: (params) => api.get('/admin/documents/by-driver', { params }),
  verifyAll: (driverId) => api.patch(`/admin/documents/driver/${driverId}/verify-all`),
  get: (id) => api.get(`/admin/documents/${id}`),
  verify: (id) => api.patch(`/admin/documents/${id}/verify`),
  reject: (id, rejectionReason) => api.patch(`/admin/documents/${id}/reject`, { rejectionReason }),
  update: (id, data) => api.patch(`/admin/documents/${id}`, data),
  remove: (id) => api.delete(`/admin/documents/${id}`),
}
