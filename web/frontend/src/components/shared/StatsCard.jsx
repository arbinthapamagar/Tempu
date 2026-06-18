import { cn } from '../../utils/cn'

// Flat stat tile: white card, soft icon chip, neutral caption, bold figure.
export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'accent', loading }) {
  const colorMap = {
    indigo: { bg: 'bg-orange-50', icon: 'text-orange-600' },
    accent: { bg: 'bg-orange-50', icon: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    red: { bg: 'bg-red-50', icon: 'text-red-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    purple: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600' },
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600' },
  }
  const c = colorMap[color] || colorMap.accent

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-colors hover:border-gray-300">
      <div className="flex items-center gap-2.5 mb-2.5">
        {Icon && (
          <div className={cn('shrink-0 p-2 rounded-lg grid place-items-center', c.bg)}>
            <Icon className={cn('h-4 w-4', c.icon)} />
          </div>
        )}
        <p className="eyebrow truncate flex-1">{title}</p>
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold text-gray-900 leading-none truncate">{value}</p>
      )}
      {subtitle && !loading && (
        <p className={cn('mt-1.5 text-xs truncate', trend?.positive ? 'text-emerald-600' : trend?.negative ? 'text-red-500' : 'text-gray-500')}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
