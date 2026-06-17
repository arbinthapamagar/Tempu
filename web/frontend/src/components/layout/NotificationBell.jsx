import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, MessageSquare } from 'lucide-react'
import { notificationsApi } from '../../api/notifications.api'
import { formatRelative } from '../../utils/format'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['admin-my-notifications'],
    queryFn: () => notificationsApi.mine(),
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
  const items = data?.data?.items || []
  const unread = data?.data?.unread || 0

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-my-notifications'] })

  const markRead = useMutation({ mutationFn: (id) => notificationsApi.markRead(id), onSuccess: refresh })
  const markAll = useMutation({ mutationFn: () => notificationsApi.markAllRead(), onSuccess: refresh })

  const openItem = (n) => {
    if (!n.isRead) markRead.mutate(n._id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto scrollbar-thin bg-white rounded-xl border border-gray-200 shadow-lg z-40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unread > 0 && (
                <button onClick={() => markAll.mutate()} className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-orange-50/60 transition-colors ${!n.isRead ? 'bg-orange-50/40' : ''}`}
                >
                  <div className="mt-0.5 rounded-lg p-1.5 bg-orange-100 text-orange-600 shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="truncate">{n.title}</span>
                      {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatRelative(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
