import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Eye, Building2 } from 'lucide-react'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { suppliersApi } from '../../api/suppliers.api'
import { formatDate, formatRelative } from '../../utils/format'
import toast from 'react-hot-toast'

const CITY_OPTIONS = [
  { value: 'kathmandu', label: 'Kathmandu' },
  { value: 'pokhara', label: 'Pokhara' },
  { value: 'lalitpur', label: 'Lalitpur' },
  { value: 'bhaktapur', label: 'Bhaktapur' },
  { value: 'birgunj', label: 'Birgunj' },
  { value: 'butwal', label: 'Butwal' },
]

export default function SupplierList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search, city],
    queryFn: () => suppliersApi.list({ page, limit: 20, search, city: city || undefined }),
    keepPreviousData: true,
  })

  const verify = useMutation({
    mutationFn: (id) => suppliersApi.verify(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier verified') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => suppliersApi.toggle(id, isActive),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const suppliers = data?.data?.suppliers || data?.data || []
  const pagination = data?.data?.pagination || { total: 0, totalPages: 1 }

  const columns = [
    {
      key: 'businessName',
      header: 'Business',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          {row.logoUrl ? (
            <img src={row.logoUrl} alt={val} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-purple-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{val}</p>
            <p className="text-xs text-gray-400">{row.contactPerson}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    {
      key: 'city',
      header: 'City',
      render: (val) => <span className="capitalize text-sm">{val}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (val, row) => (
        <div>
          <Badge variant={val === 'premium' ? 'purple' : 'default'}>{val}</Badge>
          {row.planExpiresAt && (
            <p className="text-xs text-gray-400 mt-0.5">Expires: {formatDate(row.planExpiresAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'isVerified',
      header: 'Verified',
      render: (val) => val
        ? <CheckCircle className="h-4 w-4 text-emerald-500" />
        : <span className="text-xs text-amber-600 font-medium">Pending</span>,
    },
    {
      key: 'isActive',
      header: 'Active',
      render: (val) => <StatusBadge status={val ? 'active' : 'suspended'} />,
    },
    {
      key: 'vehicles',
      header: 'Vehicles',
      render: (val) => <span className="text-sm">{val?.length || 0} listed</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (val) => formatDate(val),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelected(row) }} className="p-1.5 hover:bg-indigo-50 rounded text-gray-400 hover:text-indigo-600">
            <Eye className="h-4 w-4" />
          </button>
          {!row.isVerified && (
            <button onClick={(e) => { e.stopPropagation(); verify.mutate(id) }} className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600">
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggle.mutate({ id, isActive: !row.isActive }) }}
            className={`p-1.5 rounded text-xs font-medium ${row.isActive ? 'hover:bg-red-50 text-gray-400 hover:text-red-600' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'}`}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Supplier Management" description="Manage registered suppliers and vehicle listings" />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1) }}
            filters={[
              {
                placeholder: 'All Cities',
                value: city,
                onChange: (v) => { setCity(v); setPage(1) },
                options: CITY_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable columns={columns} data={suppliers} isLoading={isLoading} emptyTitle="No suppliers found" onRowClick={setSelected} />

        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Supplier Details" size="lg">
        {selected && <SupplierDetail supplier={selected} />}
      </Modal>
    </div>
  )
}

function SupplierDetail({ supplier }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Business Name', value: supplier.businessName },
          { label: 'Contact Person', value: supplier.contactPerson },
          { label: 'Phone', value: supplier.phone },
          { label: 'Email', value: supplier.email },
          { label: 'Address', value: supplier.address },
          { label: 'City', value: supplier.city },
          { label: 'Plan', value: supplier.plan },
          { label: 'Plan Expires', value: formatDate(supplier.planExpiresAt) },
          { label: 'Verified', value: supplier.isVerified ? 'Yes' : 'No' },
          { label: 'Active', value: supplier.isActive ? 'Yes' : 'No' },
          { label: 'Joined', value: formatDate(supplier.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800 capitalize">{value || '—'}</p>
          </div>
        ))}
      </div>

      {supplier.vehicles?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Vehicle Listings ({supplier.vehicles.length})</h4>
          <div className="space-y-3">
            {supplier.vehicles.map((v, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.brand} {v.model} <span className="capitalize text-gray-400">({v.type})</span></p>
                    <p className="text-sm text-indigo-600 font-semibold mt-0.5">
                      NPR {v.price?.toLocaleString()} / {v.priceType}
                    </p>
                  </div>
                  <Badge variant={v.isAvailable ? 'success' : 'default'}>
                    {v.isAvailable ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
