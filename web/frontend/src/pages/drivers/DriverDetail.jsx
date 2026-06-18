import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, Star, Car, FileText, TrendingUp, Eye, Wallet } from '@/components/ui/icons'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { DataTable } from '../../components/shared/DataTable'
import { DocumentLightbox } from '../../components/shared/DocumentLightbox'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { TableSpinner } from '../../components/ui/Spinner'
import { driversApi } from '../../api/drivers.api'
import { documentsApi } from '../../api/documents.api'
import { formatDate, formatCurrency, formatRelative } from '../../utils/format'
import { isPdf, docTypeLabel } from '../../utils/documents'
import toast from 'react-hot-toast'

export default function DriverDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [lightboxDoc, setLightboxDoc] = useState(null)
  const [showGrant, setShowGrant] = useState(false)

  const { data: driverRes, isLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => driversApi.get(id),
  })

  const { data: docsRes, isLoading: docsLoading } = useQuery({
    queryKey: ['driver-docs', id],
    queryFn: () => driversApi.documents(id),
    enabled: activeTab === 'documents',
  })

  const updateStatus = useMutation({
    mutationFn: (status) => driversApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver', id] }); toast.success('Status updated') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const verifyDoc = useMutation({
    mutationFn: (docId) => documentsApi.verify(docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-docs', id] }); toast.success('Document verified') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const rejectDoc = useMutation({
    mutationFn: ({ docId, reason }) => documentsApi.reject(docId, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-docs', id] }); toast.success('Document rejected') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const grant = useMutation({
    mutationFn: (data) => driversApi.grant(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['driver', id] })
      toast.success(res?.message || 'Money granted to driver')
      setShowGrant(false)
    },
    onError: (err) => toast.error(err?.message || 'Failed to grant money'),
  })

  const driverPayload = driverRes?.data
  const driver = driverPayload?.driver || driverPayload
  const docs = docsRes?.data || driverPayload?.documents || []

  const tabs = [
    { value: 'profile', label: 'Profile' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'documents', label: 'Documents' },
    { value: 'stats', label: 'Statistics' },
  ]

  const docColumns = [
    {
      key: 'type',
      header: 'Document',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
            {row.fileUrl && !isPdf(row.fileUrl) ? (
              <img src={row.fileUrl} alt={val} className="h-full w-full object-cover" />
            ) : (
              <FileText className={`h-5 w-5 ${row.fileUrl ? 'text-orange-500' : 'text-gray-300'}`} />
            )}
          </div>
          <span className="text-sm font-medium text-gray-900">{docTypeLabel(val)}</span>
        </div>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expiry',
      render: (val) => <span className="text-xs text-gray-500">{val ? formatDate(val) : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val, row) => (
        <div>
          <StatusBadge status={val} />
          {row.rejectionReason && (
            <p className="text-xs text-red-500 mt-1 max-w-[220px] truncate" title={row.rejectionReason}>
              {row.rejectionReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (docId, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxDoc(row) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="View document"
          >
            <Eye className="h-4 w-4" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); verifyDoc.mutate(docId) }}
                disabled={verifyDoc.isPending}
                className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 disabled:opacity-60"
                title="Verify"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); rejectDoc.mutate({ docId, reason: 'Document unclear' }) }}
                className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <TableSpinner />
  if (!driver) return <div className="p-4 text-gray-500">Driver not found.</div>

  const user = driver.userId

  return (
    <div>
      {/* Back + Actions header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Drivers
        </button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Wallet} onClick={() => setShowGrant(true)}>
            Grant Money
          </Button>
          {driver.status === 'pending' && (
            <>
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle}
                onClick={() => updateStatus.mutate('approved')}
                loading={updateStatus.isPending}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={XCircle}
                onClick={() => updateStatus.mutate('rejected')}
                loading={updateStatus.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {driver.status === 'approved' && (
            <Button variant="warning" size="sm" onClick={() => updateStatus.mutate('suspended')} loading={updateStatus.isPending}>
              Suspend
            </Button>
          )}
          {driver.status === 'suspended' && (
            <Button variant="success" size="sm" onClick={() => updateStatus.mutate('approved')} loading={updateStatus.isPending}>
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Driver card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-start gap-3">
          <Avatar src={user?.avatarUrl} name={user?.name} size="xl" />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{user?.name || '—'}</h2>
                <p className="text-sm text-gray-500">{user?.phone}</p>
                {user?.email && <p className="text-sm text-gray-400">{user.email}</p>}
              </div>
              <div className="flex gap-2">
                <StatusBadge status={driver.status} />
                {driver.isVerified && <Badge variant="success">Verified</Badge>}
                <StatusBadge status={driver.isOnline ? 'online' : 'offline'} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Rides', value: driver.totalRides?.toLocaleString() || '0', icon: Car },
                { label: 'Rating', value: `${(driver.rating || 0).toFixed(1)} ⭐`, icon: Star },
                { label: 'Total Earnings', value: formatCurrency(driver.earnings || 0), icon: TrendingUp },
                { label: 'Wallet Balance', value: formatCurrency(driver.walletBalance || 0), icon: Wallet },
                { label: 'Cancelled', value: driver.cancelledRides || 0, icon: XCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <Icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 pt-4">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>
        <div className="p-4">
          {activeTab === 'profile' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'License Number', value: driver.licenseNumber },
                { label: 'License Expiry', value: formatDate(driver.licenseExpiry) },
                { label: 'Vehicle Capacity', value: driver.vehicleCapacity },
                { label: 'Last Active', value: formatRelative(driver.lastActiveAt) },
                { label: 'Member Since', value: formatDate(driver.createdAt) },
                { label: 'Currently On Ride', value: driver.isOnRide ? 'Yes' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'vehicle' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Vehicle Type', value: driver.vehicleType },
                { label: 'Vehicle Plate', value: driver.vehiclePlate },
                { label: 'Vehicle Model', value: driver.vehicleModel },
                { label: 'Vehicle Color', value: driver.vehicleColor },
                { label: 'Vehicle Year', value: driver.vehicleYear },
                { label: 'Capacity', value: driver.vehicleCapacity },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800 capitalize">{value || '—'}</p>
                </div>
              ))}
              {driver.documents?.vehicleImage && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-2">Vehicle Photo</p>
                  <img
                    src={driver.documents.vehicleImage}
                    alt="Vehicle"
                    className="h-40 w-full object-cover rounded-lg cursor-pointer"
                    onClick={() => setLightboxDoc({ fileUrl: driver.documents.vehicleImage, type: 'vehicle_photo' })}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="-mx-6 -mb-6">
              <DataTable
                columns={docColumns}
                data={docs}
                isLoading={docsLoading}
                onRowClick={setLightboxDoc}
                emptyTitle="No documents uploaded"
                emptyDesc="This driver has not submitted any documents yet"
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Rides Completed', value: driver.totalRides?.toLocaleString() || '0' },
                { label: 'Cancelled Rides', value: driver.cancelledRides || 0 },
                { label: 'Average Rating', value: `${(driver.rating || 0).toFixed(2)} / 5.00` },
                { label: 'Total Ratings Received', value: driver.totalRatings || 0 },
                { label: 'Total Earnings', value: formatCurrency(driver.earnings || 0) },
                { label: 'Pool Assignments', value: driver.poolAssignments?.length || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox — opens PDFs as PDF, images inline */}
      <DocumentLightbox doc={lightboxDoc} onClose={() => setLightboxDoc(null)} />

      {/* Grant money modal */}
      <Modal open={showGrant} onClose={() => setShowGrant(false)} title="Grant Money to Driver" size="sm">
        <GrantMoneyForm
          driverName={user?.name}
          walletBalance={driver.walletBalance || 0}
          loading={grant.isPending}
          onCancel={() => setShowGrant(false)}
          onSubmit={(values) => grant.mutate(values)}
        />
      </Modal>
    </div>
  )
}

function GrantMoneyForm({ driverName, walletBalance, loading, onCancel, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const parsed = parseFloat(amount)
  const valid = parsed > 0

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    onSubmit({ amount: parsed, note: note.trim() || undefined })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm">
        <p className="text-gray-600">Crediting <strong>{driverName || 'driver'}</strong></p>
        <p className="text-xs text-gray-400 mt-0.5">Current wallet balance: {formatCurrency(walletBalance)}</p>
      </div>

      <Input
        label="Amount (NPR)"
        type="number"
        min="1"
        step="0.01"
        placeholder="e.g. 500"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus
      />

      <Textarea
        label="Note (optional)"
        placeholder="e.g. Festival promotion bonus — sent to the driver's notification and email"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="text-xs text-gray-400 -mt-2">The driver gets an in-app notification and an email with this note.</p>

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading} disabled={!valid}>
          Grant {valid ? formatCurrency(parsed) : 'Money'}
        </Button>
      </div>
    </form>
  )
}
