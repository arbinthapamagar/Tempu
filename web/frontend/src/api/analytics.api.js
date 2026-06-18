import { api } from './client'

// Accept either a period string ('week'|'month'|'year') or a params object
// like { period } or { start, end } for a custom date range.
const toParams = (arg) => (typeof arg === 'string' ? { period: arg } : (arg || {}))

export const analyticsApi = {
  overview: (arg) => api.get('/admin/analytics/overview', { params: toParams(arg) }),
  trips: (arg) => api.get('/admin/analytics/trips', { params: toParams(arg) }),
  revenue: (arg) => api.get('/admin/analytics/revenue', { params: toParams(arg) }),
  users: (arg) => api.get('/admin/analytics/users', { params: toParams(arg) }),
  drivers: (arg) => api.get('/admin/analytics/drivers', { params: toParams(arg) }),
  topDrivers: () => api.get('/admin/analytics/top-drivers'),
}
