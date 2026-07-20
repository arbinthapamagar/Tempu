import { api } from './client'

export const emergenciesApi = {
  list: (params) => api.get('/admin/emergencies', { params }),
  get: (id) => api.get(`/admin/emergencies/${id}`),
  update: (id, data) => api.patch(`/admin/emergencies/${id}`, data),
  setPriority: (id, priority) => api.patch(`/admin/emergencies/${id}/priority`, { priority }),
  assign: (id, adminId) => api.patch(`/admin/emergencies/${id}/assign`, { adminId }),
  addNote: (id, body) => api.post(`/admin/emergencies/${id}/notes`, { body }),
}
