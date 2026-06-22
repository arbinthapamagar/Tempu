import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, CheckCircle, Lock, AtSign, Paperclip, Mic, Pencil, Trash2,
  Phone, Video, CornerUpLeft, MessageSquare, Info, X, Mail, Car,
} from '@/components/ui/icons'
import CallPanel from './CallPanel'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Avatar } from '../../components/ui/Avatar'
import { TableSpinner } from '../../components/ui/Spinner'
import { cn } from '../../utils/cn'
import { supportApi } from '../../api/support.api'
import { useAuthStore } from '../../store/authStore'
import { formatDateTime, formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

const CATEGORY_LABELS = {
  trip_issue: 'Trip Issue', payment_issue: 'Payment Issue', driver_complaint: 'Driver Complaint',
  rider_complaint: 'Rider Complaint', document_issue: 'Document Issue', subscription_issue: 'Subscription Issue',
  account_issue: 'Account Issue', other: 'Other',
}

function MessageAttachment({ msg, isAdmin }) {
  if (!msg.attachmentUrl) return null
  if (msg.attachmentType === 'audio') {
    return (
      <div className="mt-2">
        <div className={`flex items-center gap-1 text-xs mb-1 ${isAdmin ? 'text-orange-100' : 'text-gray-500'}`}>
          <Mic className="h-3 w-3" /> Voice message
        </div>
        <audio controls src={msg.attachmentUrl} className="max-w-full h-9" />
      </div>
    )
  }
  return (
    <a
      href={msg.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 inline-flex items-center gap-1.5 text-xs underline ${isAdmin ? 'text-orange-50' : 'text-orange-600'}`}
    >
      <Paperclip className="h-3 w-3" /> {msg.attachmentName || 'Download attachment'}
    </a>
  )
}

function renderWithMentions(text) {
  return text.split(/(@[\w]+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-orange-600 font-semibold">{part}</span>
      : <span key={i}>{part}</span>
  )
}

export default function TicketChat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const admin = useAuthStore((s) => s.admin)

  const [mode, setMode] = useState('reply') // 'reply' | 'comment'
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState(null)
  const fileInputRef = useRef(null)

  const [assignTarget, setAssignTarget] = useState(null)
  const [pendingAssignee, setPendingAssignee] = useState(null) // dropdown selection awaiting Confirm
  const [showInfo, setShowInfo] = useState(false)

  // internal-note composer state
  const [comment, setComment] = useState('')
  const [mentionIds, setMentionIds] = useState([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const commentRef = useRef(null)

  // inline edit of an existing note
  const [editingId, setEditingId] = useState(null)
  const [editBody, setEditBody] = useState('')

  const callRef = useRef(null)

  const { data: ticketRes, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => supportApi.get(id),
    refetchInterval: 5000,
  })

  const { data: agentsRes } = useQuery({
    queryKey: ['support-agents'],
    queryFn: () => supportApi.agents(),
    staleTime: 5 * 60 * 1000,
  })
  const agents = agentsRes?.data || []

  const { data: settingsRes } = useQuery({ queryKey: ['support-settings'], queryFn: () => supportApi.settings() })
  const settings = settingsRes?.data || {}

  const replyMutation = useMutation({
    mutationFn: () => supportApi.reply(id, { message: message.trim(), attachment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['support-list'] })
      setMessage(''); setAttachment(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Reply sent')
    },
    onError: (err) => toast.error(err?.message || 'Failed to send reply'),
  })

  const updateStatus = useMutation({
    mutationFn: (status) => supportApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['support-list'] })
      qc.invalidateQueries({ queryKey: ['support-counts'] })
      toast.success('Ticket updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const assignMutation = useMutation({
    mutationFn: (adminId) => supportApi.assign(id, adminId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['support-list'] })
      qc.invalidateQueries({ queryKey: ['admin-my-notifications'] })
      setAssignTarget(null)
      setPendingAssignee(null)
      toast.success('Ticket assigned')
    },
    onError: (err) => toast.error(err?.message || 'Failed to assign'),
  })

  const commentMutation = useMutation({
    mutationFn: (data) => supportApi.comment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      setComment(''); setMentionIds([]); setMentionOpen(false)
      toast.success('Note added')
    },
    onError: (err) => toast.error(err?.message || 'Failed to add note'),
  })

  const editCommentMutation = useMutation({
    mutationFn: ({ commentId, body, mentions }) => supportApi.editComment(id, commentId, { body, mentions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      setEditingId(null); setEditBody('')
      toast.success('Note updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed to update note'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => supportApi.deleteComment(id, commentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Note deleted') },
    onError: (err) => toast.error(err?.message || 'Failed to delete note'),
  })

  // Permanently delete a closed ticket — super admins only (enforced server-side too).
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteMutation = useMutation({
    mutationFn: () => supportApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-list'] })
      qc.invalidateQueries({ queryKey: ['support-counts'] })
      setConfirmDelete(false)
      toast.success('Ticket deleted')
      navigate('/support')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete ticket'),
  })

  // Clear any half-made assignment choice when switching tickets.
  const [prevTicketId, setPrevTicketId] = useState(id)
  if (id !== prevTicketId) { setPrevTicketId(id); setPendingAssignee(null) }

  if (isLoading) return <div className="flex-1 grid place-items-center"><TableSpinner /></div>
  const ticket = ticketRes?.data
  if (!ticket) return <div className="flex-1 grid place-items-center text-gray-500">Ticket not found.</div>

  const person = ticket.userId || ticket.driverId
  const currentAssignee = ticket.assignedTo?._id || ''
  const selectedAssignee = pendingAssignee ?? currentAssignee
  const assigneeChanged = !!selectedAssignee && selectedAssignee !== currentAssignee
  const canSendReply = !!(message.trim() || attachment)
  const sendReply = () => { if (canSendReply && !replyMutation.isPending) replyMutation.mutate() }
  const replyDisabled = ticket.status === 'closed'

  // Show messages and internal notes together, ordered by time.
  const timeline = [
    ...(ticket.messages || []).map((m) => ({ kind: 'message', at: m.createdAt, data: m })),
    ...(ticket.comments || []).map((c) => ({ kind: 'note', at: c.createdAt, data: c })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  // Watch for "@" while typing a note and pop the agent picker.
  const onCommentChange = (e) => {
    const val = e.target.value
    setComment(val)
    const upToCaret = val.slice(0, e.target.selectionStart)
    const m = upToCaret.match(/@(\w*)$/)
    if (m) { setMentionOpen(true); setMentionFilter(m[1].toLowerCase()) }
    else setMentionOpen(false)
  }
  const pickMention = (agent) => {
    const handle = agent.name.replace(/\s+/g, '')
    setComment((c) => c.replace(/@(\w*)$/, `@${handle} `))
    setMentionIds((ids) => ids.includes(agent._id) ? ids : [...ids, agent._id])
    setMentionOpen(false)
    commentRef.current?.focus()
  }
  const submitComment = () => {
    if (!comment.trim()) return
    commentMutation.mutate({ body: comment.trim(), mentions: mentionIds })
  }

  const handleAssign = (assigneeId) => {
    if (!assigneeId || assigneeId === ticket.assignedTo?._id) return
    if (admin?.role === 'moderator') { setAssignTarget(assigneeId); return }
    assignMutation.mutate(assigneeId)
  }
  const assignTargetLabel = assignTarget
    ? (assignTarget === admin?._id ? 'yourself' : (agents.find((a) => a._id === assignTarget)?.name || 'this agent'))
    : ''
  const filteredAgents = agents.filter((a) => a.name?.toLowerCase().includes(mentionFilter))

  return (
    <div className="flex-1 flex min-w-0">
      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{ticket.subject}</h2>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-xs text-gray-400 truncate">
              #{ticket._id?.slice(-8).toUpperCase()} · {CATEGORY_LABELS[ticket.category] || ticket.category}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ticket.status === 'open' && (
              <Button size="xs" variant="warning" onClick={() => updateStatus.mutate('in_progress')} loading={updateStatus.isPending}>Start</Button>
            )}
            {ticket.status === 'in_progress' && (
              <Button size="xs" variant="success" icon={CheckCircle} onClick={() => updateStatus.mutate('resolved')} loading={updateStatus.isPending}>Resolve</Button>
            )}
            {ticket.status === 'resolved' && (
              <Button size="xs" variant="secondary" onClick={() => updateStatus.mutate('closed')} loading={updateStatus.isPending}>Close</Button>
            )}
            {ticket.status === 'closed' && (
              <Button size="xs" variant="secondary" icon={CornerUpLeft} onClick={() => updateStatus.mutate('open')} loading={updateStatus.isPending}>Reopen</Button>
            )}
            {ticket.status === 'closed' && admin?.role === 'superadmin' && (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete ticket (super admin)"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setShowInfo((v) => !v)}
              title="Ticket details"
              className={cn('p-1.5 rounded-lg transition-colors', showInfo ? 'bg-orange-50 text-orange-600' : 'text-gray-400 hover:bg-gray-100')}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-gray-50">
          {timeline.map((item, i) => {
            if (item.kind === 'note') {
              const c = item.data
              const isAuthor = admin?._id && c.authorId?._id === admin._id
              const canDelete = isAuthor || admin?.role === 'superadmin'
              const isEditing = editingId === c._id
              return (
                <div key={`n-${c._id || i}`} className="mx-auto w-full max-w-[92%]">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 group">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="h-3 w-3 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-800">{c.authorId?.name || 'Admin'}</span>
                      <span className="text-[10px] text-amber-600">internal note · {formatRelative(c.createdAt)}</span>
                      {(isAuthor || canDelete) && !isEditing && (
                        <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAuthor && (
                            <button title="Edit note" onClick={() => { setEditingId(c._id); setEditBody(c.body) }} className="p-0.5 text-amber-500 hover:text-amber-700">
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          {canDelete && (
                            <button title="Delete note" onClick={() => { if (confirm('Delete this internal note?')) deleteCommentMutation.mutate(c._id) }} className="p-0.5 text-amber-500 hover:text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div>
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            onClick={() => editBody.trim() && editCommentMutation.mutate({ commentId: c._id, body: editBody.trim(), mentions: (c.mentions || []).map((m) => m._id) })}
                            disabled={!editBody.trim() || editCommentMutation.isPending}
                            className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                          >Save</button>
                          <button onClick={() => { setEditingId(null); setEditBody('') }} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{renderWithMentions(c.body)}</div>
                    )}
                    {!isEditing && c.mentions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.mentions.map((m) => (
                          <span key={m._id} className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            <AtSign className="h-2.5 w-2.5" />{m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            // message bubble
            const msg = item.data
            const isAdmin = msg.senderType === 'admin'
            return (
              <div key={`m-${i}`} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                <Avatar name={isAdmin ? 'Admin' : person?.name} size="sm" />
                <div className={`max-w-[75%] flex flex-col ${isAdmin ? 'items-end' : ''}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm ${isAdmin ? 'bg-orange-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                    {msg.message}
                    <MessageAttachment msg={msg} isAdmin={isAdmin} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{formatRelative(msg.createdAt)}</p>
                </div>
              </div>
            )
          })}
          {timeline.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No messages yet.</p>}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => setMode('reply')}
              className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                mode === 'reply' ? 'bg-orange-50 text-orange-600 border-orange-200 font-medium' : 'text-gray-500 border-gray-200 hover:bg-gray-50')}
            >
              <CornerUpLeft className="h-3 w-3" /> Reply
            </button>
            <button
              onClick={() => setMode('comment')}
              className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                mode === 'comment' ? 'bg-amber-50 text-amber-700 border-amber-200 font-medium' : 'text-gray-500 border-gray-200 hover:bg-gray-50')}
            >
              <MessageSquare className="h-3 w-3" /> Comment
            </button>
          </div>

          {mode === 'reply' ? (
            replyDisabled ? (
              <p className="text-xs text-gray-400 py-2">This ticket is closed. Reopen it to reply.</p>
            ) : (
              <div>
                {attachment && (
                  <div className="mb-2 inline-flex items-center gap-2 max-w-full px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                    {attachment.type?.startsWith('audio/') ? <Mic className="h-3 w-3 shrink-0" /> : <Paperclip className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{attachment.name}</span>
                    <button onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="shrink-0 text-orange-500 hover:text-orange-700" title="Remove attachment">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a reply to the customer…"
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendReply() } }}
                  />
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={replyMutation.isPending} className="p-2.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50" title="Attach a file">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button onClick={sendReply} disabled={!canSendReply || replyMutation.isPending} className="p-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50" title="Send (Ctrl+Enter)">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Ctrl+Enter to send · delivered to the customer</p>
              </div>
            )
          ) : (
            <div className="relative">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={onCommentChange}
                placeholder="Add an internal note. Type @ to mention an agent…"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitComment(); if (e.key === 'Escape') setMentionOpen(false) }}
              />
              {mentionOpen && filteredAgents.length > 0 && (
                <div className="absolute z-10 left-3 bottom-full mb-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {filteredAgents.map((a) => (
                    <button key={a._id} type="button" onClick={() => pickMention(a)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50">
                      <Avatar name={a.name} size="sm" />
                      <div>
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-400 capitalize">{a.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-amber-600">Internal · not visible to the customer{mentionIds.length ? ` · ${mentionIds.length} mentioned` : ''}</p>
                <button onClick={submitComment} disabled={!comment.trim() || commentMutation.isPending} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  Add note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">Details</p>
            <button onClick={() => setShowInfo(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-4 border-b border-gray-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Submitted by</p>
            <div className="flex items-center gap-3">
              <Avatar src={person?.avatarUrl} name={person?.name} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{person?.name || '—'}</p>
                <p className="text-xs text-gray-500">{ticket.driverId ? 'Driver' : 'Rider'}</p>
              </div>
            </div>
            {/* Contact details so support can verify who they’re talking to */}
            <div className="mt-3 space-y-1.5">
              {person?.phone && (
                <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-orange-600">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {person.phone}
                </a>
              )}
              {person?.email && (
                <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-orange-600 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" /> <span className="truncate">{person.email}</span>
                </a>
              )}
            </div>
            {/* Vehicle details for driver-raised tickets */}
            {ticket.driverId && (
              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5">
                  <Car className="h-3 w-3" /> Vehicle
                </p>
                <p className="text-xs font-medium text-gray-700 capitalize">
                  {ticket.driverId.vehicleType || '—'}{ticket.driverId.vehiclePlate ? ` · ${ticket.driverId.vehiclePlate}` : ''}
                </p>
                {(ticket.driverId.vehicleModel || ticket.driverId.vehicleColor) && (
                  <p className="text-xs text-gray-500">{[ticket.driverId.vehicleModel, ticket.driverId.vehicleColor].filter(Boolean).join(' · ')}</p>
                )}
                {ticket.driverId.rating != null && (
                  <p className="text-xs text-gray-500 mt-0.5">⭐ {Number(ticket.driverId.rating).toFixed(1)} · <span className="capitalize">{ticket.driverId.status}</span></p>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-b border-gray-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Assignment</p>
            <select
              value={selectedAssignee}
              onChange={(e) => setPendingAssignee(e.target.value)}
              disabled={assignMutation.isPending}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
            >
              <option value="" disabled>Unassigned — pick an agent</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>{a.name}{a.role ? ` (${a.role})` : ''}</option>
              ))}
            </select>
            {assigneeChanged ? (
              <div className="flex items-center gap-2 mt-2">
                <Button size="xs" variant="primary" onClick={() => handleAssign(selectedAssignee)} loading={assignMutation.isPending}>
                  Confirm assignment
                </Button>
                <button onClick={() => setPendingAssignee(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            ) : ticket.assignedTo?.name ? (
              <p className="text-xs text-gray-400 mt-2">Assigned to <span className="font-medium text-gray-700">{ticket.assignedTo.name}</span></p>
            ) : null}
          </div>

          {(settings.audioCall || settings.videoCall) && (
            <div className="p-4 border-b border-gray-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Call</p>
              <div className="flex gap-3">
                {settings.audioCall && (
                  <button onClick={() => callRef.current?.start('audio')} className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
                    <Phone className="h-4 w-4" /> Audio
                  </button>
                )}
                {settings.videoCall && (
                  <button onClick={() => callRef.current?.start('video')} className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
                    <Video className="h-4 w-4" /> Video
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Info</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Status', value: <StatusBadge status={ticket.status} /> },
                { label: 'Category', value: CATEGORY_LABELS[ticket.category] },
                { label: 'Created', value: formatDateTime(ticket.createdAt) },
                { label: 'Updated', value: formatRelative(ticket.updatedAt) },
                ticket.resolvedAt && { label: 'Resolved', value: formatDateTime(ticket.resolvedAt) },
                ticket.tripId && { label: 'Trip Ref', value: `#${ticket.tripId?.slice(-8).toUpperCase()}` },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 shrink-0">{label}</span>
                  <span className="font-medium text-gray-800 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CallPanel ref={callRef} ticketId={id} />

      <ConfirmDialog
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        onConfirm={() => assignTarget && assignMutation.mutate(assignTarget)}
        title="Confirm assignment"
        message={`Assign this ticket to ${assignTargetLabel}? An admin will be notified of this change.`}
        confirmLabel="Assign"
        variant="warning"
        loading={assignMutation.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete ticket"
        message="This permanently deletes the ticket and its entire conversation. This cannot be undone."
        confirmLabel="Delete permanently"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
