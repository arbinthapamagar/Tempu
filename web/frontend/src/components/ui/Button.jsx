import { cn } from '../../utils/cn'

// Flat, professional buttons — solid fill, subtle hover, no offset shadows.
const variants = {
  primary: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-400',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400',
  // ShipOS-style outline buttons (white fill, coloured border + text)
  outline: 'bg-white text-orange-600 border-[1.5px] border-orange-500 hover:bg-orange-50 focus:ring-orange-400',
  outlineDanger: 'bg-white text-rose-500 border-[1.5px] border-rose-500 hover:bg-rose-50 focus:ring-rose-400',
}

const sizes = {
  xs: 'px-2.5 py-1.5 text-xs rounded-md',
  sm: 'px-3 py-2 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  icon: Icon,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}
