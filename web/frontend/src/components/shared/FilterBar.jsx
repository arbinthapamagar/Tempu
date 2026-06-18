import { Search, X, ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

// Right-aligned filter row that sits at the top of a table card: dropdown
// selects first, then the search box (the ShipOS layout).
export function FilterBar({ search, onSearch, filters = [], className }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2.5', className)}>
      {filters.map((f, i) => (
        <div key={i} className="relative">
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="">{f.placeholder}</option>
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>
      ))}

      {onSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search"
            className="w-[180px] pl-8 pr-7 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-orange-500"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
