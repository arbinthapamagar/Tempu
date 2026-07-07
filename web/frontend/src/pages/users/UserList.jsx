import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserX, Eye, Ban, CheckCircle, Bell, Send, X, Download } from '@/components/ui/icons'
import { SendNotificationModal } from '../../components/shared/SendNotificationModal'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { usersApi } from '../../api/users.api'
import { formatDate, formatCurrency, formatRelative } from '../../utils/format'
import { exportToCsv, dateStamp } from '../../utils/export'
import toast from 'react-hot-toast'

const USER_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'parent', label: 'Parent' },
  { value: 'business', label: 'Business' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
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

const JOINED_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
]

// Translate the rating filter value into backend min/max params.
const ratingToParams = (v) => (v === 'lt3' ? { maxRating: 3 } : v ? { minRating: v } : {})
// Joined buckets become a `joinedFrom` cutoff date (now minus N days).
const joinedToParams = (v) => {
  if (!v) return {}
  const d = new Date()
  d.setDate(d.getDate() - Number(v))
  return { joinedFrom: d.toISOString() }
}

export default function UserList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [joinedFilter, setJoinedFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { user, action }
  const [selected, setSelected] = useState([]) // [{ id, label }] for notifications
  const [notify, setNotify] = useState(null)   // { recipients: [{id,label}] }
  const [exporting, setExporting] = useState(false)

  // Shared query params for the active filters - reused by the table, "select
  // all matching" and the CSV export so they always agree.
  const buildParams = (extra = {}) => ({
    search,
    status: statusFilter,
    userType: userTypeFilter,
    verified: verifiedFilter || undefined,
    ...ratingToParams(ratingFilter),
    ...joinedToParams(joinedFilter),
    ...extra,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, statusFilter, userTypeFilter, ratingFilter, verifiedFilter, joinedFilter],
    queryFn: () => usersApi.list(buildParams({ page, limit: 20 })),
    keepPreviousData: true,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => usersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User status updated')
      setConfirmAction(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to update status'),
  })

  const users = data?.data?.users || data?.data || []
  const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: 20 }

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])
  const labelOf = (u) => u.name || u.phone || 'User'
  const toggleRow = (u) =>
    setSelected((prev) => prev.some((s) => s.id === u._id)
      ? prev.filter((s) => s.id !== u._id)
      : [...prev, { id: u._id, label: labelOf(u) }])
  const toggleAllOnPage = () => {
    const pageIds = new Set(users.map((u) => u._id))
    const allSelected = users.every((u) => selectedIds.has(u._id))
    setSelected((prev) => allSelected
      ? prev.filter((s) => !pageIds.has(s.id))
      : [...prev.filter((s) => !pageIds.has(s.id)), ...users.map((u) => ({ id: u._id, label: labelOf(u) }))])
  }
  const selectAllMatching = async () => {
    try {
      const res = await usersApi.list(buildParams({ page: 1, limit: Math.max(pagination.total, 1) }))
      const all = res?.data?.users || res?.data || []
      setSelected(all.map((u) => ({ id: u._id, label: labelOf(u) })))
      toast.success(`Selected all ${all.length} matching users`)
    } catch {
      toast.error('Could not select all')
    }
  }

  // Pull every user matching the current filters and download as CSV (opens in Excel).
  const exportData = async () => {
    setExporting(true)
    try {
      const res = await usersApi.list(buildParams({ page: 1, limit: Math.max(pagination.total, 1) }))
      const all = res?.data?.users || res?.data || []
      if (!all.length) { toast.error('Nothing to export'); return }
      exportToCsv(`users-${dateStamp()}`, [
        { label: 'Name', value: (u) => u.name || '' },
        { label: 'Phone', value: (u) => u.phone || '' },
        { label: 'Email', value: (u) => u.email || '' },
        { label: 'Type', value: (u) => u.userType || '' },
        { label: 'Status', value: (u) => u.accountStatus || '' },
        { label: 'Rating', value: (u) => u.rating?.average?.toFixed(1) || '' },
        { label: 'Total Ratings', value: (u) => u.rating?.total || 0 },
        { label: 'Wallet Balance', value: (u) => u.walletBalance || 0 },
        { label: 'Phone Verified', value: (u) => (u.isPhoneVerified ? 'Yes' : 'No') },
        { label: 'Email Verified', value: (u) => (u.isEmailVerified ? 'Yes' : 'No') },
        { label: 'Joined', value: (u) => formatDate(u.createdAt) },
      ], all)
      toast.success(`Exported ${all.length} users`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatarUrl} name={val} size="sm" />
          <div>
            <p className="font-medium text-gray-900 text-sm">{val}</p>
            <p className="text-xs text-gray-400">{row.phone}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (val) => val || <span className="text-gray-400">-</span> },
    {
      key: 'userType',
      header: 'Type',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'accountStatus',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (val, row) => (
        <span className="text-sm">
          ⭐ {row.rating?.average?.toFixed(1) || '-'}
          <span className="text-gray-400 text-xs ml-1">({row.rating?.total || 0})</span>
        </span>
      ),
    },
    {
      key: 'walletBalance',
      header: 'Wallet',
      render: (val) => formatCurrency(val || 0),
    },
    {
      key: 'isPhoneVerified',
      header: 'Verified',
      render: (val) => val
        ? <CheckCircle className="h-4 w-4 text-emerald-500" />
        : <span className="text-gray-300 text-xs">No</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (val) => formatDate(val),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedUser(row) }}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-orange-600"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setNotify({ recipients: [{ id: row._id, label: labelOf(row) }] }) }}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-orange-600"
            title="Send notification"
          >
            <Bell className="h-4 w-4" />
          </button>
          {row.accountStatus === 'active' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmAction({ user: row, action: 'suspended' }) }}
              className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600"
              title="Suspend"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
          {row.accountStatus !== 'banned' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmAction({ user: row, action: 'banned' }) }}
              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
              title="Ban"
            >
              <Ban className="h-4 w-4" />
            </button>
          )}
          {row.accountStatus !== 'active' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmAction({ user: row, action: 'active' }) }}
              className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600"
              title="Activate"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage all registered passengers and their accounts"
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={exportData} loading={exporting}>
            Export
          </Button>
        }
      />

      <div className="bg-white border border-gray-200">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1) }}
            filters={[
              {
                placeholder: 'All Statuses',
                value: statusFilter,
                onChange: (v) => { setStatusFilter(v); setPage(1) },
                options: STATUS_OPTIONS,
              },
              {
                placeholder: 'All Types',
                value: userTypeFilter,
                onChange: (v) => { setUserTypeFilter(v); setPage(1) },
                options: USER_TYPE_OPTIONS,
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
                placeholder: 'Any Join Date',
                value: joinedFilter,
                onChange: (v) => { setJoinedFilter(v); setPage(1) },
                options: JOINED_OPTIONS,
              },
            ]}
          />
        </div>

        {/* Bulk selection bar */}
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
          data={users}
          isLoading={isLoading}
          emptyTitle="No users found"
          emptyDesc="No users match your filters"
          onRowClick={setSelectedUser}
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

      {/* User Detail Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
        size="lg"
      >
        {selectedUser && <UserDetailContent user={selectedUser} />}
      </Modal>

      {/* Confirm action dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => updateStatus.mutate({ id: confirmAction?.user?._id, status: confirmAction?.action })}
        loading={updateStatus.isPending}
        title={`${confirmAction?.action === 'active' ? 'Activate' : confirmAction?.action === 'suspended' ? 'Suspend' : 'Ban'} User`}
        message={`Are you sure you want to ${confirmAction?.action === 'active' ? 'activate' : confirmAction?.action === 'suspended' ? 'suspend' : 'ban'} ${confirmAction?.user?.name}?`}
        confirmLabel={confirmAction?.action === 'active' ? 'Activate' : confirmAction?.action === 'suspended' ? 'Suspend' : 'Ban'}
        variant={confirmAction?.action === 'active' ? 'success' : 'danger'}
      />

      {/* Send notification */}
      <SendNotificationModal
        open={!!notify}
        onClose={() => setNotify(null)}
        recipientType="users"
        recipients={notify?.recipients || []}
        onSent={() => setSelected([])}
      />
    </div>
  )
}

