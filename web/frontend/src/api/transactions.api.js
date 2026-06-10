import { api } from './client'

export const transactionsApi = {
  list: (params) => api.get('/admin/transactions', { params }),
  get: (id) => api.get(`/admin/transactions/${id}`),
  summary: (params) => api.get('/admin/transactions/summary', { params }),
  refund: (id) => api.post(`/admin/transactions/${id}/refund`),
  export: (params) => api.get('/admin/transactions/export', { params, responseType: 'blob' }),
}
