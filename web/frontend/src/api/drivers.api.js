import { api } from './client'

export const driversApi = {
  list: (params) => api.get('/admin/drivers', { params }),
  get: (id) => api.get(`/admin/drivers/${id}`),
  updateStatus: (id, status) => api.patch(`/admin/drivers/${id}/status`, { status }),
  update: (id, data) => api.patch(`/admin/drivers/${id}`, data),
  delete: (id) => api.delete(`/admin/drivers/${id}`),
  verify: (id) => api.patch(`/admin/drivers/${id}/verify`),
  documents: (id) => api.get(`/admin/drivers/${id}/documents`),
  trips: (id, params) => api.get(`/admin/drivers/${id}/trips`, { params }),
  earnings: (id) => api.get(`/admin/drivers/${id}/earnings`),
  grant: (id, data) => api.post(`/admin/drivers/${id}/grant`, data),
}
