import { api } from './client'

export const analyticsApi = {
  overview: (period) => api.get('/admin/analytics/overview', { params: { period } }),
  trips: (period) => api.get('/admin/analytics/trips', { params: { period } }),
  revenue: (period) => api.get('/admin/analytics/revenue', { params: { period } }),
  users: (period) => api.get('/admin/analytics/users', { params: { period } }),
  drivers: (period) => api.get('/admin/analytics/drivers', { params: { period } }),
  topDrivers: () => api.get('/admin/analytics/top-drivers'),
}
