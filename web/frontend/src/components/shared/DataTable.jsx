import { ChevronsUpDown } from '@/components/ui/icons'
import { TableSpinner } from '../ui/Spinner'
import { EmptyState } from './EmptyState'
import { cn } from '../../utils/cn'

// ShipOS-style table: uppercase grey header row with a sort glyph per column,
// hairline row dividers, and a subtle hover. Columns can opt out of the sort
// glyph with `col.sortable === false`.
export function DataTable({ columns, data, isLoading, emptyTitle, emptyDesc, onRowClick }) {
  if (isLoading) return <TableSpinner />

  if (!data?.length) {
    return <EmptyState title={emptyTitle} description={emptyDesc} />
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3.5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                  col.className
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable !== false && col.header && (
                    <ChevronsUpDown className="h-3 w-3 text-gray-300" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row._id || row.id || i}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3.5 py-2.5 text-[13px] text-gray-700 whitespace-nowrap',
                    col.cellClassName
                  )}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
