import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, Pause, Play } from '@/components/ui/icons'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { subscriptionsApi } from '../../api/subscriptions.api'
import { formatDate, formatCurrency } from '../../utils/format'
import toast from 'react-hot-toast'

const PLAN_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'business', label: 'Business' },
]

export default function SubscriptionList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusTab, setStatusTab] = useState('')
  const [plan, setPlan] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', page, statusTab, plan],
    queryFn: () =>
      subscriptionsApi.list({ page, limit: 20, status: statusTab || undefined, plan: plan || undefined }),
    keepPreviousData: true,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => subscriptionsApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast.success('Updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const subs = data?.data?.subscriptions || data?.data || []
  const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: 20 }

  const tabs = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' },
  ]

  const columns = [
    {
      key: 'userId',
      header: 'Subscriber',
      render: (val) => (
        <div className="flex items-center gap-2">
          <Avatar name={val?.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{val?.name || '-'}</p>
            <p className="text-xs text-gray-400">{val?.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (val, row) => (
        <div>
          <StatusBadge status={val} />
          {val === 'parent' && row.childName && (
            <p className="text-xs text-gray-400 mt-0.5">Child: {row.childName}</p>
          )}
          {val === 'business' && row.businessName && (
            <p className="text-xs text-gray-400 mt-0.5">{row.businessName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'vehicleType',
      header: 'Vehicle',
      render: (val) => <span className="capitalize text-sm">{val}</span>,
    },
    {
      key: 'pickup',
      header: 'Route',
      render: (val, row) => (
        <div className="text-xs">
          <p className="text-gray-600 truncate max-w-[100px]" title={val?.address}>{val?.address}</p>
          <p className="text-gray-400">→ {row.dropoff?.address?.slice(0, 20)}…</p>
        </div>
      ),
    },
    {
      key: 'pickupTime',
      header: 'Times',
      render: (val, row) => (
        <div className="text-xs text-gray-600">
          <p>Pickup: {val || '-'}</p>
          <p>Drop: {row.dropoffTime || '-'}</p>
        </div>
      ),
    },
    {
      key: 'primaryDriver',
      header: 'Driver',
      render: (val) => val?.userId?.name || <span className="text-gray-400 italic">None</span>,
    },
    {
      key: 'monthlyPrice',
      header: 'Monthly',
      render: (val) => <span className="font-medium text-orange-600">{formatCurrency(val)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'startDate',
      header: 'Period',
      render: (val, row) => (
        <div className="text-xs text-gray-600">
          <p>{formatDate(val, 'MMM dd')}</p>
          <p>→ {formatDate(row.endDate, 'MMM dd, yyyy')}</p>
        </div>
      ),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelected(row) }} className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600">
            <Eye className="h-4 w-4" />
          </button>
          {row.status === 'active' && (
            <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id, status: 'paused' }) }} className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600">
              <Pause className="h-4 w-4" />
            </button>
          )}
          {row.status === 'paused' && (
            <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id, status: 'active' }) }} className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600">
              <Play className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Subscriptions" description="Manage parent and business subscription plans" />

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>
        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            filters={[
              {
                placeholder: 'All Plans',
                value: plan,
                onChange: (v) => { setPlan(v); setPage(1) },
                options: PLAN_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable columns={columns} data={subs} isLoading={isLoading} emptyTitle="No subscriptions found" onRowClick={setSelected} />

        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Subscription Details" size="lg">
        {selected && <SubscriptionDetail sub={selected} />}
      </Modal>
    </div>
  )
}

function SubscriptionDetail({ sub }) {
  const fields =
    sub.plan === 'parent'
      ? [
          { label: 'Child Name', value: sub.childName },
          { label: 'Child Age', value: sub.childAge },
          { label: 'School', value: sub.schoolName },
        ]
      : [
          { label: 'Business Name', value: sub.businessName },
          { label: 'Business Address', value: sub.businessAddress },
          { label: 'Goods Type', value: sub.goodsType },
        ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Plan', value: <StatusBadge status={sub.plan} /> },
          { label: 'Status', value: <StatusBadge status={sub.status} /> },
          { label: 'Vehicle Type', value: sub.vehicleType },
          { label: 'Monthly Price', value: formatCurrency(sub.monthlyPrice) },
          { label: 'Start Date', value: formatDate(sub.startDate) },
          { label: 'End Date', value: formatDate(sub.endDate) },
          { label: 'Pickup Time', value: sub.pickupTime },
          { label: 'Drop-off Time', value: sub.dropoffTime },
          ...fields,
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <div className="text-sm font-medium text-gray-800">{value || '-'}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-0.5">Pickup Address</p>
          <p className="text-sm text-gray-800">{sub.pickup?.address || '-'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-0.5">Drop-off Address</p>
          <p className="text-sm text-gray-800">{sub.dropoff?.address || '-'}</p>
        </div>
      </div>
      {sub.missedDays?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Missed Days ({sub.missedDays.length})</p>
          <div className="flex flex-wrap gap-2">
            {sub.missedDays.map((d, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">{formatDate(d)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
