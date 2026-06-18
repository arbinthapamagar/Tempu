import { cn } from '../../utils/cn'

// Flat status pills — soft tint, rounded, readable.
const variants = {
  default: 'bg-gray-100 text-gray-600 border-gray-200',
  primary: 'bg-orange-50 text-orange-700 border-orange-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
}

export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
