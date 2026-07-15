import { useQuery } from '@tanstack/react-query'
import { Star } from '@/components/ui/icons'
import { supportApi } from '../../api/support.api'

// A support agent's rating summary + individual customer feedback. Reused in the
// admin detail modal and the agent's own profile. `agentId` is the Admin _id.
export function AgentRatings({ agentId, title = 'Support ratings' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-ratings', agentId],
    queryFn: () => supportApi.agentRatings(agentId),
    enabled: !!agentId,
  })
  const summary = data?.data?.summary
  const items = data?.data?.items || []

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading ratings…</p>
      ) : !summary || summary.count === 0 ? (
        <p className="text-sm text-gray-400">No ratings yet.</p>
      ) : (
        <>
          {/* Summary: average + star distribution */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-amber-100 bg-amber-50 mb-3">
            <div className="text-center shrink-0">
              <p className="text-3xl font-bold text-amber-600 leading-none">{summary.avg.toFixed(1)}</p>
              <div className="flex items-center gap-0.5 justify-center mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3 w-3 ${n <= Math.round(summary.avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">{summary.count} rating{summary.count === 1 ? '' : 's'}</p>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary.distribution?.[n] || 0
                const pct = summary.count ? (c / summary.count) * 100 : 0
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 w-3">{n}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-amber-200/60 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400 w-6 text-right">{c}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Individual feedback */}
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {items.map((it) => (
              <div key={it.ticketId} className="p-3 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= it.score ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate">{it.customer}</span>
                </div>
                {it.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {it.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{tag}</span>
                    ))}
                  </div>
                )}
                {it.comment && <p className="text-sm text-gray-700 mt-1.5 italic">“{it.comment}”</p>}
                <p className="text-[11px] text-gray-400 mt-1 truncate">{it.subject}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
