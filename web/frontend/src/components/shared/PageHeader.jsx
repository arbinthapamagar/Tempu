// Page heading is centered on every page; any action buttons stay pinned right.
export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="relative mb-5 min-h-[2.25rem] flex flex-col items-center text-center">
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {actions && (
        <div className="absolute right-0 top-0 flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
