import { cn } from '../../utils/cn'

export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'indigo', loading }) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-600' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-600' },
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600', text: 'text-teal-600' },
  }
  const c = colorMap[color] || colorMap.indigo

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 truncate">{title}</p>
          {loading ? (
            <div className="mt-1 h-7 w-24 bg-gray-100 animate-pulse rounded" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          )}
          {subtitle && !loading && (
            <p className={cn('mt-1 text-xs', trend?.positive ? 'text-emerald-600' : trend?.negative ? 'text-red-500' : 'text-gray-500')}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-2.5 shrink-0 ml-3', c.bg)}>
            <Icon className={cn('h-5 w-5', c.icon)} />
          </div>
        )}
      </div>
    </div>
  )
}
