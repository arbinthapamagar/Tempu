import { useQuery } from '@tanstack/react-query'
import {
  Users, Car, Navigation, DollarSign, Clock, MessageSquare,
  Repeat, FileText, TrendingUp,
} from '@/components/ui/icons'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { StatsCard } from '../components/shared/StatsCard'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { StatusBadge } from '../components/shared/StatusBadge'
import { dashboardApi } from '../api/dashboard.api'
import { analyticsApi } from '../api/analytics.api'
import { formatCurrency, formatDate } from '../utils/format'
import { Link } from 'react-router-dom'

const VEHICLE_COLORS = {
  bike: '#6366f1', car: '#10b981', tuktuk: '#f59e0b', ev: '#3b82f6',
  scooter: '#8b5cf6', comfort: '#ec4899', taxi: '#10b981', tuktuk_delivery: '#3b82f6',
}

const STATUS_COLORS = {
  completed: '#10b981', cancelled: '#ef4444',
  started: '#6366f1', pending: '#f59e0b',
  arriving: '#3b82f6', accepted: '#8b5cf6',
}

export default function Dashboard() {
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
  })

  const { data: tripsRes, isLoading: tripsLoading } = useQuery({
    queryKey: ['dashboard-recent-trips'],
    queryFn: () => dashboardApi.recentTrips(5),
    staleTime: 30_000,
  })

  const { data: tripsChartRes } = useQuery({
    queryKey: ['analytics-trips', 'week'],
    queryFn: () => analyticsApi.trips('week'),
    staleTime: 60_000,
  })

  const stats = statsRes?.data || statsRes || {}
  const recentTrips = tripsRes?.data || tripsRes || []
  const tripsChartData = tripsChartRes?.data || tripsChartRes || []

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers?.toLocaleString() ?? '—', icon: Users, color: 'indigo', subtitle: 'Registered passengers', to: '/users' },
    { title: 'Active Drivers', value: stats.activeDrivers?.toLocaleString() ?? '—', icon: Car, color: 'emerald', subtitle: 'Online & approved', to: '/drivers?status=approved' },
    { title: "Today's Trips", value: stats.tripsToday?.toLocaleString() ?? '—', icon: Navigation, color: 'blue', subtitle: 'Across all vehicle types', to: '/trips' },
    { title: "Today's Revenue", value: stats.revenueToday != null ? formatCurrency(stats.revenueToday) : '—', icon: DollarSign, color: 'purple', subtitle: 'Platform earnings', to: '/transactions' },
    { title: 'Pending Documents', value: stats.pendingDocuments?.toLocaleString() ?? '—', icon: FileText, color: 'amber', subtitle: 'Awaiting verification', to: '/documents' },
    { title: 'Open Tickets', value: stats.openTickets?.toLocaleString() ?? '—', icon: MessageSquare, color: 'rose', subtitle: 'Support requests', to: '/support?status=open' },
    { title: 'Subscriptions', value: stats.activeSubscriptions?.toLocaleString() ?? '—', icon: Repeat, color: 'teal', subtitle: 'Active plans', to: '/subscriptions' },
    { title: 'Pending Drivers', value: stats.pendingDrivers?.toLocaleString() ?? '—', icon: Clock, color: 'red', subtitle: 'Awaiting approval', to: '/drivers?status=pending' },
  ]

  const tripColumns = [
    {
      key: 'riderName', header: 'Rider',
      render: (val) => <span className="font-medium text-gray-900">{val || '—'}</span>,
    },
    { key: 'driverName', header: 'Driver', render: (val) => val || <span className="text-gray-400 italic text-xs">Unassigned</span> },
    {
      key: 'vehicleType', header: 'Vehicle',
      render: (val) => (
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VEHICLE_COLORS[val] || '#9ca3af' }} />
          <span className="capitalize text-xs">{val}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (val) => <StatusBadge status={val} /> },
    {
      key: 'finalPrice', header: 'Price',
      render: (val, row) => formatCurrency(val || row.offeredPrice),
    },
    { key: 'createdAt', header: 'Time', render: (val) => formatDate(val, 'hh:mm a') },
  ]

  // Build status distribution from recent trips for pie chart
  const statusCounts = recentTrips.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})
  const statusDist = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: STATUS_COLORS[name] || '#9ca3af',
  }))

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Overview of platform activity" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatsCard key={card.title} {...card} loading={statsLoading} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly trips line chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Weekly Performance</h3>
              <p className="text-xs text-gray-400">Trips and revenue over the last 7 days</p>
            </div>
            <TrendingUp className="h-5 w-5 text-orange-400 shrink-0" />
          </div>
          {tripsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tripsChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="trips" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(val, name) => [name === 'revenue' ? formatCurrency(val) : val, name === 'revenue' ? 'Revenue' : 'Trips']}
                />
                <Line yAxisId="trips" type="monotone" dataKey="trips" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              {tripsLoading ? 'Loading chart...' : 'No data for this period'}
            </div>
          )}
          <div className="flex gap-3 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-4 bg-orange-500 rounded" />Trips</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-4 bg-emerald-500 rounded" />Revenue</span>
          </div>
        </div>

        {/* Trip status distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Trip Status</h3>
            <p className="text-xs text-gray-400">Distribution of recent trips</p>
          </div>
          {statusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDist.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [val, '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusDist.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.name}</span>
                    </span>
                    <span className="font-medium text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">No trip data yet</div>
          )}
        </div>
      </div>

      {/* Revenue bar chart */}
      {tripsChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Daily Revenue</h3>
            <p className="text-xs text-gray-400">Platform earnings this week (NPR)</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tripsChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(val) => [formatCurrency(val), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent trips + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Recent Trips</h3>
            <Link to="/trips" className="text-xs text-orange-600 hover:text-orange-700 font-medium">View all →</Link>
          </div>
          <DataTable
            columns={tripColumns}
            data={Array.isArray(recentTrips) ? recentTrips : []}
            isLoading={tripsLoading}
            emptyTitle="No trips yet"
          />
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { to: '/documents', icon: FileText, label: 'Review Documents', desc: stats.pendingDocuments ? `${stats.pendingDocuments} pending` : 'Check queue', color: 'text-amber-600' },
              { to: '/drivers?status=pending', icon: Car, label: 'Approve Drivers', desc: stats.pendingDrivers ? `${stats.pendingDrivers} waiting` : 'Check queue', color: 'text-orange-600' },
              { to: '/support?status=open', icon: MessageSquare, label: 'Support Tickets', desc: stats.openTickets ? `${stats.openTickets} open` : 'All clear', color: 'text-rose-600' },
              { to: '/analytics', icon: TrendingUp, label: 'View Analytics', desc: 'Insights & reports', color: 'text-orange-600' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
