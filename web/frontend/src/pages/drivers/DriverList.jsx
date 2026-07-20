import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Pause, Play, Eye, Bell, Send, X, Download, Settings } from '@/components/ui/icons'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SendNotificationModal } from '../../components/shared/SendNotificationModal'
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
import { exportToCsv, dateStamp } from '../../utils/export'
import toast from 'react-hot-toast'

const VEHICLE_TYPE_OPTIONS = [
  { value: 'bike', label: 'Bike' },
  { value: 'car', label: 'Car' },
  { value: 'ev', label: 'EV' },
]

const RATING_OPTIONS = [
  { value: '4.5', label: '4.5★ & up' },
  { value: '4', label: '4★ & up' },
  { value: '3', label: '3★ & up' },
  { value: 'lt3', label: 'Below 3★' },
]

const VERIFIED_OPTIONS = [
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Unverified' },
]

const RIDES_OPTIONS = [
  { value: '0', label: 'No rides yet' },
  { value: '1', label: '1+ rides' },
  { value: '50', label: '50+ rides' },
  { value: '200', label: '200+ rides' },
]

const EARNINGS_OPTIONS = [
  { value: '1', label: 'Has earnings' },
  { value: '0', label: 'No earnings' },
  { value: '1000', label: '₹1,000+' },
  { value: '10000', label: '₹10,000+' },
]

const ratingToParams = (v) => (v === 'lt3' ? { maxRating: 3 } : v ? { minRating: v } : {})
const ridesToParams = (v) => (v === '' ? {} : v === '0' ? { maxRides: 0 } : { minRides: Number(v) })
const earningsToParams = (v) => (v === '' ? {} : v === '0' ? { maxEarnings: 0 } : { minEarnings: Number(v) })

export default function DriverList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [ridesFilter, setRidesFilter] = useState('')
  const [earningsFilter, setEarningsFilter] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [settingsRow, setSettingsRow] = useState(null) // row whose settings popup is open
  const [selected, setSelected] = useState([]) // [{ id, label }]
  const [notify, setNotify] = useState(null)   // { recipients }
  const [exporting, setExporting] = useState(false)
  // Seed the tab from a ?status= link (e.g. the dashboard "Pending Drivers" card).
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || '')

  // Shared query params for the active filters - reused by the table, "select
  // all matching" and the CSV export so they always agree.
  const buildParams = (extra = {}) => ({
    search,
    status: statusFilter || activeTab || undefined,
    vehicleType: vehicleTypeFilter || undefined,
    verified: verifiedFilter || undefined,
    ...ratingToParams(ratingFilter),
    ...ridesToParams(ridesFilter),
    ...earningsToParams(earningsFilter),
    ...extra,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, statusFilter || activeTab, vehicleTypeFilter, ratingFilter, verifiedFilter, ridesFilter, earningsFilter],
    queryFn: () => driversApi.list(buildParams({ page, limit: 20 })),
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

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const labelOf = (d) => d.userId?.name || d.userId?.phone || d.vehiclePlate || 'Driver'
  const toggleRow = (d) =>
    setSelected((prev) => prev.some((s) => s.id === d._id)
      ? prev.filter((s) => s.id !== d._id)
      : [...prev, { id: d._id, label: labelOf(d) }])
  const toggleAllOnPage = () => {
    const pageIds = new Set(drivers.map((d) => d._id))
    const allSelected = drivers.every((d) => selectedIds.has(d._id))
    setSelected((prev) => allSelected
      ? prev.filter((s) => !pageIds.has(s.id))
      : [...prev.filter((s) => !pageIds.has(s.id)), ...drivers.map((d) => ({ id: d._id, label: labelOf(d) }))])
  }
  const selectAllMatching = async () => {
    try {
      const res = await driversApi.list(buildParams({ page: 1, limit: Math.max(pagination.total, 1) }))
      const all = res?.data?.drivers || res?.data || []
      setSelected(all.map((d) => ({ id: d._id, label: labelOf(d) })))
      toast.success(`Selected all ${all.length} matching drivers`)
    } catch {
      toast.error('Could not select all')
    }
  }

  // Pull every driver matching the current filters and download as CSV (opens in Excel).
  const exportData = async () => {
    setExporting(true)
    try {
      const res = await driversApi.list(buildParams({ page: 1, limit: Math.max(pagination.total, 1) }))
      const all = res?.data?.drivers || res?.data || []
      if (!all.length) { toast.error('Nothing to export'); return }
      exportToCsv(`drivers-${dateStamp()}`, [
        { label: 'Name', value: (d) => d.userId?.name || '' },
        { label: 'Phone', value: (d) => d.userId?.phone || '' },
        { label: 'Email', value: (d) => d.userId?.email || '' },
        { label: 'Vehicle Type', value: (d) => d.vehicleType || '' },
        { label: 'Plate', value: (d) => d.vehiclePlate || '' },
        { label: 'Model', value: (d) => d.vehicleModel || '' },
        { label: 'Color', value: (d) => d.vehicleColor || '' },
        { label: 'Status', value: (d) => d.status || '' },
        { label: 'Verified', value: (d) => (d.isVerified ? 'Yes' : 'No') },
        { label: 'Online', value: (d) => (d.isOnline ? 'Yes' : 'No') },
        { label: 'Rating', value: (d) => (d.rating || 0).toFixed(1) },
        { label: 'Total Ratings', value: (d) => d.totalRatings || 0 },
        { label: 'Total Rides', value: (d) => d.totalRides || 0 },
        { label: 'Earnings', value: (d) => d.earnings || 0 },
        { label: 'Wallet Balance', value: (d) => d.walletBalance || 0 },
        { label: 'Joined', value: (d) => formatDate(d.createdAt) },
      ], all)
      toast.success(`Exported ${all.length} drivers`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

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
          <Avatar src={val?.avatarUrl} name={val?.name} size="xs" />
          <div>
            <p className="font-medium text-gray-900 text-sm">{val?.name || '-'}</p>
            <p className="text-xs text-gray-400">{val?.phone || '-'}</p>
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
    { key: 'vehicleModel', header: 'Model', render: (val, row) => `${val || '-'} ${row.vehicleColor ? `(${row.vehicleColor})` : ''}` },
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
          <button
            onClick={(e) => { e.stopPropagation(); setNotify({ recipients: [{ id, label: labelOf(row) }] }) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="Send notification"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSettingsRow(row) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
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
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={exportData} loading={exporting}>
            Export
          </Button>
        }
      />

      <div className="bg-white border border-gray-200">
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
              {
                placeholder: 'All Verification',
                value: verifiedFilter,
                onChange: (v) => { setVerifiedFilter(v); setPage(1) },
                options: VERIFIED_OPTIONS,
              },
              {
                placeholder: 'All Ratings',
                value: ratingFilter,
                onChange: (v) => { setRatingFilter(v); setPage(1) },
                options: RATING_OPTIONS,
              },
              {
                placeholder: 'All Rides',
                value: ridesFilter,
                onChange: (v) => { setRidesFilter(v); setPage(1) },
                options: RIDES_OPTIONS,
              },
              {
                placeholder: 'All Earnings',
                value: earningsFilter,
                onChange: (v) => { setEarningsFilter(v); setPage(1) },
                options: EARNINGS_OPTIONS,
              },
            ]}
          />
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 bg-orange-50/40">
            <span className="text-sm font-medium text-gray-700">{selected.length} selected</span>
            {selected.length < pagination.total && (
              <button onClick={selectAllMatching} className="text-xs font-medium text-orange-600 hover:text-orange-700">
                Select all {pagination.total} matching
              </button>
            )}
            <button onClick={() => setSelected([])} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
            <div className="ml-auto">
              <Button size="sm" icon={Send} onClick={() => setNotify({ recipients: selected })}>
                Send notification
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={drivers}
          isLoading={isLoading}
          emptyTitle="No drivers found"
          emptyDesc="No drivers match your filters"
          onRowClick={(row) => navigate(`/drivers/${row._id}`)}
          selectable
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAllOnPage}
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

      {/* Settings popup (empty for now) */}
      <Modal
        open={!!settingsRow}
        onClose={() => setSettingsRow(null)}
        title=""
        size="xl"
      >
        <div className="min-h-[70vh]">
          {settingsRow && <DriverSettingsDetail driver={settingsRow} />}
        </div>
      </Modal>

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

      <SendNotificationModal
        open={!!notify}
        onClose={() => setNotify(null)}
        recipientType="drivers"
        recipients={notify?.recipients || []}
        onSent={() => setSelected([])}
      />
    </div>
  )
}

