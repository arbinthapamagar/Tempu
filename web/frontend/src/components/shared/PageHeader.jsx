export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="flex items-start justify-between mb-5 gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500 max-w-prose">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div>}
    </div>
  )
}
