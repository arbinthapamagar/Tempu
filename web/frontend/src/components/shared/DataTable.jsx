import { ChevronsUpDown, Check } from '@/components/ui/icons'
import { TableSpinner } from '../ui/Spinner'
import { EmptyState } from './EmptyState'
import { cn } from '../../utils/cn'

// Small flat checkbox used for row selection.
function Checkbox({ checked, onClick, title }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      title={title}
      className={cn(
        'h-4 w-4 rounded border grid place-items-center shrink-0 transition-colors',
        checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300 hover:border-orange-400'
      )}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </button>
  )
}

// ShipOS-style table: uppercase grey header row with a sort glyph per column,
// hairline row dividers, and a subtle hover. Columns can opt out of the sort
// glyph with `col.sortable === false`.
// Optional row selection: pass `selectable`, a `selectedIds` Set, `onToggleRow(row)`
// and `onToggleAll()` (header toggles every row on the current page).
export function DataTable({
  columns, data, isLoading, emptyTitle, emptyDesc, onRowClick,
  selectable = false, selectedIds, onToggleRow, onToggleAll, getRowId,
}) {
  if (isLoading) return <TableSpinner />

  if (!data?.length) {
    return <EmptyState title={emptyTitle} description={emptyDesc} />
  }

  const rowId = getRowId || ((row) => row._id || row.id)
  const allChecked = selectable && data.every((r) => selectedIds?.has(rowId(r)))

  return (
    // Body scrolls inside the card; the header row stays pinned (sticky) so the
    // column titles never move while scrolling a long list.
    <div className="overflow-auto max-h-[calc(100vh-11rem)]">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            {selectable && (
              <th className="sticky top-0 z-10 bg-gray-50 px-3.5 py-0.5 w-10">
                <Checkbox checked={allChecked} onClick={onToggleAll} title="Select all on page" />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'sticky top-0 z-10 bg-gray-50 px-3.5 py-0.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
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
          {data.map((row, i) => {
            const id = rowId(row)
            const checked = selectable && selectedIds?.has(id)
            return (
              <tr
                key={id || i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer',
                  checked && 'bg-orange-50/40'
                )}
              >
                {selectable && (
                  <td className="px-3.5 py-0.5">
                    <Checkbox checked={checked} onClick={() => onToggleRow?.(row)} title="Select" />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3.5 py-0.5 text-[13px] text-gray-700 whitespace-nowrap leading-tight',
                      col.cellClassName
                    )}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
