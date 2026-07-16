import { api } from './client'

// Admin API-Log viewer (superadmin only). Backend: /api/v1/admin/api-logs.
export const apiLogsApi = {
  // params: { source, domain, method, status, search, page, limit }
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return api.get(`/admin/api-logs${qs ? `?${qs}` : ''}`)
  },
  stats: () => api.get('/admin/api-logs/stats'),
  get: (id) => api.get(`/admin/api-logs/${id}`),
  clear: (source) => api.delete(`/admin/api-logs${source ? `?source=${source}` : ''}`),
}
