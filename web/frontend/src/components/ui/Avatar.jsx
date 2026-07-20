import { cn } from '../../utils/cn'

const sizes = {
  xxs: 'h-5 w-5 text-[10px]',
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
}

export function Avatar({ src, name, size = 'md', className }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  // Default avatar is always light green with green initials.
  const color = 'bg-green-100 text-green-700'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
        onError={(e) => { e.target.style.display = 'none' }}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0',
        sizes[size],
        color,
        className
      )}
    >
      {initials}
    </div>
  )
}
