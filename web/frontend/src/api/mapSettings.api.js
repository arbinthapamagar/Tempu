import { api } from './client'

// Superadmin-only. Holds the Google Maps API key + which provider powers place
// search / geocoding across the app (Google, or free OpenStreetMap fallback).
export const mapSettingsApi = {
  get: () => api.get('/admin/map-settings'),
  update: (data) => api.patch('/admin/map-settings', data),
  // Try a provider/key without saving; returns { ok, provider, query, count, results } or { ok:false, error }.
  test: (data) => api.post('/admin/map-settings/test', data),
}