function UserDetailContent({ user }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl} name={user.name} size="xl" />
        <div>
          <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
          <p className="text-sm text-gray-500">{user.phone}</p>
          {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
          <div className="flex gap-2 mt-2">
            <StatusBadge status={user.accountStatus} />
            <StatusBadge status={user.userType} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Gender', value: user.gender },
          { label: 'Date of Birth', value: formatDate(user.dateOfBirth) },
          { label: 'Wallet Balance', value: formatCurrency(user.walletBalance || 0) },
          { label: 'Rating', value: `${user.rating?.average?.toFixed(1) || '-'} (${user.rating?.total || 0} reviews)` },
          { label: 'Phone Verified', value: user.isPhoneVerified ? 'Yes' : 'No' },
          { label: 'Email Verified', value: user.isEmailVerified ? 'Yes' : 'No' },
          { label: 'Preferred Payment', value: user.preferredPaymentMethod || '-' },
          { label: 'Last Login', value: formatRelative(user.lastLoginAt) },
          { label: 'Member Since', value: formatDate(user.createdAt) },
          { label: 'Driver Profile', value: user.driverProfile ? 'Yes' : 'No' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-700 capitalize">{value || '-'}</p>
          </div>
        ))}
      </div>
      {user.savedAddresses?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Saved Addresses</h4>
          <div className="space-y-2">
            {user.savedAddresses.map((addr, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <Badge variant="default">{addr.label || 'Address'}</Badge>
                <span className="text-gray-600">{addr.address}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
