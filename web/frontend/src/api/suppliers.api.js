import { api } from './client'

export const suppliersApi = {
  list: (params) => api.get('/admin/suppliers', { params }),
  get: (id) => api.get(`/admin/suppliers/${id}`),
  verify: (id) => api.patch(`/admin/suppliers/${id}/verify`),
  updatePlan: (id, plan) => api.patch(`/admin/suppliers/${id}/plan`, { plan }),
  toggle: (id, isActive) => api.patch(`/admin/suppliers/${id}/toggle`, { isActive }),
}
