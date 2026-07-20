import { useEffect } from 'react'
import { X } from '@/components/ui/icons'
import { cn } from '../../utils/cn'

const sizes = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export function Modal({ open, onClose, title, children, size = 'md', footer, align = 'center' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]',
          sizes[size],
          // Nudge the dialog toward the right on wider screens when requested.
          align === 'right' && 'lg:translate-x-24'
        )}
      >
        {title ? (
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          // No title → floating close button, so headerless dialogs (e.g. confirms) stay compact.
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
