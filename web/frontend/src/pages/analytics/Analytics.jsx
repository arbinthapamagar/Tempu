import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Users, Car, DollarSign, Navigation } from '@/components/ui/icons'
import { StatsCard } from '../../components/shared/StatsCard'
import { PageHeader } from '../../components/shared/PageHeader'
import { analyticsApi } from '../../api/analytics.api'
import { formatCurrency } from '../../utils/format'

const PERIODS = [
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
  { value: 'year', label: '12 Months' },
  { value: 'custom', label: 'Custom' },
]

export default function Analytics() {
  const [period, setPeriod] = useState('month')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const todayStr = () => new Date().toISOString().slice(0, 10)
  const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

  // Switching to Custom pre-fills the last 30 days so data loads right away;
  // the user then adjusts the dates to refilter.
  const selectPeriod = (v) => {
    if (v === 'custom' && (!start || !end)) { setStart(daysAgoStr(30)); setEnd(todayStr()) }
    setPeriod(v)
  }

  // Use the custom range when both dates are set; otherwise fall back to a period
  // so the charts always show something (never blank).
  const useCustom = period === 'custom' && Boolean(start) && Boolean(end)
  const fallbackPeriod = period === 'custom' ? 'month' : period
  const filter = useCustom ? { start, end } : { period: fallbackPeriod }
  const filterKey = useCustom ? `custom:${start}:${end}` : fallbackPeriod

  const { data: overviewRes, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', filterKey],
    queryFn: () => analyticsApi.overview(filter),
    staleTime: 60_000,
  })

  const { data: tripsRes, isLoading: tripsLoading } = useQuery({
    queryKey: ['analytics-trips', filterKey],
    queryFn: () => analyticsApi.trips(filter),
    staleTime: 60_000,
  })

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ['analytics-users', filterKey],
    queryFn: () => analyticsApi.users(filter),
    staleTime: 60_000,
  })

  const { data: topDriversRes, isLoading: driversLoading } = useQuery({
    queryKey: ['analytics-top-drivers'],
    queryFn: analyticsApi.topDrivers,
    staleTime: 60_000,
  })

  const overview = overviewRes?.data || overviewRes || {}
  const tripsData = tripsRes?.data || tripsRes || []
  const usersData = usersRes?.data || usersRes || []
  const topDrivers = topDriversRes?.data || topDriversRes || []

  const isLoading = overviewLoading

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform-wide insights and performance metrics"
      />

      {/* Period dropdown + (when custom) date range — on its own row so nothing is hidden */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-5">
        <select
          value={period}
          onChange={(e) => selectPeriod(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:border-orange-500 cursor-pointer"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="px-2.5 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:border-orange-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="px-2.5 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:border-orange-500"
            />
          </div>
        )}
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3 mb-6">
        <StatsCard
          title="Total Trips"
          value={overview.totalTrips?.toLocaleString() ?? '—'}
          icon={Navigation}
          color="indigo"
          subtitle={`${overview.completedTrips?.toLocaleString() ?? 0} completed`}
          loading={isLoading}
        />
        <StatsCard
          title="Total Revenue"
          value={overview.totalRevenue != null ? formatCurrency(overview.totalRevenue) : '—'}
          icon={DollarSign}
          color="emerald"
          subtitle="Platform fees"
          loading={isLoading}
        />
        <StatsCard
          title="New Users"
          value={overview.newUsers?.toLocaleString() ?? '—'}
          icon={Users}
          color="blue"
          subtitle={`${overview.activeUsers?.toLocaleString() ?? 0} active total`}
          loading={isLoading}
        />
        <StatsCard
          title="Active Drivers"
          value={overview.activeDrivers?.toLocaleString() ?? '—'}
          icon={Car}
          color="purple"
          subtitle="Approved drivers"
          loading={isLoading}
        />
      </div>

      {/* Trips & Revenue area chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Trips & Revenue Trend</h3>
            <p className="text-xs text-gray-400">Performance over selected period</p>
          </div>
          <TrendingUp className="h-5 w-5 text-orange-400 shrink-0" />
        </div>
        {tripsLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading...</div>
        ) : tripsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={tripsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v, name) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'Revenue' : 'Trips']} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="trips" stroke="#f97316" fill="url(#colorTrips)" strokeWidth={2} name="trips" />
              <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} name="revenue" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">No data for selected period</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3 mb-6">
        {/* User & Driver growth */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">User & Driver Growth</h3>
          <p className="text-xs text-gray-400 mb-4">New registrations over selected period</p>
          {usersLoading ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">Loading...</div>
          ) : usersData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usersData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="users" fill="#f97316" radius={[3, 3, 0, 0]} name="Users" maxBarSize={18} />
                <Bar dataKey="drivers" fill="#10b981" radius={[3, 3, 0, 0]} name="Drivers" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">No data for selected period</div>
          )}
        </div>

        {/* Trip status breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Trip Completion Rate</h3>
          <p className="text-xs text-gray-400 mb-4">Completed vs cancelled</p>
          {tripsLoading ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">Loading...</div>
          ) : tripsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tripsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" radius={[0, 0, 0, 0]} name="Completed" stackId="a" maxBarSize={22} />
                <Bar dataKey="cancelled" fill="#ef4444" radius={[3, 3, 0, 0]} name="Cancelled" stackId="a" maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">No data for selected period</div>
          )}
        </div>
      </div>

      {/* Top Drivers */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Performing Drivers</h3>
        {driversLoading ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-400">Loading...</div>
        ) : topDrivers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Driver</th>
                  <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Rides</th>
                  <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Rating</th>
                  <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((driver, i) => (
                  <tr key={driver._id || i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-sm font-bold text-orange-600">#{i + 1}</td>
                    <td className="py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{driver.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{driver.vehicleType}</p>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-600 text-right">{driver.rides?.toLocaleString() ?? 0}</td>
                    <td className="py-3 text-sm text-right">
                      <span className="text-amber-500 font-semibold">⭐ {driver.rating?.toFixed(1) ?? '0.0'}</span>
                    </td>
                    <td className="py-3 text-sm font-semibold text-emerald-600 text-right">{formatCurrency(driver.earnings || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-gray-400">No driver data yet</div>
        )}
      </div>
    </div>
  )
}
