import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,

      setAuth: (admin, token) => {
        localStorage.setItem('shakti_admin_token', token)
        set({ admin, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('shakti_admin_token')
        set({ admin: null, isAuthenticated: false })
      },

      updateAdmin: (data) => set((s) => ({ admin: { ...s.admin, ...data } })),
    }),
    {
      name: 'shakti-admin-v2',
      partialize: (s) => ({ admin: s.admin, isAuthenticated: s.isAuthenticated }),
    }
  )
)

export const hasPermission = (admin, key) => {
  if (!admin) return false
  if (admin.role === 'superadmin') return true
  return admin.permissions?.[key] === true
}

// Dashboard is for superadmin/admin only - moderators and headmasters don't get it.
export const canSeeDashboard = (admin) =>
  admin?.role === 'superadmin' || admin?.role === 'admin'

// Where a given admin should land (dashboard if allowed, else the support queue).
export const homePath = (admin) => (canSeeDashboard(admin) ? '/dashboard' : '/support')
