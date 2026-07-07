import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom'
import {
  Inbox, Mail, Clock, CheckCircle2, Archive, UserCheck, UserX,
  Search, Mic, Paperclip, Phone, Video, MessageSquare,
} from '@/components/ui/icons'
import { cn } from '../../utils/cn'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { supportApi } from '../../api/support.api'
import { useAuthStore } from '../../store/authStore'
import { formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

const PERMISSION_ROWS = [
  { key: 'voiceMessages', label: 'Voice messages', icon: Mic },
  { key: 'documents', label: 'Documents', icon: Paperclip },
  { key: 'audioCall', label: 'Audio call', icon: Phone },
  { key: 'videoCall', label: 'Video call', icon: Video },
]

const CATEGORY_LABELS = {
  trip_issue: 'Trip', payment_issue: 'Payment', driver_complaint: 'Driver',
  rider_complaint: 'Rider', document_issue: 'Document', subscription_issue: 'Subscription',
  account_issue: 'Account', other: 'Other',
}

const STATUS_DOT = {
  open: 'bg-amber-500', in_progress: 'bg-blue-500', resolved: 'bg-emerald-500', closed: 'bg-gray-300',
}

// A ticket is "unanswered" when the last entry is from the customer (or there are
// no replies yet) and it isn't resolved/closed.
function isUnanswered(t) {
  if (t.status === 'resolved' || t.status === 'closed') return false
  const last = t.messages?.[t.messages.length - 1]
  return !last || last.senderType !== 'admin'
}

// Empty right pane shown at /support with nothing selected.
export function EmptyConversation() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-white">
      <MessageSquare className="h-7 w-7 text-gray-300 mb-3" />
      <p className="text-sm text-gray-600">Select a conversation</p>
      <p className="text-xs text-gray-400 mt-1">Pick a ticket from the list to read and reply.</p>
    </div>
  )
}

