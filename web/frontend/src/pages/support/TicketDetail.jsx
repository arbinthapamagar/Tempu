import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, CheckCircle, Lock, AtSign, Paperclip, Mic, Pencil, Trash2, Phone, Video } from 'lucide-react'
import CallPanel from './CallPanel'
import { SupportFolders } from './SupportFolders'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Avatar } from '../../components/ui/Avatar'
import { TableSpinner } from '../../components/ui/Spinner'
import { supportApi } from '../../api/support.api'
import { useAuthStore } from '../../store/authStore'
import { formatDateTime, formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

// Renders a message attachment (voice note or file) inside a chat bubble.
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

// Renders a comment body with @mentions visually highlighted.
function renderWithMentions(text) {
  return text.split(/(@[\w]+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-orange-600 font-semibold">{part}</span>
      : <span key={i}>{part}</span>
  )
}

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState(null)
  const fileInputRef = useRef(null)

  // Pending assignee id awaiting a moderator's confirmation (null = no prompt).
  const [assignTarget, setAssignTarget] = useState(null)

  // Internal-note composer state
  const [comment, setComment] = useState('')
  const [mentionIds, setMentionIds] = useState([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const commentRef = useRef(null)

  // Inline edit state for an existing note
  const [editingId, setEditingId] = useState(null)
  const [editBody, setEditBody] = useState('')

  const callRef = useRef(null)

  const admin = useAuthStore((s) => s.admin)

  const { data: ticketRes, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => supportApi.get(id),
    refetchInterval: 5000, // live-sync new messages without a manual refresh
  })

  const { data: agentsRes } = useQuery({
    queryKey: ['support-agents'],
    queryFn: () => supportApi.agents(),
    staleTime: 5 * 60 * 1000,
  })
  const agents = agentsRes?.data || []

  const replyMutation = useMutation({
    mutationFn: () => supportApi.reply(id, { message: message.trim(), attachment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      setMessage(''); setAttachment(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Reply sent')
    },
    onError: (err) => toast.error(err?.message || 'Failed to send reply'),
  })

  const canSendReply = !!(message.trim() || attachment)
  const sendReply = () => { if (canSendReply && !replyMutation.isPending) replyMutation.mutate() }

  const updateStatus = useMutation({
    mutationFn: (status) => supportApi.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Ticket updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const assignMutation = useMutation({
    mutationFn: (adminId) => supportApi.assign(id, adminId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['admin-my-notifications'] })
      setAssignTarget(null)
      toast.success('Ticket assigned')
    },
    onError: (err) => toast.error(err?.message || 'Failed to assign'),
  })

  // Global support capabilities (gates the call buttons).
  const { data: settingsRes } = useQuery({ queryKey: ['support-settings'], queryFn: () => supportApi.settings() })
  const settings = settingsRes?.data || {}

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

  const ticket = ticketRes?.data

  if (isLoading) return <TableSpinner />
  if (!ticket) return <div className="p-4 text-gray-500">Ticket not found.</div>

  const person = ticket.userId || ticket.driverId

  const CATEGORY_LABELS = {
    trip_issue: 'Trip Issue', payment_issue: 'Payment Issue', driver_complaint: 'Driver Complaint',
    rider_complaint: 'Rider Complaint', document_issue: 'Document Issue', subscription_issue: 'Subscription Issue',
    account_issue: 'Account Issue', other: 'Other',
  }

  // ── @mention autocomplete ──────────────────────────────────────────────────
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

  // Moderators get a centered confirmation before (re)assigning — an admin is notified.
  const handleAssign = (assigneeId) => {
    if (!assigneeId || assigneeId === ticket.assignedTo?._id) return
    if (admin?.role === 'moderator') {
      setAssignTarget(assigneeId)
      return
    }
    assignMutation.mutate(assigneeId)
  }

  const assignTargetLabel = assignTarget
    ? (assignTarget === admin?._id ? 'yourself' : (agents.find((a) => a._id === assignTarget)?.name || 'this agent'))
    : ''

  const filteredAgents = agents.filter((a) => a.name?.toLowerCase().includes(mentionFilter))

  return (
    <div className="flex gap-3 items-start">
      <SupportFolders active={ticket.status} />

      <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </button>
        <div className="flex items-center gap-2">
          {ticket.status === 'open' && (
            <Button size="sm" variant="warning" onClick={() => updateStatus.mutate('in_progress')} loading={updateStatus.isPending}>
              Start Progress
            </Button>
          )}
          {ticket.status === 'in_progress' && (
            <Button size="sm" variant="success" icon={CheckCircle} onClick={() => updateStatus.mutate('resolved')} loading={updateStatus.isPending}>
              Resolve
            </Button>
          )}
          {ticket.status === 'resolved' && (
            <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate('closed')} loading={updateStatus.isPending}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Thread */}
        <div className="col-span-3 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">{ticket.subject}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  #{ticket._id?.slice(-8).toUpperCase()} · {CATEGORY_LABELS[ticket.category] || ticket.category}
                </p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
              {ticket.messages?.map((msg, i) => {
                const isAdmin = msg.senderType === 'admin'
                return (
                  <div key={i} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                    <Avatar
                      name={isAdmin ? 'Admin' : person?.name}
                      size="sm"
                    />
                    <div className={`max-w-[75%] ${isAdmin ? 'items-end' : ''} flex flex-col`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm ${
                          isAdmin
                            ? 'bg-orange-600 text-white rounded-tr-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}
                      >
                        {msg.message}
                        <MessageAttachment msg={msg} isAdmin={isAdmin} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatRelative(msg.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Reply box */}
            {['open', 'in_progress'].includes(ticket.status) && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                {attachment && (
                  <div className="mb-2 inline-flex items-center gap-2 max-w-full px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                    {attachment.type?.startsWith('audio/') ? <Mic className="h-3 w-3 shrink-0" /> : <Paperclip className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{attachment.name}</span>
                    <button
                      onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="shrink-0 text-orange-500 hover:text-orange-700"
                      title="Remove attachment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your reply to the customer..."
                    rows={3}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault()
                        sendReply()
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 self-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={replyMutation.isPending}
                      className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      title="Attach a file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      onClick={sendReply}
                      disabled={!canSendReply || replyMutation.isPending}
                      className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ctrl+Enter to send · this is sent to the customer</p>
              </div>
            )}
          </div>

          {/* Internal notes (admin-only) */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Internal notes</h3>
              <span className="text-xs text-amber-600">· not visible to the customer</span>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto scrollbar-thin pr-1">
              {ticket.comments?.length ? ticket.comments.map((c) => {
                const isAuthor = admin?._id && c.authorId?._id === admin._id
                const canDelete = isAuthor || admin?.role === 'superadmin'
                const isEditing = editingId === c._id
                return (
                <div key={c._id} className="flex gap-3 group">
                  <Avatar name={c.authorId?.name || 'Admin'} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{c.authorId?.name || 'Admin'}</span>
                      <span className="text-xs text-gray-400">{formatRelative(c.createdAt)}</span>
                      {(isAuthor || canDelete) && !isEditing && (
                        <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAuthor && (
                            <button
                              title="Edit note"
                              onClick={() => { setEditingId(c._id); setEditBody(c.body) }}
                              className="p-1 text-gray-400 hover:text-amber-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              title="Delete note"
                              onClick={() => { if (confirm('Delete this internal note?')) deleteCommentMutation.mutate(c._id) }}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-1">
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            onClick={() => editBody.trim() && editCommentMutation.mutate({ commentId: c._id, body: editBody.trim(), mentions: (c.mentions || []).map((m) => m._id) })}
                            disabled={!editBody.trim() || editCommentMutation.isPending}
                            className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button onClick={() => { setEditingId(null); setEditBody('') }} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{renderWithMentions(c.body)}</div>
                    )}

                    {!isEditing && c.mentions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.mentions.map((m) => (
                          <span key={m._id} className="inline-flex items-center gap-0.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            <AtSign className="h-3 w-3" />{m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )
              }) : (
                <p className="text-sm text-amber-700/70">No internal notes yet. Add one to collaborate with other agents.</p>
              )}
            </div>

            {/* Note composer with @mentions */}
            <div className="mt-4 pt-4 border-t border-amber-200 relative">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={onCommentChange}
                placeholder="Add an internal note. Type @ to mention an agent…"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) submitComment()
                  if (e.key === 'Escape') setMentionOpen(false)
                }}
              />

              {mentionOpen && filteredAgents.length > 0 && (
                <div className="absolute z-10 left-3 bottom-full mb-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {filteredAgents.map((a) => (
                    <button
                      key={a._id}
                      type="button"
                      onClick={() => pickMention(a)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50"
                    >
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
                <p className="text-xs text-amber-600">Ctrl+Enter to post{mentionIds.length ? ` · ${mentionIds.length} mentioned` : ''}</p>
                <button
                  onClick={submitComment}
                  disabled={!comment.trim() || commentMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  Add note
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Submitted By</h3>
            <div className="flex items-center gap-3">
              <Avatar name={person?.name} size="md" />
              <div>
                <p className="font-semibold text-gray-900">{person?.name || '—'}</p>
                <p className="text-xs text-gray-400">{person?.phone}</p>
                <p className="text-xs text-gray-400">{ticket.userId ? 'Rider' : 'Driver'}</p>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Assignment</h3>
            <select
              value={ticket.assignedTo?._id || ''}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={assignMutation.isPending}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
            >
              <option value="" disabled>Unassigned — pick an agent</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>{a.name}{a.role ? ` (${a.role})` : ''}</option>
              ))}
            </select>
            {ticket.assignedTo?.name && (
              <p className="text-xs text-gray-400 mt-2">Currently assigned to <span className="font-medium text-gray-700">{ticket.assignedTo.name}</span></p>
            )}
          </div>

          {/* Call actions (gated by the global support settings in the left rail) */}
          {(settings.audioCall || settings.videoCall) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Call</h3>
              <div className="flex gap-2">
                {settings.audioCall && (
                  <button onClick={() => callRef.current?.start('audio')} className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
                    <Phone className="h-4 w-4" /> Audio call
                  </button>
                )}
                {settings.videoCall && (
                  <button onClick={() => callRef.current?.start('video')} className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
                    <Video className="h-4 w-4" /> Video call
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Status', value: <StatusBadge status={ticket.status} /> },
                { label: 'Category', value: CATEGORY_LABELS[ticket.category] },
                { label: 'Created', value: formatDateTime(ticket.createdAt) },
                { label: 'Updated', value: formatRelative(ticket.updatedAt) },
                ticket.resolvedAt && { label: 'Resolved At', value: formatDateTime(ticket.resolvedAt) },
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
      </div>

      <CallPanel ref={callRef} ticketId={id} />
      </div>

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
    </div>
  )
}
