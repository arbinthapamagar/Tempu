import { useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, Car, Navigation, Repeat, CreditCard, FileText,
  MessageSquare, Building2, BarChart2, Shield, Bell, ChevronRight, Zap, X, Banknote, Coins, Siren
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { dashboardApi } from '../../api/dashboard.api'
import { useAuthStore, hasPermission, canSeeDashboard, homePath } from '../../store/authStore'

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
      { to: '/analytics', label: 'Analytics', icon: BarChart2, permission: 'viewAnalytics' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: 'manageUsers' },
      { to: '/drivers', label: 'Drivers', icon: Car, permission: 'manageDrivers', badge: 'drivers' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/trips', label: 'Trips', icon: Navigation, permission: 'manageTrips' },
      { to: '/subscriptions', label: 'Subscriptions', icon: Repeat, permission: 'manageSubscriptions' },
      { to: '/documents', label: 'Documents', icon: FileText, permission: 'verifyDocuments', badge: 'documents' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/transactions', label: 'Transactions', icon: CreditCard, permission: 'managePayments' },
      { to: '/withdrawals', label: 'Withdrawals', icon: Banknote, permission: 'managePayments', badge: 'withdrawals' },
      { to: '/pricing', label: 'Pricing Control', icon: Coins, permission: 'managePayments' },
    ],
  },
  {
    label: 'Support & Business',
    items: [
      { to: '/support', label: 'Support', icon: MessageSquare, permission: 'handleSupport', badge: 'support' },
      { to: '/emergencies', label: 'Emergency Alerts', icon: Siren, permission: 'handleSupport', badge: 'emergencies' },
      { to: '/suppliers', label: 'Suppliers', icon: Building2, permission: 'manageSuppliers' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, permission: null },
      { to: '/admins', label: 'Admin Users', icon: Shield, permission: 'manageAdmins' },
    ],
  },
]

export function Sidebar({ open, onClose }) {
  const { admin } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  // Poll counts of NEW (unseen) items so the badges stay fresh.
  const { data: countsRes } = useQuery({
    queryKey: ['nav-counts'],
    queryFn: () => dashboardApi.navCounts(),
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  })
  const counts = countsRes?.data || {}

  // Viewing a badged section marks it seen → its "new" badge clears.
  useEffect(() => {
    const path = location.pathname
    const item = navSections.flatMap((s) => s.items).find(
      (it) => it.badge && (path === it.to || path.startsWith(`${it.to}/`))
    )
    if (!item) return
    dashboardApi.markNavSeen(item.badge)
      .then(() => qc.invalidateQueries({ queryKey: ['nav-counts'] }))
      .catch(() => {})
  }, [location.pathname, qc])

  return (
    <>
      {/* Desktop: always visible fixed sidebar */}
      {/* Mobile: slide-in drawer controlled by `open` prop */}
      <aside
        className={cn(
          'bg-white text-gray-900 flex flex-col h-screen fixed left-0 top-0 z-30 w-60 transition-transform duration-200 border-r border-gray-200',
          // Desktop — always shown
          'lg:translate-x-0',
          // Mobile — shown only when open
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo (→ home) + mobile close */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
          <button
            onClick={() => { navigate(homePath(admin)); onClose?.() }}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-orange-50 transition-colors"
            title="Go to home"
          >
            <div className="bg-orange-500 p-1.5 -rotate-2 shrink-0" style={{ borderRadius: '11px 6px 10px 7px' }}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-extrabold text-gray-900 text-lg leading-none flex items-baseline gap-1.5">
                Shakti <span className="text-orange-500 font-sans text-sm font-medium">शक्ति</span>
              </p>
              <p className="eyebrow mt-1 text-[10px]">Admin Portal</p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-orange-50 text-gray-500 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.to === '/dashboard' && !canSeeDashboard(admin)) return false
              return !item.permission || hasPermission(admin, item.permission)
            })
            if (!visibleItems.length) return null
            return (
              <div key={section.label} className="mb-5">
                <p className="eyebrow px-5 mb-2 text-gray-400">
                  {section.label}
                </p>
                {visibleItems.map((item) => {
                  const count = item.badge ? (counts[item.badge] || 0) : 0
                  return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 mx-2.5 px-3 py-2.5 text-sm font-medium transition-colors group',
                        isActive
                          ? 'bg-orange-500 text-white nav-blob shadow-[2px_3px_0_rgba(154,52,18,0.25)]'
                          : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-600')} />
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className={cn(
                            'min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center',
                            isActive ? 'bg-white text-orange-600' : 'bg-red-500 text-white'
                          )}>
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                        {isActive && count === 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
                      </>
                    )}
                  </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Admin info */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={() => { navigate('/profile'); onClose?.() }}
            className="flex items-center gap-3 w-full text-left rounded-lg p-1 -m-1 hover:bg-orange-50 transition-colors"
            title="View my profile"
          >
            <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{admin?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 capitalize">{admin?.role || 'admin'}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}
