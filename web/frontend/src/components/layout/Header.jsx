import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Bell, User, Menu } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth.api'
import toast from 'react-hot-toast'

const TITLES = {
  '/dashboard': 'Dashboard',
  '/users': 'User Management',
  '/drivers': 'Driver Management',
  '/trips': 'Trip Management',
  '/subscriptions': 'Subscriptions',
  '/transactions': 'Transactions',
  '/documents': 'Document Verification',
  '/support': 'Support Tickets',
  '/suppliers': 'Supplier Management',
  '/admins': 'Admin Users',
  '/analytics': 'Analytics',
  '/notifications': 'Notifications',
}

export function Header({ onMenuClick }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuthStore()

  const title = Object.entries(TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'Admin'

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 fixed top-0 right-0 left-0 lg:left-60 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Hamburger — only on mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-blue-400" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700 leading-tight">{admin?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{admin?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors ml-1"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