// Left rail: status folders, personal filters, and the global permission toggles.
function FolderRail() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const status = params.get('status') || ''
  const view = params.get('view') || ''

  const { data: countsRes } = useQuery({
    queryKey: ['support-counts'],
    queryFn: () => supportApi.list({ limit: 1 }),
    refetchInterval: 10000,
  })
  const counts = countsRes?.data?.counts || {}

  // Count of never-answered tickets across ALL statuses (open + in_progress),
  // so an unanswered ticket is never lost just because it moved to in_progress.
  const { data: unansweredRes } = useQuery({
    queryKey: ['support-unanswered'],
    queryFn: () => supportApi.list({ limit: 100 }),
    refetchInterval: 10000,
  })
  const unansweredCount = (unansweredRes?.data?.tickets || []).filter(isUnanswered).length

  const { data: settingsRes } = useQuery({ queryKey: ['support-settings'], queryFn: () => supportApi.settings() })
  const settings = settingsRes?.data || {}

  const updateMutation = useMutation({
    mutationFn: (patch) => supportApi.updateSettings(patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-settings'] }); toast.success('Permissions updated') },
    onError: (err) => toast.error(err?.message || 'Failed to update'),
  })

  const folders = [
    { to: '/support?view=unanswered', label: 'Unanswered', icon: Mail, count: unansweredCount, isActive: view === 'unanswered' },
    { to: '/support', label: 'All', icon: Inbox, count: counts.all, isActive: !status && !view },
    { to: '/support?status=open', label: 'New', icon: Mail, count: counts.open, isActive: status === 'open' },
    { to: '/support?status=in_progress', label: 'In progress', icon: Clock, count: counts.in_progress, isActive: status === 'in_progress' },
    { to: '/support?status=resolved', label: 'Resolved', icon: CheckCircle2, count: counts.resolved, isActive: status === 'resolved' },
    { to: '/support?status=closed', label: 'Closed', icon: Archive, count: counts.closed, isActive: status === 'closed' },
  ]

  const personal = [
    { to: '/support?view=mine', label: 'Assigned to me', icon: UserCheck, isActive: view === 'mine' },
    { to: '/support?view=unassigned', label: 'Unassigned', icon: UserX, isActive: view === 'unassigned' },
  ]

  const Item = ({ to, label, icon: Icon, count, isActive }) => (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
        isActive ? 'bg-gray-200/70 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-gray-700' : 'text-gray-400')} />
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && (
        <span className={cn('text-xs tabular-nums', isActive ? 'text-gray-700' : 'text-gray-400')}>
          {count}
        </span>
      )}
    </NavLink>
  )

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {folders.map((f) => <Item key={f.label} {...f} />)}
        <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Personal</p>
        {personal.map((f) => <Item key={f.label} {...f} />)}
      </div>

      {/* Global permissions (apply to every ticket) */}
      <div className="border-t border-gray-200 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Permissions</p>
        <p className="text-[11px] text-gray-400 mb-2">Applies to all tickets. Text chat is always on.</p>
        {PERMISSION_ROWS.map(({ key, label, icon: Icon }) => {
          const on = !!settings[key]
          return (
            <div key={key} className="flex items-center gap-2 py-1">
              <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 text-xs text-gray-600">{label}</span>
              <button
                type="button"
                onClick={() => updateMutation.mutate({ [key]: !on })}
                disabled={updateMutation.isPending}
                title={on ? 'Disable' : 'Enable'}
                className="disabled:opacity-50"
              >
                <span className={cn('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-gray-300')}>
                  <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white transition-transform', on ? 'translate-x-3.5' : 'translate-x-0.5')} />
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

// Middle column: the list of conversations for the current folder/filter.
function ConversationList() {
  const { id: activeId } = useParams()
  const [params] = useSearchParams()
  const admin = useAuthStore((s) => s.admin)
  const status = params.get('status') || ''
  const view = params.get('view') || ''
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('unanswered') // 'unanswered' | 'all'

  const { data, isLoading } = useQuery({
    queryKey: ['support-list', status],
    queryFn: () => supportApi.list({ limit: 50, status: status || undefined }),
    keepPreviousData: true,
    refetchInterval: 10000,
  })

  let tickets = data?.data?.tickets || []

  // Personal views + search + tab are applied client-side over the loaded page.
  if (view === 'mine') tickets = tickets.filter((t) => t.assignedTo?._id === admin?._id)
  if (view === 'unassigned') tickets = tickets.filter((t) => !t.assignedTo)
  if (view === 'unanswered') tickets = tickets.filter(isUnanswered)
  // The All/Unanswered tab only applies on the plain folders, not the dedicated views.
  else if (tab === 'unanswered') tickets = tickets.filter(isUnanswered)
  if (search.trim()) {
    const q = search.toLowerCase()
    tickets = tickets.filter((t) =>
      t.subject?.toLowerCase().includes(q) ||
      t.userId?.name?.toLowerCase().includes(q) ||
      t.userId?.phone?.toLowerCase().includes(q) ||
      t.userId?.email?.toLowerCase().includes(q) ||
      t.guest?.name?.toLowerCase().includes(q) ||
      t.guest?.email?.toLowerCase().includes(q))
  }

  const heading = view === 'mine' ? 'Assigned to me'
    : view === 'unassigned' ? 'Unassigned'
    : view === 'unanswered' ? 'Unanswered'
    : status ? { open: 'New', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }[status]
    : 'All conversations'

  return (
    <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white">
      <div className="px-3 py-3 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-900">{heading}</p>
      </div>

      <div className="px-3 py-2 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 py-1.5 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {!view && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-200">
          {['unanswered', 'all'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('text-xs px-2.5 py-1 capitalize',
                tab === t ? 'text-gray-900 font-semibold border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <p className="px-3 py-6 text-sm text-gray-400">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="px-3 py-6 text-sm text-gray-400">No conversations here.</p>
        ) : (
          tickets.map((t) => {
            const person = t.userId || t.driverId
            // Pre-login guests have no account - fall back to their submitted identity.
            const displayName = person?.name || t.guest?.name || t.guest?.email || 'Guest'
            const last = t.messages?.[t.messages.length - 1]
            const preview = last?.message || t.subject || 'No messages yet'
            const isActive = t._id === activeId
            return (
              <NavLink
                key={t._id}
                to={`/support/${t._id}${status ? `?status=${status}` : view ? `?view=${view}` : ''}`}
                className={cn(
                  'flex gap-2.5 px-3 py-2.5 border-b border-gray-100 cursor-pointer border-l-2',
                  isActive ? 'border-l-gray-900 bg-gray-50' : 'border-l-transparent hover:bg-gray-50/60'
                )}
              >
                <Avatar src={person?.avatarUrl} name={displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatRelative(t.updatedAt || t.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{preview}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[t.status] || 'bg-gray-300')} />
                    <span className="text-[10px] text-gray-400">{CATEGORY_LABELS[t.category] || t.category}</span>
                  </div>
                </div>
              </NavLink>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function SupportInbox() {
  return (
    <div>
      <PageHeader title="Support" description="Help riders and drivers, and keep every conversation in one place." />
      <div className="h-[calc(100vh-9rem)] min-h-[480px] flex border border-gray-200 overflow-hidden bg-white">
        <FolderRail />
        <ConversationList />
        <Outlet />
      </div>
    </div>
  )
}
