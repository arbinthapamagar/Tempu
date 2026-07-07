import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, DollarSign, TrendingUp, Clock, AlertCircle } from '@/components/ui/icons'
import { DataTable } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageHeader } from '../../components/shared/PageHeader'
import { FilterBar } from '../../components/shared/FilterBar'
import { StatsCard } from '../../components/shared/StatsCard'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { transactionsApi } from '../../api/transactions.api'
import { formatDate, formatCurrency, formatDateTime } from '../../utils/format'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = [
  { value: 'trip_payment', label: 'Trip Payment' },
  { value: 'trip_earning', label: 'Trip Earning' },
  { value: 'subscription_payment', label: 'Subscription' },
  { value: 'wallet_topup', label: 'Wallet Top-up' },
  { value: 'wallet_withdrawal', label: 'Withdrawal' },
  { value: 'platform_fee', label: 'Platform Fee' },
  { value: 'refund', label: 'Refund' },
]

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'esewa', label: 'eSewa' },
  { value: 'wallet', label: 'Wallet' },
]

export default function TransactionList() {
  const [page, setPage] = useState(1)
  const [statusTab, setStatusTab] = useState('')
  const [type, setType] = useState('')
  const [method, setMethod] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, statusTab, type, method],
    queryFn: () =>
      transactionsApi.list({
        page, limit: 20,
        status: statusTab || undefined,
        type: type || undefined,
        method: method || undefined,
      }),
    keepPreviousData: true,
  })

  const { data: summaryRes } = useQuery({
    queryKey: ['transaction-summary'],
    queryFn: transactionsApi.summary,
    retry: false,
  })

  const txns = data?.data?.transactions || data?.data || []
  const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: 20 }
  const summary = summaryRes?.data || {}

  const tabs = [
    { value: '', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ]

  const handleExport = async () => {
    try {
      const blob = await transactionsApi.export({ status: statusTab, type, method })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const columns = [
    {
      key: '_id',
      header: 'Transaction ID',
      render: (val) => <span className="text-xs font-mono text-gray-400">{val?.slice(-10).toUpperCase()}</span>,
    },
    {
      key: 'userId',
      header: 'User',
      render: (val, row) => (
        <div>
          <p className="text-sm font-medium text-gray-800">{val?.name || row.driverId?.userId?.name || '-'}</p>
          <p className="text-xs text-gray-400">{val ? 'Rider' : 'Driver'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (val) => (
        <span className="text-xs capitalize bg-gray-100 px-2 py-1 rounded-full">
          {val?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (val, row) => (
        <span className={`font-semibold text-sm ${['trip_payment', 'subscription_payment'].includes(row.type) ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'gatewayRef',
      header: 'Gateway Ref',
      render: (val) => val ? <span className="text-xs font-mono text-gray-400">{val}</span> : '-',
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (val) => (
        <div>
          <p className="text-sm">{formatDate(val, 'MMM dd, yyyy')}</p>
          <p className="text-xs text-gray-400">{formatDate(val, 'hh:mm a')}</p>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Monitor all financial transactions on the platform"
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatsCard title="Total Revenue" value={formatCurrency(summary.totalRevenue || 0)} icon={DollarSign} color="indigo" />
        <StatsCard title="Platform Fees" value={formatCurrency(summary.platformFees || 0)} icon={TrendingUp} color="emerald" />
        <StatsCard title="Pending" value={formatCurrency(summary.pending || 0)} icon={Clock} color="amber" />
        <StatsCard title="Failed" value={formatCurrency(summary.failed || 0)} icon={AlertCircle} color="red" />
      </div>

      <div className="bg-white border border-gray-200">
        <div className="px-5 pt-4">
          <Tabs tabs={tabs} active={statusTab} onChange={(v) => { setStatusTab(v); setPage(1) }} />
        </div>
        <div className="px-5 py-4 border-b border-gray-50">
          <FilterBar
            filters={[
              {
                placeholder: 'All Types',
                value: type,
                onChange: (v) => { setType(v); setPage(1) },
                options: TYPE_OPTIONS,
              },
              {
                placeholder: 'All Methods',
                value: method,
                onChange: (v) => { setMethod(v); setPage(1) },
                options: METHOD_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable columns={columns} data={txns} isLoading={isLoading} emptyTitle="No transactions found" />

        {pagination.total > 0 && (
          <Pagination page={page} totalPages={pagination.pages} total={pagination.total} limit={20} onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
