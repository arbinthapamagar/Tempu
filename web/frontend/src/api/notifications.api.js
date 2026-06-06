import { api } from './client'

export const notificationsApi = {
  broadcast: (data) => api.post('/admin/notifications/broadcast', data),
  history: (params) => api.get('/admin/notifications/history', { params }),
}
