import { useNavigate } from 'react-router-dom'
import { LogOut, Menu, Sun, Moon, Monitor, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { NotificationBell } from './NotificationBell'
import { authApi } from '../../api/auth.api'
import toast from 'react-hot-toast'

const NEXT_MODE = { system: 'light', light: 'dark', dark: 'system' }
const MODE_ICON = { system: Monitor, light: Sun, dark: Moon }

export function Header({ onMenuClick }) {
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const ThemeIcon = MODE_ICON[mode] || Monitor

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end gap-3 px-4 sm:px-6 fixed top-0 right-0 left-0 lg:left-60 z-20">
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

      {/* Theme toggle */}
      <button
        onClick={() => setMode(NEXT_MODE[mode])}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        title={`Theme: ${mode} — click for ${NEXT_MODE[mode]}`}
        aria-label="Toggle theme"
      >
        <ThemeIcon className="h-[18px] w-[18px]" />
      </button>

      {/* Notifications */}
      <NotificationBell />

      {/* Avatar → profile */}
      <button
        onClick={() => navigate('/profile')}
        className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0"
        title={admin?.name || 'Profile'}
      >
        {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
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
