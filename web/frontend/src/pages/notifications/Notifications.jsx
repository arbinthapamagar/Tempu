import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Send, Users, Car, Bell, Megaphone } from '@/components/ui/icons'
import { Input, Textarea } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/shared/PageHeader'
import { notificationsApi } from '../../api/notifications.api'
import toast from 'react-hot-toast'

const schema = z.object({
  title: z.string().min(3, 'Title required'),
  body: z.string().min(5, 'Message required'),
  target: z.enum(['all', 'users', 'drivers']),
  type: z.string().min(1, 'Type required'),
})

const TARGET_OPTIONS = [
  { value: 'all', label: 'Everyone (Users + Drivers)' },
  { value: 'users', label: 'Users Only' },
  { value: 'drivers', label: 'Drivers Only' },
]

const TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'payment', label: 'Payment' },
  { value: 'subscription_alert', label: 'Subscription Alert' },
  { value: 'document_verified', label: 'Document Verified' },
  { value: 'trip_request', label: 'Trip Request' },
]

const QUICK_TEMPLATES = [
  {
    title: 'Platform Maintenance',
    body: 'Tempu will be undergoing scheduled maintenance on Sunday from 2:00 AM - 4:00 AM. Services may be temporarily unavailable.',
    target: 'all',
    type: 'general',
  },
  {
    title: 'New Feature Available',
    body: 'We have launched exciting new features on the Tempu app. Update your app to enjoy the latest improvements!',
    target: 'users',
    type: 'general',
  },
  {
    title: 'Driver Incentive Program',
    body: 'Complete 20 trips this week and earn an extra NPR 1,000 bonus! The incentive runs until Sunday midnight.',
    target: 'drivers',
    type: 'general',
  },
  {
    title: 'Document Expiry Reminder',
    body: 'Your driver documents are expiring soon. Please update them to continue providing rides on Tempu.',
    target: 'drivers',
    type: 'document_verified',
  },
]

export default function Notifications() {
  const [sent, setSent] = useState([])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { target: 'all', type: 'general' },
  })

  const sendMutation = useMutation({
    mutationFn: notificationsApi.broadcast,
    onSuccess: (_, vars) => {
      toast.success(`Notification sent to ${vars.target}!`)
      setSent((prev) => [{ ...vars, sentAt: new Date().toISOString() }, ...prev])
      reset({ target: 'all', type: 'general' })
    },
    onError: (err) => toast.error(err?.message || 'Failed to send notification'),
  })

  const applyTemplate = (tpl) => {
    setValue('title', tpl.title)
    setValue('body', tpl.body)
    setValue('target', tpl.target)
    setValue('type', tpl.type)
  }

  const watchTarget = watch('target')

  const TARGET_ICONS = { all: Megaphone, users: Users, drivers: Car }
  const TargetIcon = TARGET_ICONS[watchTarget] || Bell

  return (
    <div>
      <PageHeader title="Send Notifications" description="Broadcast push notifications to users and drivers" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Compose form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Compose Notification</h3>
            <form onSubmit={handleSubmit((v) => sendMutation.mutate(v))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Send To"
                  options={TARGET_OPTIONS}
                  error={errors.target?.message}
                  {...register('target')}
                />
                <Select
                  label="Notification Type"
                  options={TYPE_OPTIONS}
                  error={errors.type?.message}
                  {...register('type')}
                />
              </div>
              <Input
                label="Title"
                placeholder="Notification title..."
                error={errors.title?.message}
                {...register('title')}
              />
              <Textarea
                label="Message"
                placeholder="Write your notification message here..."
                rows={4}
                error={errors.body?.message}
                {...register('body')}
              />

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Preview</p>
                <div className="bg-slate-800 rounded-xl p-4 shadow-lg max-w-sm">
                  <div className="flex items-start gap-3">
                    <TargetIcon className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">{watch('title') || 'Notification Title'}</p>
                      <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">{watch('body') || 'Your notification message will appear here...'}</p>
                      <p className="text-gray-500 text-xs mt-2">Just now · Tempu</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <TargetIcon className="h-4 w-4" />
                  Sending to: <strong className="text-gray-800 capitalize">{watchTarget}</strong>
                </div>
                <Button type="submit" icon={Send} loading={sendMutation.isPending}>
                  Send Notification
                </Button>
              </div>
            </form>
          </div>

          {/* Sent history */}
          {sent.length > 0 && (
            <div className="bg-white border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Recently Sent ({sent.length})</h3>
              <div className="space-y-3">
                {sent.map((n, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Bell className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Sent to {n.target} · just now</p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">Sent</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick templates */}
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Templates</h3>
            <div className="space-y-2">
              {QUICK_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(tpl)}
                  className="w-full text-left p-3 border border-gray-100 rounded-lg hover:bg-orange-50 hover:border-orange-200 transition-colors group"
                >
                  <p className="text-sm font-medium text-gray-800 group-hover:text-orange-700">{tpl.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tpl.body}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{tpl.target}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tpl.type}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <h4 className="text-sm font-semibold text-orange-800 mb-2">Tips</h4>
            <ul className="space-y-2 text-xs text-orange-700">
              <li>• Keep titles under 60 characters</li>
              <li>• Messages should be concise and actionable</li>
              <li>• Use templates for common announcements</li>
              <li>• Preview before sending to all users</li>
              <li>• Notifications are sent via FCM push</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
