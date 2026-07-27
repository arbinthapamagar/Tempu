import { Check, X, AlertTriangle, CheckCircle, Ban, ShieldCheck } from '@/components/ui/icons'
import { cn } from '../../utils/cn'

// Confirmation card for a write action Tempu Ai has PREPARED but not performed.
// The agent can only ever propose; the change happens when the admin clicks Send
// here, which posts the proposal's signed token back to /admin/agentic/action.
//
// `action` is the proposal from the chat response, carrying its own resolution
// state so the transcript stays truthful after a refresh:
//   { action, label, summary, fields: [{label, value}], token,
//     status?: 'sending' | 'done' | 'cancelled' | 'error' | 'expired', result? }
// No status = still awaiting a decision. A persisted card loses its token (they
// expire server-side after 15 minutes) and comes back as 'expired'.
export function ActionCard({ action, onConfirm, onCancel }) {
  const status = action.status || 'pending'
  const settled = ['done', 'cancelled', 'error', 'expired'].includes(status)

  return (
    <div
      className={cn(
        'my-3 rounded-xl border overflow-hidden',
        status === 'done' && 'border-green-200 bg-green-50/40',
        status === 'error' && 'border-red-200 bg-red-50/40',
        (status === 'cancelled' || status === 'expired') && 'border-gray-200 bg-gray-50/60',
        (status === 'pending' || status === 'sending') && 'border-orange-200 bg-orange-50/40'
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5">
        <StatusIcon status={status} />
        <span className="text-sm font-semibold text-gray-900">{action.label || 'Confirm action'}</span>
        {settled && (
          <span className="ml-auto text-[11px] uppercase tracking-wide text-gray-400">
            {status === 'done' ? 'Done' : status === 'error' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Expired'}
          </span>
        )}
      </div>

      <dl className="px-4 py-3 space-y-1.5">
        {(action.fields || []).map((f, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <dt className="w-28 shrink-0 text-gray-500">{f.label}</dt>
            <dd className="flex-1 text-gray-900 whitespace-pre-wrap break-words">{f.value}</dd>
          </div>
        ))}
      </dl>

      {status === 'done' && action.result && (
        <p className="px-4 pb-3 text-sm text-green-700">{action.result}</p>
      )}
      {status === 'error' && (
        <p className="px-4 pb-3 text-sm text-red-700">{action.result || 'That action could not be completed.'}</p>
      )}
      {status === 'expired' && (
        <p className="px-4 pb-3 text-xs text-gray-500">
          This confirmation is no longer valid. Ask Tempu Ai to prepare it again.
        </p>
      )}

      {(status === 'pending' || status === 'sending' || status === 'error') && action.token && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-black/5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={status === 'sending'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            {status === 'sending' ? 'Sending…' : status === 'error' ? 'Retry' : 'Send'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={status === 'sending'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <span className="ml-auto hidden sm:inline text-[11px] text-gray-400">
            Nothing has happened yet
          </span>
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'done') return <CheckCircle className="h-4 w-4 text-green-600" />
  if (status === 'error') return <AlertTriangle className="h-4 w-4 text-red-600" />
  if (status === 'cancelled' || status === 'expired') return <Ban className="h-4 w-4 text-gray-400" />
  return <ShieldCheck className="h-4 w-4 text-orange-500" />
}
