import { cn } from '../../utils/cn'

// Page heading is centered on every page; any action buttons stay pinned right.
// Pass `sticky` to keep the heading pinned to the top of the viewport as the
// page scrolls (bg matches the app's gray-50 so content scrolls cleanly under).
export function PageHeader({ title, description, actions, eyebrow, sticky = false }) {
  return (
    <div
      className={cn(
        'relative min-h-[2.25rem] flex flex-col items-center text-center',
        sticky ? 'sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm py-3 mb-5' : 'mb-5'
      )}
    >
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {actions && (
        <div className="absolute right-0 top-0 flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
