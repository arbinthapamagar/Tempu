import { api } from './client'

export const dashboardApi = {
  stats: () => api.get('/admin/dashboard/stats'),
  recentTrips: (limit = 10) => api.get('/admin/dashboard/recent-trips', { params: { limit } }),
  activityFeed: () => api.get('/admin/dashboard/activity'),
}
