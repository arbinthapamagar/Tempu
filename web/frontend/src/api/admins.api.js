import { api } from './client'

export const adminsApi = {
  list: () => api.get('/admin/admins'),
  create: (data) => api.post('/admin/admins', data),
  update: (id, data) => api.patch(`/admin/admins/${id}`, data),
  delete: (id) => api.delete(`/admin/admins/${id}`),
  toggle: (id, isActive) => api.patch(`/admin/admins/${id}/toggle`, { isActive }),
}
