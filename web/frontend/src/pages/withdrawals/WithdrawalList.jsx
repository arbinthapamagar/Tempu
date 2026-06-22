import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, BadgeCheck, Landmark, Wallet } from '@/components/ui/icons'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { Avatar } from '../../components/ui/Avatar'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { withdrawalsApi } from '../../api/withdrawals.api'
import { formatCurrency, formatDate } from '../../utils/format'
import toast from 'react-hot-toast'

const METHOD_LABELS = { bank: 'Bank Transfer', khalti: 'Khalti', esewa: 'eSewa' }

const ACTION_META = {
  approve: { label: 'Approve', title: 'Approve Withdrawal', variant: 'success', verb: 'approve' },
  paid: { label: 'Mark Paid', title: 'Mark Withdrawal Paid', variant: 'success', verb: 'mark as paid' },
  reject: { label: 'Reject', title: 'Reject Withdrawal', variant: 'danger', verb: 'reject' },
}

function destinationText(w) {
  if (w.method === 'bank') {
    const d = w.destination || {}
    return [d.bankName, d.accountName, d.accountNumber].filter(Boolean).join(' · ')
  }
  return w.destination?.walletId || '—'
}

export default function WithdrawalList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusTab, setStatusTab] = useState('pending')
  const [action, setAction] = useState(null) // { type, withdrawal }
  const [note, setNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['withdrawals', page, statusTab],
    queryFn: () => withdrawalsApi.list({ page, limit: 20, status: statusTab || undefined }),
    keepPreviousData: true,
  })

  const process = useMutation({
    mutationFn: ({ id, body }) => withdrawalsApi.process(id, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['withdrawals'] })
      toast.success(res?.message || 'Withdrawal updated')
      setAction(null)
      setNote('')
    },
    onError: (err) => toast.error(err?.message || 'Failed'),
  })

  const withdrawals = data?.data?.withdrawals || data?.data || []
  const pagination = data?.pagination || data?.data?.pagination || { total: 0, pages: 1 }

  const tabs = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'paid', label: 'Paid' },
    { value: 'rejected', label: 'Rejected' },
    { value: '', label: 'All' },
  ]

  const columns = [
    {
      key: 'driverId',
      header: 'Driver',
      render: (driver) => (
        <div className="flex items-center gap-3">
          <Avatar name={driver?.userId?.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{driver?.userId?.name || '—'}</p>
            <p className="text-xs text-gray-400">{driver?.userId?.phone || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (val) => <span className="text-sm font-semibold text-gray-900">{formatCurrency(val)}</span>,
    },
    {
      key: 'method',
      header: 'Destination',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          {val === 'bank' ? <Landmark className="h-4 w-4 text-gray-400" /> : <Wallet className="h-4 w-4 text-gray-400" />}
          <div>
            <p className="text-sm text-gray-700">{METHOD_LABELS[val] || val}</p>
            <p className="text-xs text-gray-400 max-w-[220px] truncate" title={destinationText(row)}>{destinationText(row)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested',
      render: (val) => <span className="text-xs text-gray-500">{formatDate(val)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val, row) => (
        <div>
          <StatusBadge status={val} />
          {row.adminNote && <p className="text-xs text-gray-400 mt-1 max-w-[200px] truncate" title={row.adminNote}>{row.adminNote}</p>}
        </div>
      ),
    },
    {
      key: '_id',
      header: 'Actions',
      render: (_id, row) => {
        const open = (type) => (e) => { e.stopPropagation(); setAction({ type, withdrawal: row }); setNote('') }
        return (
          <div className="flex items-center gap-1">
            {row.status === 'pending' && (
              <button onClick={open('approve')} className="p-1.5 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600" title="Approve">
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            {(row.status === 'pending' || row.status === 'approved') && (
              <>
                <button onClick={open('paid')} className="p-1.5 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-600" title="Mark paid">
                  <BadgeCheck className="h-4 w-4" />
                </button>
                <button onClick={open('reject')} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600" title="Reject">
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
            {(row.status === 'paid' || row.status === 'rejected') && (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
        )
      },
    },
  ]

  const meta = action ? ACTION_META[action.type] : null

  return (
    <div>
      <PageHeader title="Withdrawals" description="Review and settle driver cashout requests" />

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>

        <DataTable columns={columns} data={withdrawals} isLoading={isLoading} emptyTitle="No withdrawal requests" />

        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>

      {/* Process modal */}
      <Modal open={!!action} onClose={() => setAction(null)} title={meta?.title || ''} size="sm">
        {action && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {meta.title.split(' ')[0]} the {formatCurrency(action.withdrawal.amount)} request from{' '}
              <strong>{action.withdrawal.driverId?.userId?.name || 'this driver'}</strong>?
            </p>
            {action.type === 'reject' && (
              <p className="text-xs text-amber-600">The amount will be refunded to the driver's wallet.</p>
            )}
            <Textarea
              label={action.type === 'reject' ? 'Reason' : 'Note / reference (optional)'}
              placeholder={action.type === 'reject' ? 'Why is this rejected?' : 'e.g. bank transfer ref #'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setAction(null)}>Cancel</Button>
              <Button
                variant={meta.variant}
                className="flex-1"
                loading={process.isPending}
                onClick={() => process.mutate({ id: action.withdrawal._id, body: { action: action.type, adminNote: note.trim() || undefined } })}
              >
                {meta.label}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
