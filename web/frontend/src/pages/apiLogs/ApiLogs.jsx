import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  History, Monitor, Phone, Settings, Repeat, Trash2, Search, X, Copy,
  ChevronLeft, ChevronRight,
} from '@/components/ui/icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { TableSpinner } from '../../components/ui/Spinner'
import { apiLogsApi } from '../../api/apiLogs.api'
import { formatDateTime, formatRelative } from '../../utils/format'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../utils/cn'
import toast from 'react-hot-toast'

// The three top-level sections, matching the backend `source` tag.
const SECTIONS = [
  { key: 'backend', label: 'Backend', icon: Settings },
  { key: 'web', label: 'Web Frontend', icon: Monitor },
  { key: 'mobile', label: 'Mobile', icon: Phone },
]

const DOMAINS = [
  'user', 'driver', 'admin', 'support', 'trip', 'transaction', 'subscription',
  'supplier', 'document', 'review', 'notification', 'message', 'bid', 'callLog', 'auth',
]
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx']

const methodColor = (m) => ({
  GET: 'text-blue-600 bg-blue-50',
  POST: 'text-emerald-600 bg-emerald-50',
  PUT: 'text-amber-600 bg-amber-50',
  PATCH: 'text-violet-600 bg-violet-50',
  DELETE: 'text-red-600 bg-red-50',
}[m] || 'text-gray-600 bg-gray-100')

const statusColor = (code) => {
  if (code >= 500) return 'text-red-600'
  if (code >= 400) return 'text-amber-600'
  if (code >= 300) return 'text-blue-600'
  if (code >= 200) return 'text-emerald-600'
  return 'text-gray-500'
}

