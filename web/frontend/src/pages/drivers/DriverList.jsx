import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Pause, Play, Eye } from 'lucide-react'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { driversApi } from '../../api/drivers.api'
import { formatDate, formatCurrency, formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

const VEHICLE_TYPE_OPTIONS = [
  { value: 'bike', label: 'Bike' },
  { value: 'car', label: 'Car' },
  { value: 'ev', label: 'EV' },
]

export default function DriverList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  // Seed the tab from a ?status= link (e.g. the dashboard "Pending Drivers" card).
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || '')

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, statusFilter || activeTab, vehicleTypeFilter],
    queryFn: () =>
      driversApi.list({
        page, limit: 20, search,
        status: statusFilter || activeTab || undefined,
        vehicleType: vehicleTypeFilter || undefined,
      }),
    keepPreviousData: true,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => driversApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] })
      toast.success('Driver status updated')
      setConfirmAction(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to update status'),
  })

  const verify = useMutation({
    mutationFn: (id) => driversApi.verify(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] })
      toast.success('Driver verified')
    },
    onError: (err) => toast.error(err?.message || 'Failed to verify'),
  })

  const drivers = data?.data?.drivers || data?.data || []
  const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: 20 }

  const tabs = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const columns = [
    {
      key: 'userId',
      header: 'Driver',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar src={val?.avatarUrl} name={val?.name} size="sm" />
          <div>
            <p className="font-medium text-gray-900 text-sm">{val?.name || '—'}</p>
            <p className="text-xs text-gray-400">{val?.phone || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicleType',
      header: 'Vehicle',
      render: (val, row) => (
        <div>
          <p className="text-sm capitalize font-medium">{val}</p>
          <p className="text-xs text-gray-400">{row.vehiclePlate}</p>
        </div>
      ),
    },
    { key: 'vehicleModel', header: 'Model', render: (val, row) => `${val || '—'} ${row.vehicleColor ? `(${row.vehicleColor})` : ''}` },
    { key: 'status', header: 'Status', render: (val) => <StatusBadge status={val} /> },
    {
      key: 'isVerified',
      header: 'Verified',
      render: (val) => val
        ? <CheckCircle className="h-4 w-4 text-emerald-500" />
        : <XCircle className="h-4 w-4 text-gray-300" />,
    },
    {
      key: 'isOnline',
      header: 'Online',
      render: (val) => <StatusBadge status={val ? 'online' : 'offline'} />,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (val, row) => `⭐ ${(row.rating || 0).toFixed(1)} (${row.totalRatings || 0})`,
    },
    { key: 'totalRides', header: 'Rides', render: (val) => (val || 0).toLocaleString() },
    { key: 'earnings', header: 'Earnings', render: (val) => formatCurrency(val || 0) },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/drivers/${id}`) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmAction({ driver: row, action: 'approved' }) }}
                className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600"
                title="Approve"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmAction({ driver: row, action: 'rejected' }) }}
                className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {row.status === 'approved' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmAction({ driver: row, action: 'suspended' }) }}
              className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600"
              title="Suspend"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {row.status === 'suspended' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmAction({ driver: row, action: 'approved' }) }}
              className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600"
              title="Reactivate"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const ACTION_LABELS = {
    approved: { label: 'Approve', variant: 'success', msg: 'approve' },
    rejected: { label: 'Reject', variant: 'danger', msg: 'reject' },
    suspended: { label: 'Suspend', variant: 'warning', msg: 'suspend' },
  }

  return (
    <div>
      <PageHeader
        title="Driver Management"
        description="Review and manage driver applications and accounts"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-4">
          <Tabs
            tabs={tabs}
            active={activeTab}
            onChange={(v) => { setActiveTab(v); setPage(1) }}
          />
        </div>

        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1) }}
            filters={[
              {
                placeholder: 'All Vehicles',
                value: vehicleTypeFilter,
                onChange: (v) => { setVehicleTypeFilter(v); setPage(1) },
                options: VEHICLE_TYPE_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={drivers}
          isLoading={isLoading}
          emptyTitle="No drivers found"
          emptyDesc="No drivers match your filters"
          onRowClick={(row) => navigate(`/drivers/${row._id}`)}
        />

        {pagination.total > 0 && (
          <Pagination
            page={page}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={20}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => updateStatus.mutate({ id: confirmAction?.driver?._id, status: confirmAction?.action })}
        loading={updateStatus.isPending}
        title={`${ACTION_LABELS[confirmAction?.action]?.label} Driver`}
        message={`Are you sure you want to ${ACTION_LABELS[confirmAction?.action]?.msg} ${confirmAction?.driver?.userId?.name || 'this driver'}?`}
        confirmLabel={ACTION_LABELS[confirmAction?.action]?.label}
        variant={ACTION_LABELS[confirmAction?.action]?.variant}
      />
    </div>
  )
}
