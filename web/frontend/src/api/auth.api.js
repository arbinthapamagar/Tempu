import { api } from './client'

export const authApi = {
  login: (credentials) => api.post('/admin/login', credentials),
  logout: () => api.post('/admin/logout'),
  me: () => api.get('/admin/me'),
  refresh: () => api.post('/admin/refresh-token'),
}
