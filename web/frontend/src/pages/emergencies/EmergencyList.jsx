import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, MapPin, CheckCircle, BellRing } from '@/components/ui/icons'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { Tabs } from '../../components/ui/Tabs'
import { emergenciesApi } from '../../api/emergencies.api'
import { formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

export default function EmergencyList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusTab, setStatusTab] = useState('active')

  const { data, isLoading } = useQuery({
    queryKey: ['emergencies', page, statusTab],
    queryFn: () => emergenciesApi.list({ page, limit: 20, status: statusTab || undefined }),
    keepPreviousData: true,
    refetchInterval: 15000, // keep the active queue fresh
  })

  const update = useMutation({
    mutationFn: ({ id, status }) => emergenciesApi.update(id, { status }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['emergencies'] }); toast.success(res?.message || 'Updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const emergencies = data?.data?.emergencies || []
  const pagination = data?.data?.pagination || { total: 0, pages: 1 }
  const activeCount = data?.data?.activeCount || 0

  const tabs = [
    { value: 'active', label: 'Active', count: statusTab === 'active' ? undefined : activeCount },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'resolved', label: 'Resolved' },
    { value: '', label: 'All' },
  ]

  const columns = [
    {
      key: 'userId',
      header: 'Person',
      render: (u, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={u?.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{u?.name || '—'}</p>
            <p className="text-xs text-gray-400">{row.contactPhone || u?.phone || ''} · {row.role}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (loc) => (loc?.lat != null && loc?.lng != null ? (
        <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline">
          <MapPin className="h-3.5 w-3.5" /> Open map
        </a>
      ) : <span className="text-xs text-gray-400">No location</span>),
    },
    { key: 'message', header: 'Note', render: (m) => <span className="text-sm text-gray-600 max-w-[220px] truncate inline-block" title={m || ''}>{m || '—'}</span> },
    { key: 'createdAt', header: 'Raised', render: (v) => <span className="text-xs text-gray-500">{formatRelative(v)}</span> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          {row.status === 'active' && (
            <button onClick={(e) => { e.stopPropagation(); update.mutate({ id, status: 'acknowledged' }) }}
              className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600" title="Acknowledge">
              <BellRing className="h-4 w-4" />
            </button>
          )}
          {row.status !== 'resolved' && (
            <button onClick={(e) => { e.stopPropagation(); update.mutate({ id, status: 'resolved' }) }}
              className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600" title="Resolve">
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          {row.status === 'resolved' && <span className="text-xs text-gray-300">—</span>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Emergency Alerts" description="Live SOS alerts from riders and drivers" />

      {activeCount > 0 && (
        <div className="flex items-center gap-2 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">{activeCount} active emergency {activeCount === 1 ? 'alert' : 'alerts'} need attention.</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>
        <DataTable columns={columns} data={emergencies} isLoading={isLoading} emptyTitle="No emergency alerts" />
        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
