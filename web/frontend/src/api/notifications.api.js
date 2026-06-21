import { api } from './client'

export const notificationsApi = {
  broadcast: (data) => api.post('/admin/notifications/broadcast', data),
  history: (params) => api.get('/admin/notifications/history', { params }),
  recipients: (params) => api.get('/admin/notifications/recipients', { params }),
  mine: () => api.get('/admin/notifications/mine'),
  markRead: (id) => api.patch(`/admin/notifications/${id}/read`),
  markAllRead: () => api.patch('/admin/notifications/mine/read-all'),
}
