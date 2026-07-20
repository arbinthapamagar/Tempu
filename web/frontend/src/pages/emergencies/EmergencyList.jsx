import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, MapPin, CheckCircle, BellRing, Phone, Navigation, Lock, Mail, Car } from '@/components/ui/icons'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Tabs } from '../../components/ui/Tabs'
import { emergenciesApi } from '../../api/emergencies.api'
import { supportApi } from '../../api/support.api'
import { formatRelative, formatDateTime } from '../../utils/format'
import toast from 'react-hot-toast'

export default function EmergencyList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusTab, setStatusTab] = useState('active')
  const [selectedId, setSelectedId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['emergencies', page, statusTab],
    queryFn: () => emergenciesApi.list({ page, limit: 20, status: statusTab || undefined }),
    keepPreviousData: true,
    refetchInterval: 15000, // keep the active queue fresh
  })

  const update = useMutation({
    mutationFn: ({ id, status }) => emergenciesApi.update(id, { status }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['emergencies'] })
      qc.invalidateQueries({ queryKey: ['emergency', selectedId] })
      toast.success(res?.message || 'Updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const emergencies = data?.data?.emergencies || []
  const pagination = data?.data?.pagination || { total: 0, pages: 1 }
  const activeCount = data?.data?.activeCount || 0

  const tabs = [
    { value: 'active', label: 'Active', count: statusTab === 'active' ? undefined : activeCount },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'resolved', label: 'Resolved' },
    { value: '', label: 'All' },
  ]

  const columns = [
    {
      key: 'userId',
      header: 'Person',
      render: (u, row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={u?.name} size="xxs" />
          <div className="leading-tight">
            <p className="text-[13px] font-medium text-gray-900">{u?.name || '-'}</p>
            <p className="text-[11px] text-gray-400">{row.contactPhone || u?.phone || ''} · {row.role}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (loc) => (loc?.lat != null && loc?.lng != null ? (
        <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline">
          <MapPin className="h-3.5 w-3.5" /> Open map
        </a>
      ) : <span className="text-xs text-gray-400">No location</span>),
    },
    { key: 'message', header: 'Note', render: (m) => <span className="text-sm text-gray-600 max-w-[220px] truncate inline-block" title={m || ''}>{m || '-'}</span> },
    { key: 'assignedTo', header: 'Assigned', render: (a) => a?.name ? <span className="text-xs text-gray-600">{a.name}</span> : <span className="text-xs text-gray-300">Unassigned</span> },
    { key: 'createdAt', header: 'Raised', render: (v) => <span className="text-xs text-gray-500">{formatRelative(v)}</span> },
    {
      key: 'priority',
      header: 'Priority',
      render: (v) => {
        const p = v || 'normal'
        const cls = {
          normal: 'bg-blue-100 text-blue-700',
          urgent: 'bg-orange-100 text-orange-700',
          very_urgent: 'bg-red-100 text-red-700',
        }[p]
        const label = { normal: 'Normal', urgent: 'Urgent', very_urgent: 'Very Urgent' }[p]
        return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
      },
    },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: '_id',
      header: 'Actions',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          {row.status === 'active' && (
            <button onClick={(e) => { e.stopPropagation(); update.mutate({ id, status: 'acknowledged' }) }}
              className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600" title="Acknowledge">
              <BellRing className="h-4 w-4" />
            </button>
          )}
          {row.status !== 'resolved' && (
            <button onClick={(e) => { e.stopPropagation(); update.mutate({ id, status: 'resolved' }) }}
              className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600" title="Resolve">
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          {row.status === 'resolved' && <span className="text-xs text-gray-300">-</span>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Emergency Alerts" description="Live SOS alerts from riders and drivers" />

      {activeCount > 0 && (
        <div className="flex items-center gap-2 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">{activeCount} active emergency {activeCount === 1 ? 'alert' : 'alerts'} need attention.</span>
        </div>
      )}

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>
        <DataTable
          columns={columns}
          data={emergencies}
          isLoading={isLoading}
          emptyTitle="No emergency alerts"
          onRowClick={(row) => setSelectedId(row._id)}
        />
        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Emergency Detail" size="lg">
        {selectedId && (
          <EmergencyDetail
            id={selectedId}
            onUpdateStatus={(status) => update.mutate({ id: selectedId, status })}
            statusPending={update.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

function EmergencyDetail({ id, onUpdateStatus, statusPending }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priorityChoice, setPriorityChoice] = useState(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ['emergency', id],
    queryFn: () => emergenciesApi.get(id),
    refetchInterval: 10000,
  })
  const { data: agentsRes } = useQuery({ queryKey: ['support-agents'], queryFn: () => supportApi.agents(), staleTime: 5 * 60 * 1000 })
  const agents = agentsRes?.data || []

  const assign = useMutation({
    mutationFn: (adminId) => emergenciesApi.assign(id, adminId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency', id] })
      qc.invalidateQueries({ queryKey: ['emergencies'] })
      toast.success('Emergency assigned')
    },
    onError: (err) => toast.error(err?.message || 'Failed to assign'),
  })

  const addNote = useMutation({
    mutationFn: (body) => emergenciesApi.addNote(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency', id] })
      setNote('')
      toast.success('Note added')
    },
    onError: (err) => toast.error(err?.message || 'Failed to add note'),
  })

  const setPriority = useMutation({
    mutationFn: (priority) => emergenciesApi.setPriority(id, priority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency', id] })
      qc.invalidateQueries({ queryKey: ['emergencies'] })
      setPriorityChoice(null)
      toast.success('Priority saved')
    },
    onError: (err) => toast.error(err?.message || 'Failed to set priority'),
  })

  if (isLoading) return <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
  const e = res?.data
  if (!e) return <div className="py-10 text-center text-sm text-gray-400">Emergency not found.</div>

  const person = e.userId
  const loc = e.location
  const currentAssignee = e.assignedTo?._id || ''
  const selectedAssignee = assignee || currentAssignee
  const driverInfo = e.driverId

  return (
    <div className="space-y-5">
      {/* Who raised it */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={person?.avatarUrl} name={person?.name} size="lg" />
          <div>
            <h3 className="text-lg font-bold text-gray-900">{person?.name || 'Unknown'}</h3>
            <a href={`tel:${e.contactPhone || person?.phone || ''}`} className="text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {e.contactPhone || person?.phone || '-'}
            </a>
            {person?.email && (
              <a href={`mailto:${person.email}`} className="text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {person.email}
              </a>
            )}
            <div className="flex gap-2 mt-1">
              <StatusBadge status={e.status} />
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{e.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* The SOS note - front and centre */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500 mb-1 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> SOS Message
        </p>
        <p className="text-sm text-red-800">{e.message || 'No message was provided with this alert.'}</p>
      </div>

      {/* Priority - chosen then saved by the handling admin */}
      {(() => {
        const currentPriority = e.priority || 'normal'
        const selectedPriority = priorityChoice ?? currentPriority
        const dirty = selectedPriority !== currentPriority
        return (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Priority</p>
            <div className="flex gap-2">
              {[
                { value: 'normal', label: 'Normal', active: 'bg-blue-600 text-white border-blue-600' },
                { value: 'urgent', label: 'Urgent', active: 'bg-orange-500 text-white border-orange-500' },
                { value: 'very_urgent', label: 'Very Urgent', active: 'bg-red-600 text-white border-red-600' },
              ].map((p) => {
                const isActive = selectedPriority === p.value
                return (
                  <button
                    key={p.value}
                    onClick={() => setPriorityChoice(p.value)}
                    className={`flex-1 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${isActive ? p.active : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                icon={Save}
                disabled={!dirty || setPriority.isPending}
                loading={setPriority.isPending}
                onClick={() => setPriority.mutate(selectedPriority)}
              >
                Save priority
              </Button>
            </div>
          </div>
        )
      })()}

      {/* Location + facts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 col-span-2">
          <p className="text-xs text-gray-400 mb-1">Location</p>
          {loc?.lat != null && loc?.lng != null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">{e.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`}</span>
              <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline shrink-0">
                <Navigation className="h-3.5 w-3.5" /> Open map
              </a>
            </div>
          ) : (
            <span className="text-sm text-gray-400">{e.address || 'No location captured'}</span>
          )}
        </div>
        {driverInfo && (
          <div className="bg-gray-50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1.5"><Car className="h-3 w-3" /> Driver / Vehicle</p>
            <p className="text-sm font-medium text-gray-700 capitalize">
              {driverInfo.vehicleType || '-'}{driverInfo.vehiclePlate ? ` · ${driverInfo.vehiclePlate}` : ''}
              {(driverInfo.vehicleModel || driverInfo.vehicleColor) ? ` · ${[driverInfo.vehicleModel, driverInfo.vehicleColor].filter(Boolean).join(' ')}` : ''}
            </p>
            {driverInfo.userId?.email && <p className="text-xs text-gray-500 mt-0.5">{driverInfo.userId.email}</p>}
          </div>
        )}
        {[
          { label: 'Raised', value: formatDateTime(e.createdAt) },
          { label: 'Acknowledged', value: e.acknowledgedAt ? formatDateTime(e.acknowledgedAt) : '-' },
          { label: 'Resolved', value: e.resolvedAt ? formatDateTime(e.resolvedAt) : '-' },
          { label: 'Handled by', value: e.handledBy?.name || '-' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-700">{value}</p>
          </div>
        ))}
      </div>

      {/* Validity actions - acknowledge if it's real, resolve once handled */}
      <div className="flex flex-wrap gap-2">
        {e.status === 'active' && (
          <Button variant="warning" size="sm" icon={BellRing} loading={statusPending} onClick={() => onUpdateStatus('acknowledged')}>
            Acknowledge (valid)
          </Button>
        )}
        {e.status !== 'resolved' && (
          <Button variant="success" size="sm" icon={CheckCircle} loading={statusPending} onClick={() => onUpdateStatus('resolved')}>
            Resolve
          </Button>
        )}
        {e.status === 'resolved' && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> Resolved {formatRelative(e.resolvedAt)}</span>
        )}
      </div>

      {/* Assignment */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Assign to admin</p>
        <div className="flex items-center gap-2">
          <select
            value={selectedAssignee}
            onChange={(ev) => setAssignee(ev.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
          >
            <option value="">Unassigned - pick an agent</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>{a.name}{a.role ? ` (${a.role})` : ''}</option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedAssignee || selectedAssignee === currentAssignee}
            loading={assign.isPending}
            onClick={() => assign.mutate(selectedAssignee)}
          >
            Assign
          </Button>
        </div>
        {e.assignedTo?.name && (
          <p className="text-xs text-gray-400 mt-1.5">Currently assigned to <span className="font-medium text-gray-700">{e.assignedTo.name}</span></p>
        )}
      </div>

      {/* Internal notes */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> Internal notes
        </p>
        <div className="space-y-2 mb-3">
          {(e.notes || []).length === 0 && <p className="text-xs text-gray-400">No notes yet.</p>}
          {(e.notes || []).map((n, i) => (
            <div key={n._id || i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-amber-800">{n.authorId?.name || 'Admin'}</span>
                <span className="text-[10px] text-amber-600">{formatRelative(n.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          rows={2}
          placeholder="Add an internal note about how this alert was handled…"
          className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          onKeyDown={(ev) => { if (ev.key === 'Enter' && ev.ctrlKey && note.trim()) addNote.mutate(note.trim()) }}
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" variant="secondary" disabled={!note.trim() || addNote.isPending} loading={addNote.isPending} onClick={() => addNote.mutate(note.trim())}>
            Add note
          </Button>
        </div>
      </div>
    </div>
  )
}
