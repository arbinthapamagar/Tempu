import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom'
import {
  Inbox, Mail, Clock, CheckCircle2, Archive, UserCheck, UserX,
  Search, Mic, Paperclip, Phone, Video, MessageSquare, Settings,
} from '@/components/ui/icons'
import { cn } from '../../utils/cn'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
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
  const [params] = useSearchParams()
  const status = params.get('status') || ''
  const view = params.get('view') || ''
  const admin = useAuthStore((s) => s.admin)
  // Only supervisors (admin/superadmin) get the queue + personal filters.
  // Moderators are scoped to their own tickets, so the "All" folder already
  // shows exactly their tickets and a queue view would be meaningless.
  const isSupervisor = ['admin', 'superadmin'].includes(admin?.role)

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

  const folders = [
    { to: '/support?view=unanswered', label: 'Unanswered', icon: Mail, count: unansweredCount, isActive: view === 'unanswered' },
    { to: '/support', label: 'All', icon: Inbox, count: counts.all, isActive: !status && !view },
    { to: '/support?status=open', label: 'New', icon: Mail, count: counts.open, isActive: status === 'open' },
    { to: '/support?status=in_progress', label: 'In progress', icon: Clock, count: counts.in_progress, isActive: status === 'in_progress' },
    { to: '/support?status=resolved', label: 'Resolved', icon: CheckCircle2, count: counts.resolved, isActive: status === 'resolved' },
    { to: '/support?status=closed', label: 'Closed', icon: Archive, count: counts.closed, isActive: status === 'closed' },
  ]

  const personal = isSupervisor ? [
    { to: '/support?view=mine', label: 'Assigned to me', icon: UserCheck, isActive: view === 'mine' },
    { to: '/support?view=unassigned', label: 'Queue (unassigned)', icon: UserX, isActive: view === 'unassigned' },
  ] : []

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
        {personal.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Queue</p>
            {personal.map((f) => <Item key={f.label} {...f} />)}
          </>
        )}
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

  // Ask the server to scope the list: 'me' = my tickets, 'unassigned' = the
  // queue. The backend also enforces role-based visibility (moderators only ever
  // get their own + the queue), so this can't be bypassed from the client.
  const assigned = view === 'mine' ? 'me' : view === 'unassigned' ? 'unassigned' : undefined
  const { data, isLoading } = useQuery({
    queryKey: ['support-list', status, assigned],
    queryFn: () => supportApi.list({ limit: 50, status: status || undefined, assigned }),
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
                    {/* Who's handling it — or flag the unassigned queue. */}
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className={cn('text-[10px] truncate', t.assignedTo?.name ? 'text-gray-500' : 'text-amber-600 font-medium')}>
                      {t.assignedTo?.name || 'Unassigned'}
                    </span>
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

function SettingToggle({ on, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="disabled:opacity-50">
      <span className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-gray-300')}>
        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}

// Global support settings (permissions, auto-assign, working hours) in a modal,
// so they don't clutter the conversation rail.
function SupportSettings({ open, onClose }) {
  const qc = useQueryClient()
  const { data: settingsRes } = useQuery({
    queryKey: ['support-settings'],
    queryFn: () => supportApi.settings(),
    enabled: open,
  })
  const settings = settingsRes?.data || {}
  const updateMutation = useMutation({
    mutationFn: (patch) => supportApi.updateSettings(patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-settings'] }); toast.success('Settings updated') },
    onError: (err) => toast.error(err?.message || 'Failed to update'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Support settings" size="md">
      <div className="space-y-5">
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</p>
          <p className="text-[11px] text-gray-400 mb-2">Applies to all tickets. Text chat is always on.</p>
          {PERMISSION_ROWS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-2 py-1.5">
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700">{label}</span>
              <SettingToggle on={!!settings[key]} onClick={() => updateMutation.mutate({ [key]: !settings[key] })} disabled={updateMutation.isPending} />
            </div>
          ))}
        </section>

        <section className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Auto-assign</p>
          <p className="text-[11px] text-gray-400 mb-2">Round-robin new tickets across moderators.</p>
          <div className="flex items-center gap-2 py-1.5">
            <span className="flex-1 text-sm text-gray-700">Enabled</span>
            <SettingToggle on={!!settings.autoAssign} onClick={() => updateMutation.mutate({ autoAssign: !settings.autoAssign })} disabled={updateMutation.isPending} />
          </div>
          <div className="flex items-center gap-2 py-1.5">
            <span className="flex-1 text-sm text-gray-700">Tickets / agent</span>
            <input
              type="number"
              min={1}
              defaultValue={settings.agentCapacity ?? 5}
              key={settings.agentCapacity}
              onBlur={(e) => {
                const v = Math.max(1, parseInt(e.target.value) || 1)
                if (v !== settings.agentCapacity) updateMutation.mutate({ agentCapacity: v })
              }}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-800 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </section>

        <section className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Working hours</p>
          <p className="text-[11px] text-gray-400 mb-2">The AI shares this when a customer opens a chat.</p>
          <textarea
            rows={3}
            defaultValue={settings.workingHours ?? ''}
            key={settings.workingHours}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v !== (settings.workingHours || '').trim()) updateMutation.mutate({ workingHours: v })
            }}
            placeholder="e.g. Our team is available Sun–Fri, 9 AM–6 PM."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-orange-500 focus:outline-none resize-none"
          />
        </section>
      </div>
    </Modal>
  )
}

export default function SupportInbox() {
  const [showSettings, setShowSettings] = useState(false)
  return (
    <div>
      <PageHeader
        title="Support"
        description="Help riders and drivers, and keep every conversation in one place."
        actions={<Button variant="secondary" size="sm" icon={Settings} onClick={() => setShowSettings(true)}>Settings</Button>}
      />
      <div className="h-[calc(100vh-9rem)] min-h-[480px] flex border border-gray-200 overflow-hidden bg-white">
        <FolderRail />
        <ConversationList />
        <Outlet />
      </div>
      <SupportSettings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
