import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserX, Eye, Ban, CheckCircle } from '@/components/ui/icons'
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

export default function UserList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { user, action }

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, statusFilter, userTypeFilter],
    queryFn: () => usersApi.list({ page, limit: 20, search, status: statusFilter, userType: userTypeFilter }),
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
    { key: 'email', header: 'Email', render: (val) => val || <span className="text-gray-400">—</span> },
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
          ⭐ {row.rating?.average?.toFixed(1) || '—'}
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
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
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
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyTitle="No users found"
          emptyDesc="No users match your filters"
          onRowClick={setSelectedUser}
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
          { label: 'Rating', value: `${user.rating?.average?.toFixed(1) || '—'} (${user.rating?.total || 0} reviews)` },
          { label: 'Phone Verified', value: user.isPhoneVerified ? 'Yes' : 'No' },
          { label: 'Email Verified', value: user.isEmailVerified ? 'Yes' : 'No' },
          { label: 'Preferred Payment', value: user.preferredPaymentMethod || '—' },
          { label: 'Last Login', value: formatRelative(user.lastLoginAt) },
          { label: 'Member Since', value: formatDate(user.createdAt) },
          { label: 'Driver Profile', value: user.driverProfile ? 'Yes' : 'No' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-700 capitalize">{value || '—'}</p>
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
