import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  // X-Client tags every request so the backend API-Log viewer can bucket this
  // traffic under the "Web Frontend" section (mobile sends 'mobile').
  headers: { 'Content-Type': 'application/json', 'X-Client': 'web' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shakti_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const status = error.response?.status
    // 401 = invalid/expired token. A 403 whose message is the deactivation
    // notice is also a session-level failure (the account was disabled after
    // login) - force logout. Ordinary permission 403s ('Insufficient
    // permissions') must NOT log the user out.
    const deactivated =
      status === 403 && error.response?.data?.message === 'Admin account is deactivated'
    if (status === 401 || deactivated) {
      localStorage.removeItem('shakti_admin_token')
      // Avoid a redirect loop / hard reload when we're already logging out or
      // sitting on the login page.
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || { message: error.message })
  }
)
