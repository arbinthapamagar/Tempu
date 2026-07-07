import { useNavigate } from 'react-router-dom'
import { LogOut, Menu, ChevronDown } from '@/components/ui/icons'
import { useAuthStore } from '../../store/authStore'
import { Avatar } from '../ui/Avatar'
import { NotificationBell } from './NotificationBell'
import { authApi } from '../../api/auth.api'
import toast from 'react-hot-toast'

export function Header({ onMenuClick }) {
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()

  const handleLogout = () => {
    authApi.logout().catch(() => { /* ignore */ })
    logout()
    navigate('/login', { replace: true })
    toast.success('Logged out successfully')
  }

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-end gap-4 px-4 sm:px-8 fixed top-0 right-0 left-0 lg:left-60 z-20">
      {/* Hamburger — only on mobile, pushed to the left */}
      <button
        onClick={onMenuClick}
        className="lg:hidden mr-auto p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Language (display only for now) */}
      <span className="flex items-center gap-1 text-[13px] font-medium text-gray-700 select-none">
        EN <ChevronDown className="h-3 w-3" />
      </span>

      {/* Notifications */}
      <NotificationBell />

      {/* Avatar → profile */}
      <button
        onClick={() => navigate('/profile')}
        className="shrink-0 rounded-full"
        title={admin?.name || 'Profile'}
      >
        <Avatar src={admin?.avatarUrl} name={admin?.name} size="md" />
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
        title="Logout"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    </header>
  )
}
