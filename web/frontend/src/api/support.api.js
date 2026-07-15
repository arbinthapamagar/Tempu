import { api } from './client'

export const supportApi = {
  list: (params) => api.get('/admin/support', { params }),
  get: (id) => api.get(`/admin/support/${id}`),
  update: (id, data) => api.patch(`/admin/support/${id}`, data),
  remove: (id) => api.delete(`/admin/support/${id}`),
  reply: (id, { message, attachment } = {}) => {
    if (attachment) {
      const form = new FormData()
      if (message) form.append('message', message)
      form.append('attachment', attachment)
      return api.post(`/admin/support/${id}/reply`, form, { headers: { 'Content-Type': undefined } })
    }
    return api.post(`/admin/support/${id}/reply`, { message })
  },
  assign: (id, adminId) => api.patch(`/admin/support/${id}/assign`, { adminId }),
  comment: (id, { body, mentions }) => api.post(`/admin/support/${id}/comments`, { body, mentions }),
  editComment: (id, commentId, { body, mentions }) => api.patch(`/admin/support/${id}/comments/${commentId}`, { body, mentions }),
  deleteComment: (id, commentId) => api.delete(`/admin/support/${id}/comments/${commentId}`),
  agents: () => api.get('/admin/support-agents'),
  agentRatings: (id) => api.get(`/admin/support-agents/${id}/ratings`),
  settings: () => api.get('/admin/support-settings'),
  updateSettings: (data) => api.patch('/admin/support-settings', data),
}
