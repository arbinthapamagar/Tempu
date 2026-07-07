import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, FileText, Pencil, Trash2 } from '@/components/ui/icons'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { DataTable } from '../../components/shared/DataTable'
import { DocumentLightbox } from '../../components/shared/DocumentLightbox'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { documentsApi } from '../../api/documents.api'
import { useAuthStore } from '../../store/authStore'
import { formatDate, formatRelative } from '../../utils/format'
import { isPdf, docTypeLabel, DOC_TYPE_LABELS } from '../../utils/documents'
import toast from 'react-hot-toast'

export default function DocumentQueue() {
  const qc = useQueryClient()
  const admin = useAuthStore((s) => s.admin)
  const isSuper = admin?.role === 'superadmin'
  const canEdit = isSuper || !!admin?.permissions?.editDocuments
  const canDelete = isSuper || !!admin?.permissions?.deleteDocuments
  const [tab, setTab] = useState('pending')
  const [lightbox, setLightbox] = useState(null)
  const [rejectDoc, setRejectDoc] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editDoc, setEditDoc] = useState(null)
  const [editType, setEditType] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [deleteDoc, setDeleteDoc] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', tab],
    queryFn: () => documentsApi.list({ status: tab }),
  })

  const verify = useMutation({
    mutationFn: (id) => documentsApi.verify(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document verified') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }) => documentsApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document rejected')
      setRejectDoc(null)
      setRejectReason('')
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const updateDoc = useMutation({
    mutationFn: ({ id, data }) => documentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document updated')
      setEditDoc(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to update'),
  })

  const removeDoc = useMutation({
    mutationFn: (id) => documentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document deleted')
      setDeleteDoc(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete'),
  })

  const openEdit = (row) => {
    setEditType(row.type || '')
    setEditExpiry(row.expiresAt ? row.expiresAt.slice(0, 10) : '')
    setEditDoc(row)
  }

  const docs = data?.data?.documents || data?.data || []

  const tabs = [
    { value: 'pending', label: 'Pending', count: tab === 'pending' ? docs.length : undefined },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const columns = [
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
      key: 'driverId',
      header: 'Driver',
      render: (_val, row) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.driverId?.userId?.name} size="xs" />
          <span className="text-sm text-gray-700">{row.driverId?.userId?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (val) => <span className="text-xs text-gray-500">{val ? formatDate(val) : '-'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (val) => <span className="text-xs text-gray-500">{formatRelative(val)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val, row) => (
        <div>
          <StatusBadge status={val} />
          {val === 'rejected' && row.rejectionReason && (
            <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={row.rejectionReason}>
              {row.rejectionReason}
            </p>
          )}
          {val === 'approved' && row.verifiedAt && (
            <p className="text-xs text-emerald-600 mt-1">Verified {formatRelative(row.verifiedAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(row) }}
            className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600"
            title="View document"
          >
            <Eye className="h-4 w-4" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); verify.mutate(id) }}
                disabled={verify.isPending}
                className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 disabled:opacity-60"
                title="Verify"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRejectDoc(row) }}
                className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(row) }}
              className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteDoc(row) }}
              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Document Verification" description="Review and verify driver documents" />

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        <DataTable
          columns={columns}
          data={docs}
          isLoading={isLoading}
          onRowClick={setLightbox}
          emptyTitle={`No ${tab} documents`}
          emptyDesc={tab === 'pending' ? 'All documents have been reviewed' : `No ${tab} documents found`}
        />
      </div>

      {/* Lightbox - opens PDFs as PDF, images inline */}
      <DocumentLightbox
        doc={lightbox}
        onClose={() => setLightbox(null)}
        actions={lightbox?.status === 'pending' && (
          <div className="flex gap-3">
            <Button variant="success" className="flex-1" onClick={() => { verify.mutate(lightbox._id); setLightbox(null) }} loading={verify.isPending}>
              Verify Document
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => { setRejectDoc(lightbox); setLightbox(null) }}>
              Reject Document
            </Button>
          </div>
        )}
      />

      {/* Edit document modal (type + expiry) */}
      <Modal open={!!editDoc} onClose={() => setEditDoc(null)} title="Edit Document" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-orange-500"
            >
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
            <input
              type="date"
              value={editExpiry}
              onChange={(e) => setEditExpiry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={updateDoc.isPending}
              onClick={() => updateDoc.mutate({ id: editDoc._id, data: { type: editType, expiresAt: editExpiry || null } })}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => deleteDoc && removeDoc.mutate(deleteDoc._id)}
        title="Delete document"
        message={`Permanently delete this ${docTypeLabel(deleteDoc?.type)}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={removeDoc.isPending}
      />

      {/* Reject reason modal */}
      <Modal open={!!rejectDoc} onClose={() => { setRejectDoc(null); setRejectReason('') }} title="Reject Document" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Rejecting: <strong>{docTypeLabel(rejectDoc?.type)}</strong>
          </p>
          <Textarea
            label="Rejection Reason"
            placeholder="Explain why this document is being rejected..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setRejectDoc(null); setRejectReason('') }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={!rejectReason.trim()}
              loading={reject.isPending}
              onClick={() => reject.mutate({ id: rejectDoc._id, reason: rejectReason })}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
