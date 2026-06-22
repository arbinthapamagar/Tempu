import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { tripsApi } from '../../api/trips.api'
import { formatDate, formatCurrency, formatDistance, formatDuration } from '../../utils/format'

const VEHICLE_OPTIONS = [
  { value: 'tuktuk', label: 'Tuktuk' },
  { value: 'tuktuk_delivery', label: 'Tuktuk Delivery' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'bike', label: 'Bike' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'comfort', label: 'Comfort' },
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'esewa', label: 'eSewa' },
  { value: 'wallet', label: 'Wallet' },
]

export default function TripList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, search, statusTab, vehicleType, paymentMethod],
    queryFn: () =>
      tripsApi.list({
        page, limit: 20, search,
        status: statusTab || undefined,
        vehicleType: vehicleType || undefined,
        paymentMethod: paymentMethod || undefined,
      }),
    keepPreviousData: true,
  })

  const trips = data?.data?.trips || data?.data || []
  const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: 20 }

  const tabs = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'started', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const columns = [
    {
      key: '_id',
      header: 'Trip ID',
      render: (val) => <span className="text-xs font-mono text-gray-400">{val?.slice(-8).toUpperCase()}</span>,
    },
    {
      key: 'userId',
      header: 'Rider',
      render: (val) => <span className="text-sm font-medium">{val?.name || '—'}</span>,
    },
    {
      key: 'driverId',
      header: 'Driver',
      render: (val) => val?.userId?.name || <span className="text-gray-400 italic">Unassigned</span>,
    },
    {
      key: 'vehicleType',
      header: 'Vehicle',
      render: (val) => <span className="capitalize text-sm">{val}</span>,
    },
    {
      key: 'pickup',
      header: 'Pickup',
      render: (val) => (
        <span className="text-xs text-gray-600 max-w-[120px] block truncate" title={val?.address}>
          {val?.address || '—'}
        </span>
      ),
    },
    {
      key: 'dropoff',
      header: 'Drop-off',
      render: (val) => (
        <span className="text-xs text-gray-600 max-w-[120px] block truncate" title={val?.address}>
          {val?.address || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'finalPrice',
      header: 'Price',
      render: (val, row) => (
        <div>
          <p className="font-medium text-sm">{formatCurrency(val || row.offeredPrice)}</p>
          {row.platformFee > 0 && (
            <p className="text-xs text-gray-400">Fee: {formatCurrency(row.platformFee)}</p>
          )}
        </div>
      ),
    },
    { key: 'distance', header: 'Distance', render: (val) => formatDistance(val) },
    { key: 'duration', header: 'Duration', render: (val) => formatDuration(val) },
    {
      key: 'paymentMethod',
      header: 'Payment',
      render: (val, row) => (
        <div>
          <StatusBadge status={val} />
          <br />
          <StatusBadge status={row.paymentStatus} />
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (val) => (
        <div>
          <p className="text-sm">{formatDate(val, 'MMM dd')}</p>
          <p className="text-xs text-gray-400">{formatDate(val, 'hh:mm a')}</p>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Trip Management" description="View and monitor all platform trips" />

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>
        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1) }}
            filters={[
              {
                placeholder: 'All Vehicles',
                value: vehicleType,
                onChange: (v) => { setVehicleType(v); setPage(1) },
                options: VEHICLE_OPTIONS,
              },
              {
                placeholder: 'All Payments',
                value: paymentMethod,
                onChange: (v) => { setPaymentMethod(v); setPage(1) },
                options: PAYMENT_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={trips}
          isLoading={isLoading}
          emptyTitle="No trips found"
          emptyDesc="No trips match your filters"
          onRowClick={(row) => navigate(`/trips/${row._id}`)}
        />

        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
