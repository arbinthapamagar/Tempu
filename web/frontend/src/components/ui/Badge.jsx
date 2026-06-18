import { cn } from '../../utils/cn'

// Status badges are plain coloured text (no background, no border) everywhere.
const soft = {
  default: 'text-gray-500',
  primary: 'text-orange-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-blue-600',
  purple: 'text-violet-600',
}

// Solid count pills (ShipOS table) keep their filled background.
const solid = {
  solidGreen: 'bg-green-500 text-white border-green-500',
  solidRose: 'bg-rose-500 text-white border-rose-500',
}

export function Badge({ children, variant = 'default', className }) {
  if (solid[variant]) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap',
          solid[variant],
          className
        )}
      >
        {children}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center text-xs font-semibold whitespace-nowrap', soft[variant] || soft.default, className)}>
      {children}
    </span>
  )
}
