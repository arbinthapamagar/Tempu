import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shakti_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('shakti_admin_token')
      // Avoid a redirect loop / hard reload when we're already logging out or
      // sitting on the login page.
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || { message: error.message })
  }
)
