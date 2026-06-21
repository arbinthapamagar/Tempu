import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Bell } from '@/components/ui/icons'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { notificationsApi } from '../../api/notifications.api'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'payment', label: 'Payment' },
  { value: 'subscription_alert', label: 'Subscription Alert' },
  { value: 'document_verified', label: 'Document Verified' },
  { value: 'account_approved', label: 'Account Approved' },
]

const ID_FIELD = { users: 'userIds', drivers: 'driverIds', admins: 'adminIds' }
const NOUN = { users: 'user', drivers: 'driver', admins: 'admin' }

// Compose + send an in-app notification to a fixed set of recipients.
// `recipientType` ∈ users|drivers|admins; `recipients` = [{ id, label }].
export function SendNotificationModal({ open, onClose, recipientType, recipients = [], onSent }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('general')

  const ids = recipients.map((r) => r.id)
  const noun = NOUN[recipientType] || 'recipient'

  const close = () => {
    setTitle(''); setBody(''); setType('general')
    onClose?.()
  }

  const sendMutation = useMutation({
    mutationFn: () => notificationsApi.broadcast({ title, body, type, [ID_FIELD[recipientType]]: ids }),
    onSuccess: (res) => {
      const sent = res?.data?.sent ?? ids.length
      toast.success(`Notification sent to ${sent} ${noun}${sent === 1 ? '' : 's'}`)
      onSent?.(res)
      close()
    },
    onError: (err) => toast.error(err?.message || 'Failed to send notification'),
  })

  const canSend = title.trim().length >= 3 && body.trim().length >= 5 && ids.length > 0

  return (
    <Modal open={open} onClose={close} title="Send Notification" size="md">
      <div className="space-y-3">
        {/* recipients summary */}
        <div className="rounded-xl border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-400 mb-1">
            Sending to <strong className="text-gray-700">{ids.length}</strong> {noun}{ids.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
            {recipients.slice(0, 40).map((r) => (
              <span key={r.id} className="text-xs text-orange-700 border border-orange-300 rounded-full px-2 py-0.5">
                {r.label}
              </span>
            ))}
            {recipients.length > 40 && (
              <span className="text-xs text-gray-400 px-1 py-0.5">+{recipients.length - 40} more</span>
            )}
          </div>
        </div>

        <Select
          label="Notification Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input
          label="Title"
          placeholder="Notification title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          label="Message"
          placeholder="Write your message…"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* preview */}
        <div className="bg-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{title || 'Notification Title'}</p>
              <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">{body || 'Your message will appear here…'}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button icon={Send} loading={sendMutation.isPending} disabled={!canSend} onClick={() => sendMutation.mutate()}>
            Send
          </Button>
        </div>
      </div>
    </Modal>
  )
}
