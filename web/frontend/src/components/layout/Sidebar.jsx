import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutGrid, Users, Car, Navigation, Repeat, CreditCard, FileText,
  MessageSquare, Building2, BarChart2, Shield, Bell, Zap, X, Banknote, Coins, Siren,
  ChevronDown, Settings, ChevronsLeft,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { dashboardApi } from '../../api/dashboard.api'
import { useAuthStore, hasPermission, canSeeDashboard, homePath } from '../../store/authStore'

// Each group gets an icon + chevron header (collapsible), with its links indented
// underneath — the ShipOS sidebar pattern.
const navSections = [
  {
    label: 'Overview',
    icon: LayoutGrid,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, permission: null },
      { to: '/analytics', label: 'Analytics', icon: BarChart2, permission: 'viewAnalytics' },
    ],
  },
  {
    label: 'User Management',
    icon: Users,
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: 'manageUsers' },
      { to: '/drivers', label: 'Drivers', icon: Car, permission: 'manageDrivers', badge: 'drivers' },
      { to: '/admins', label: 'Admin Users', icon: Shield, permission: 'manageAdmins' },
    ],
  },
  {
    label: 'Operations',
    icon: Navigation,
    items: [
      { to: '/trips', label: 'Trips', icon: Navigation, permission: 'manageTrips' },
      { to: '/subscriptions', label: 'Subscriptions', icon: Repeat, permission: 'manageSubscriptions' },
      { to: '/documents', label: 'Documents', icon: FileText, permission: 'verifyDocuments', badge: 'documents' },
    ],
  },
  {
    label: 'Finance',
    icon: CreditCard,
    items: [
      { to: '/transactions', label: 'Transactions', icon: CreditCard, permission: 'managePayments' },
      { to: '/withdrawals', label: 'Withdrawals', icon: Banknote, permission: 'managePayments', badge: 'withdrawals' },
      { to: '/pricing', label: 'Pricing Control', icon: Coins, permission: 'managePayments' },
    ],
  },
  {
    label: 'Support & Business',
    icon: MessageSquare,
    items: [
      { to: '/support', label: 'Support', icon: MessageSquare, permission: 'handleSupport', badge: 'support' },
      { to: '/emergencies', label: 'Emergency Alerts', icon: Siren, permission: 'handleSupport', badge: 'emergencies' },
      { to: '/suppliers', label: 'Suppliers', icon: Building2, permission: 'manageSuppliers' },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, permission: null },
    ],
  },
]

export function Sidebar({ open, onClose }) {
  const { admin } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  // Which groups are collapsed. Empty = all expanded.
  const [collapsed, setCollapsed] = useState({})
  const toggleSection = (label) => setCollapsed((c) => ({ ...c, [label]: !c[label] }))

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

  // Collapse every group at once (the bottom button).
  const allCollapsed = navSections.every((s) => collapsed[s.label])
  const collapseAll = () => {
    const next = {}
    if (!allCollapsed) navSections.forEach((s) => { next[s.label] = true })
    setCollapsed(next)
  }

  return (
    <aside
      className={cn(
        'bg-white text-gray-900 flex flex-col h-screen fixed left-0 top-0 z-30 w-60 transition-transform duration-200 border-r border-gray-200',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo: split-colour wordmark like SHIPOS */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <button
          onClick={() => { navigate(homePath(admin)); onClose?.() }}
          className="flex items-center gap-2 min-w-0 text-left"
          title="Go to home"
        >
          <div className="bg-orange-500 p-1 rounded-md shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-[22px] font-black tracking-tight leading-none">
            <span className="text-gray-900">TEM</span><span className="text-orange-500">PU</span>
          </span>
        </button>
        <button onClick={onClose} className="lg:hidden p-1 rounded-md hover:bg-gray-100 text-gray-500 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grouped, collapsible navigation */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.to === '/dashboard' && !canSeeDashboard(admin)) return false
            return !item.permission || hasPermission(admin, item.permission)
          })
          if (!visibleItems.length) return null
          const isOpen = !collapsed[section.label]
          return (
            <div key={section.label} className="mt-1">
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-gray-700"
              >
                <span className="flex items-center gap-1.5">
                  <section.icon className="h-3.5 w-3.5 text-gray-500" />
                  {section.label}
                </span>
                <ChevronDown className={cn('h-3 w-3 text-gray-400 transition-transform', isOpen ? '' : '-rotate-90')} />
              </button>

              {isOpen && visibleItems.map((item) => {
                const count = item.badge ? (counts[item.badge] || 0) : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between pl-9 pr-3 py-1.5 mx-1 rounded text-[13px] transition-colors',
                        isActive ? 'font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                      )
                    }
                  >
                    <span className="truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center bg-red-500 text-white">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Collapse-all button */}
      <div className="px-3 py-2.5 border-t border-gray-100">
        <button
          onClick={collapseAll}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600"
        >
          <ChevronsLeft className="h-3 w-3" />
          {allCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        </button>
      </div>

      {/* Admin profile */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => { navigate('/profile'); onClose?.() }}
          className="flex items-center gap-2.5 w-full text-left rounded-lg p-1 -m-1 hover:bg-gray-50 transition-colors"
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
  )
}