// Compact key/value list pinned to the top-left of the settings popup, leaving
// the rest of the (wide) dialog free for controls we'll add later.
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className="text-gray-700 font-medium text-right capitalize truncate">{value || '-'}</dd>
    </div>
  )
}

function DriverSettingsDetail({ driver }) {
  const u = driver.userId || {}
  return (
    <div className="max-w-xs space-y-3">
      <div className="flex items-center gap-2.5">
        <Avatar src={u.avatarUrl} name={u.name} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{u.name || '-'}</p>
          {u.email && <p className="text-xs text-gray-500 truncate">{u.email}</p>}
          <p className="text-xs text-gray-500 truncate">{u.phone || '-'}</p>
        </div>
      </div>
      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Gender" value={u.gender} />
        <DetailRow label="Date of Birth" value={u.dateOfBirth ? formatDate(u.dateOfBirth) : null} />
        <DetailRow label="Vehicle" value={driver.vehicleType} />
        <DetailRow label="Plate" value={driver.vehiclePlate} />
        <DetailRow label="Model" value={driver.vehicleModel} />
        <DetailRow label="Color" value={driver.vehicleColor} />
        <DetailRow label="Status" value={driver.status} />
        <DetailRow label="Verified" value={driver.isVerified ? 'Yes' : 'No'} />
        <DetailRow label="Online" value={driver.isOnline ? 'Yes' : 'No'} />
        <DetailRow label="Rating" value={`${(driver.rating || 0).toFixed(1)} (${driver.totalRatings || 0})`} />
        <DetailRow label="Rides" value={(driver.totalRides || 0).toLocaleString()} />
        <DetailRow label="Earnings" value={formatCurrency(driver.earnings || 0)} />
        <DetailRow label="Wallet" value={formatCurrency(driver.walletBalance || 0)} />
        <DetailRow label="Last Login" value={u.lastLoginAt ? formatRelative(u.lastLoginAt) : null} />
        <DetailRow label="Joined" value={driver.createdAt ? formatDate(driver.createdAt) : null} />
      </dl>
      {u.savedAddresses?.length > 0 && (
        <div className="pt-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Addresses</p>
          <div className="space-y-1 text-xs">
            {u.savedAddresses.map((addr, i) => (
              <p key={i} className="text-gray-600 truncate">
                <span className="text-gray-400">{addr.label || 'Address'}: </span>{addr.address}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