export default function ApiLogs() {
  const admin = useAuthStore((s) => s.admin)
  const qc = useQueryClient()

  const [section, setSection] = useState('backend')
  const [filters, setFilters] = useState({ domain: '', method: '', status: '', search: '' })
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // Superadmin-only feature (backend enforces it too).
  if (admin?.role !== 'superadmin') {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="API Log" />
        <div className="bg-white rounded-xl border border-gray-200 p-10">
          <EmptyState
            icon={History}
            title="Superadmin only"
            description="The API Log shows full request and response data across the platform, so it is restricted to superadmins."
          />
        </div>
      </div>
    )
  }

  const statsQ = useQuery({ queryKey: ['api-log-stats'], queryFn: () => apiLogsApi.stats() })
  const stats = statsQ.data?.data

  const listQ = useQuery({
    queryKey: ['api-logs', section, filters, page],
    queryFn: () => apiLogsApi.list({ source: section, ...filters, page, limit: 25 }),
    keepPreviousData: true,
  })
  const logs = listQ.data?.data?.logs || []
  const pagination = listQ.data?.pagination

  const clearMut = useMutation({
    mutationFn: () => apiLogsApi.clear(section),
    onSuccess: (res) => {
      toast.success(res?.message || 'Cleared')
      setConfirmClear(false)
      qc.invalidateQueries({ queryKey: ['api-logs'] })
      qc.invalidateQueries({ queryKey: ['api-log-stats'] })
    },
    onError: (e) => toast.error(e?.message || 'Failed to clear logs'),
  })

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1) }
  const submitSearch = (e) => { e.preventDefault(); setFilter('search', searchDraft.trim()) }
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['api-logs'] })
    qc.invalidateQueries({ queryKey: ['api-log-stats'] })
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="API Log"
        description="Every API request and response, across web, mobile, and backend."
        actions={
          <>
            <Button variant="secondary" icon={Repeat} onClick={refresh}>Refresh</Button>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmClear(true)}>Clear</Button>
          </>
        }
      />

      {/* Section tabs */}
      <div className="flex gap-1.5 mb-4">
        {SECTIONS.map((s) => {
          const count = stats?.bySource?.[s.key] ?? 0
          return (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setPage(1) }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                section === s.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <s.icon className="h-4 w-4" /> {s.label}
              <span className={cn('ml-1 text-xs', section === s.key ? 'text-orange-100' : 'text-gray-400')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="w-40">
          <Select
            value={filters.domain}
            onChange={(e) => setFilter('domain', e.target.value)}
            placeholder="All domains"
            options={DOMAINS.map((d) => ({ value: d, label: d }))}
          />
        </div>
        <div className="w-32">
          <Select
            value={filters.method}
            onChange={(e) => setFilter('method', e.target.value)}
            placeholder="Any method"
            options={METHODS.map((m) => ({ value: m, label: m }))}
          />
        </div>
        <div className="w-32">
          <Select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            placeholder="Any status"
            options={STATUS_CLASSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <form onSubmit={submitSearch} className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search URL or message…"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {listQ.isLoading ? (
          <TableSpinner />
        ) : !logs.length ? (
          <EmptyState icon={History} title="No requests logged" description="Traffic will appear here as the apps make API calls." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-1 font-medium">When</th>
                  <th className="px-2 py-1 font-medium">Method</th>
                  <th className="px-2 py-1 font-medium">Status</th>
                  <th className="px-2 py-1 font-medium">Domain</th>
                  <th className="px-2 py-1 font-medium">URL</th>
                  <th className="px-2 py-1 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    onClick={() => setOpenId(log._id)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-1 text-gray-500 whitespace-nowrap" title={formatDateTime(log.createdAt)}>
                      {formatRelative(log.createdAt)}
                    </td>
                    <td className="px-2 py-1">
                      <span className={cn('inline-block rounded px-1.5 py-0.5 text-[11px] font-bold', methodColor(log.method))}>
                        {log.method}
                      </span>
                    </td>
                    <td className={cn('px-2 py-1 font-semibold tabular-nums', statusColor(log.statusCode))}>
                      {log.statusCode}
                    </td>
                    <td className="px-2 py-1 text-gray-600">{log.domain}</td>
                    <td className="px-2 py-1 text-gray-800 font-mono text-xs max-w-[340px] truncate" title={log.url}>
                      {log.url}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-400 tabular-nums whitespace-nowrap">{log.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{pagination.total} request(s) · page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {openId && <LogDetail id={openId} onClose={() => setOpenId(null)} />}

      <ConfirmDialog
        open={confirmClear}
        title={`Clear ${SECTIONS.find((s) => s.key === section)?.label} logs?`}
        message="This permanently deletes the captured request/response logs for this section. This cannot be undone."
        confirmLabel="Clear logs"
        variant="danger"
        loading={clearMut.isPending}
        onConfirm={() => clearMut.mutate()}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}

// Slide-over showing the full captured request + response for one entry.
function LogDetail({ id, onClose }) {
  const { data, isLoading } = useQuery({ queryKey: ['api-log', id], queryFn: () => apiLogsApi.get(id) })
  const log = data?.data?.log

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Request detail</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || !log ? (
          <TableSpinner />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-bold', methodColor(log.method))}>{log.method}</span>
              <span className={cn('font-semibold', statusColor(log.statusCode))}>{log.statusCode}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{log.source} · {log.domain} · {log.durationMs}ms</span>
            </div>

            <Field label="Requested URL" value={log.url} mono copyable />
            <Kv label="When" value={formatDateTime(log.createdAt)} />
            <Kv label="Client / source" value={log.source} />
            <Kv label="IP" value={log.ip || '—'} />
            <Kv label="User agent" value={log.userAgent || '—'} />
            {log.actorType && <Kv label="Authenticated as" value={`${log.actorType} (${log.actorId || 'n/a'})`} />}

            <JsonBlock label="Request headers" value={log.requestHeaders} />
            <JsonBlock label="Request query" value={log.requestQuery} />
            <JsonBlock label="Request params" value={log.requestParams} />
            <JsonBlock label="Request data (body)" value={log.requestBody} />
            <JsonBlock label="API response" value={log.responseBody} />
            <JsonBlock label="Normalized response" value={log.normalized} />
          </div>
        )}
      </div>
    </div>
  )
}

function Kv({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 text-right break-all">{value}</span>
    </div>
  )
}

function Field({ label, value, mono, copyable }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        {copyable && (
          <button
            onClick={() => { navigator.clipboard?.writeText(String(value)); toast.success('Copied') }}
            className="text-gray-400 hover:text-gray-600"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className={cn('text-sm text-gray-800 break-all', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  )
}

function JsonBlock({ label, value }) {
  const empty = value == null || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        {!empty && (
          <button
            onClick={() => { navigator.clipboard?.writeText(text); toast.success('Copied') }}
            className="text-gray-400 hover:text-gray-600"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-xs text-gray-400 italic">(empty)</p>
      ) : (
        <pre className="text-[11px] leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-x-auto text-gray-800 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
          {text}
        </pre>
      )}
    </div>
  )
}
