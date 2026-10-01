import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, FileText, Pencil, Trash2, Download, CheckCheck, Phone, Car } from '@/components/ui/icons'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { DocumentLightbox } from '../../components/shared/DocumentLightbox'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { documentsApi } from '../../api/documents.api'
import { useAuthStore } from '../../store/authStore'
import { formatDate, formatRelative } from '../../utils/format'
import { isPdfDoc, docTypeLabel, DOC_TYPE_LABELS, REQUIRED_DOC_TYPES, sortDocs } from '../../utils/documents'
import { downloadDriverDocumentsPdf } from '../../utils/documentsPdf'
import toast from 'react-hot-toast'

// Document verification, one card per driver: every document a driver sent
// sits together (licence, blue book, vehicle photos from each side, …), with
// "approve all" and a single merged PDF of the whole application.

function DocTile({ doc, onOpen, onVerify, onReject, onEdit, onDelete, busy }) {
  const pdf = isPdfDoc(doc)
  return (
    <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <button
        onClick={onOpen}
        className="relative h-28 bg-gray-50 flex items-center justify-center overflow-hidden"
        title="View document"
      >
        {pdf ? (
          <div className="flex flex-col items-center gap-1 text-orange-600">
            <FileText className="h-8 w-8" />
            <span className="text-[11px] font-semibold">PDF</span>
          </div>
        ) : (
          <img src={doc.fileUrl} alt={docTypeLabel(doc.type)} className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </button>
      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <p className="text-[12px] font-semibold text-gray-900 leading-tight">{docTypeLabel(doc.type)}</p>
        <div><StatusBadge status={doc.status} /></div>
        {/* Own row: badge + four icons don't fit side by side in a narrow tile. */}
        <div className="mt-auto -mx-1 flex flex-wrap items-center gap-0.5">
          {doc.status === 'pending' && (
            <>
              <button onClick={onVerify} disabled={busy} title="Approve"
                className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-60">
                <CheckCircle className="h-4 w-4" />
              </button>
              <button onClick={onReject} title="Reject"
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {onEdit && (
            <button onClick={onEdit} title="Edit"
              className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Delete"
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {doc.status === 'rejected' && doc.rejectionReason && (
          <p className="text-[11px] text-red-500 truncate" title={doc.rejectionReason}>{doc.rejectionReason}</p>
        )}
      </div>
    </div>
  )
}

function MissingTile({ type }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 h-full min-h-[11rem] flex flex-col items-center justify-center gap-1 p-3 text-center">
      <FileText className="h-6 w-6 text-gray-300" />
      <p className="text-[12px] font-semibold text-gray-500">{docTypeLabel(type)}</p>
      <p className="text-[11px] text-gray-400">Not uploaded</p>
    </div>
  )
}

function DriverDocumentsCard({ group, actions }) {
  const d = group.driver || {}
  const u = d.userId || {}
  const docs = sortDocs(group.documents)
  const have = new Set(docs.map((x) => x.type))
  const missing = REQUIRED_DOC_TYPES.filter((t) => !have.has(t))
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      await downloadDriverDocumentsPdf(group)
    } catch (e) {
      toast.error(e?.message || 'Could not build the PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar src={u.avatarUrl} name={u.name} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-gray-900 truncate">{u.name || 'Unknown driver'}</p>
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-500">
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{u.phone || '-'}</span>
              <span className="inline-flex items-center gap-1 capitalize">
                <Car className="h-3.5 w-3.5" />{(d.vehicleType || '-').replace(/_/g, ' ')} · {d.vehiclePlate || '-'}
              </span>
              <span>Licence {d.licenseNumber || '-'} · expires {d.licenseExpiry ? formatDate(d.licenseExpiry) : '-'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{docs.length} uploaded</span>
              {group.counts.pending > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{group.counts.pending} pending</span>}
              {group.counts.approved > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{group.counts.approved} approved</span>}
              {group.counts.rejected > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">{group.counts.rejected} rejected</span>}
              {missing.length > 0 && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{missing.length} missing</span>}
              <span className="px-2 py-0.5 text-gray-400 font-normal">Last upload {formatRelative(group.lastSubmittedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="secondary" icon={Download} loading={downloading} onClick={download}>
            Download PDF
          </Button>
          {group.counts.pending > 0 && (
            <Button size="sm" variant="success" icon={CheckCheck}
              loading={actions.verifyAllPending === d._id}
              onClick={() => actions.verifyAll(d._id)}>
              Approve all ({group.counts.pending})
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {docs.map((doc) => (
          <DocTile
            key={doc._id}
            doc={doc}
            busy={actions.verifyBusy}
            onOpen={() => actions.open(doc)}
            onVerify={() => actions.verify(doc._id)}
            onReject={() => actions.reject(doc)}
            onEdit={actions.edit ? () => actions.edit(doc) : null}
            onDelete={actions.remove ? () => actions.remove(doc) : null}
          />
        ))}
        {missing.map((t) => <MissingTile key={t} type={t} />)}
      </div>
    </div>
  )
}

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
    queryKey: ['documents', 'by-driver', tab],
    queryFn: () => documentsApi.byDriver(tab === 'all' ? {} : { status: tab }),
  })
  const groups = data?.data || []

  const refresh = () => qc.invalidateQueries({ queryKey: ['documents'] })

  const verify = useMutation({
    mutationFn: (id) => documentsApi.verify(id),
    onSuccess: () => { refresh(); toast.success('Document approved') },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const verifyAll = useMutation({
    mutationFn: (driverId) => documentsApi.verifyAll(driverId),
    onSuccess: (res) => { refresh(); toast.success(`${res?.data?.approved ?? 'All'} documents approved`) },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }) => documentsApi.reject(id, reason),
    onSuccess: () => {
      refresh()
      toast.success('Document rejected')
      setRejectDoc(null)
      setRejectReason('')
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const updateDoc = useMutation({
    mutationFn: ({ id, data }) => documentsApi.update(id, data),
    onSuccess: () => {
      refresh()
      toast.success('Document updated')
      setEditDoc(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to update'),
  })

  const removeDoc = useMutation({
    mutationFn: (id) => documentsApi.remove(id),
    onSuccess: () => {
      refresh()
      toast.success('Document deleted')
      setDeleteDoc(null)
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete'),
  })

  const openEdit = (doc) => {
    setEditType(doc.type || '')
    setEditExpiry(doc.expiresAt ? doc.expiresAt.slice(0, 10) : '')
    setEditDoc(doc)
  }

  const actions = {
    open: setLightbox,
    verify: (id) => verify.mutate(id),
    verifyBusy: verify.isPending,
    verifyAll: (driverId) => verifyAll.mutate(driverId),
    verifyAllPending: verifyAll.isPending ? verifyAll.variables : null,
    reject: setRejectDoc,
    edit: canEdit ? openEdit : null,
    remove: canDelete ? setDeleteDoc : null,
  }

  const tabs = [
    { value: 'pending', label: 'Pending', count: tab === 'pending' ? groups.length : undefined },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All drivers' },
  ]

  return (
    <div>
      <PageHeader title="Document Verification" description="Every driver's documents together — review, approve, or download as one PDF" />

      <div className="bg-white border border-gray-200 rounded-2xl">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        <div className="p-5 space-y-4 bg-gray-50/50">
          {isLoading ? (
            <p className="text-sm text-gray-500 py-10 text-center">Loading…</p>
          ) : groups.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="h-9 w-9 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-gray-700">
                {tab === 'all' ? 'No driver documents yet' : `No drivers with ${tab} documents`}
              </p>
              <p className="text-[13px] text-gray-500">
                {tab === 'pending' ? 'All documents have been reviewed' : 'Documents appear here once drivers upload them'}
              </p>
            </div>
          ) : (
            groups.map((g) => <DriverDocumentsCard key={g.driver._id} group={g} actions={actions} />)
          )}
        </div>
      </div>

      {/* Lightbox - opens PDFs as PDF, images inline */}
      <DocumentLightbox
        doc={lightbox}
        onClose={() => setLightbox(null)}
        actions={lightbox?.status === 'pending' && (
          <div className="flex gap-3">
            <Button variant="success" className="flex-1" onClick={() => { verify.mutate(lightbox._id); setLightbox(null) }} loading={verify.isPending}>
              Approve Document
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
