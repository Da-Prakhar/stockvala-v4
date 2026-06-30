import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  X,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Copy,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Loader } from '../components/ui/Loader'
import { formatCurrency, formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function WithdrawalApproverPage() {
  const [withdrawals, setWithdrawals] = useState([])
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, withdrawalId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  const fetchWithdrawals = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setPageLoading(true)
      const response = await api.get('/admin/withdrawals?limit=100')
      setWithdrawals(response.data.data || [])
    } catch (err) {
      console.error('Error fetching withdrawals:', err)
      toast.error('Failed to load withdrawals')
    } finally {
      setPageLoading(false)
      setRefreshing(false)
    }
  }

  const pending = withdrawals.filter(w => w.status === 'pending')
  const approved = withdrawals.filter(w => w.status === 'approved')
  const rejected = withdrawals.filter(w => w.status === 'rejected')

  // Stats
  const totalAmount = withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)
  const approvedAmount = approved.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)
  const pendingAmount = pending.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)

  const handleApprove = async (withdrawalId) => {
    setLoading(true)
    try {
      await api.put(`/admin/withdrawals/${withdrawalId}/approve`)
      setWithdrawals(prev => prev.map(w => w.id === withdrawalId ? { ...w, status: 'approved' } : w))
      toast.success('Withdrawal approved! MT5 account debited.')
    } catch (err) {
      console.error('Error approving withdrawal:', err)
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to approve withdrawal'
      toast.error(msg)
    } finally {
      setConfirmModal({ isOpen: false, action: null, withdrawalId: null })
      setLoading(false)
    }
  }

  const handleReject = async (withdrawalId) => {
    setLoading(true)
    try {
      await api.put(`/admin/withdrawals/${withdrawalId}/reject`, { reason: rejectReason })
      setWithdrawals(prev => prev.map(w => w.id === withdrawalId ? { ...w, status: 'rejected' } : w))
      toast.success('Withdrawal rejected.')
    } catch (err) {
      console.error('Error rejecting withdrawal:', err)
      toast.error('Failed to reject withdrawal')
    } finally {
      setConfirmModal({ isOpen: false, action: null, withdrawalId: null })
      setRejectReason('')
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (v) => <span className="font-mono text-xs text-dark-500 dark:text-dark-400">#{v}</span>,
    },
    {
      key: 'user',
      label: 'Client',
      sortable: true,
      render: (_, row) => {
        const u = row.user
        return u ? (
          <div>
            <p className="font-semibold text-dark-900 dark:text-dark-50 text-sm">{u.firstName || ''} {u.lastName || ''}</p>
            <p className="text-xs text-dark-400">{u.email || ''}</p>
          </div>
        ) : <span className="text-dark-400">—</span>
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (v) => <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(v, 'USD')}</span>,
    },
    {
      key: 'account',
      label: 'MT5 Account',
      render: (_, row) => row.account?.mt5Login ? (
        <span className="inline-block px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded font-mono text-xs font-semibold">
          {row.account.mt5Login}
        </span>
      ) : <span className="text-dark-400 text-xs">—</span>,
    },
    {
      key: 'withdrawalDetails',
      label: 'Withdraw To',
      render: (_, row) => {
        const d = typeof row.withdrawalDetails === 'string'
          ? JSON.parse(row.withdrawalDetails || '{}')
          : (row.withdrawalDetails || {})
        if (d.upiId) return (
          <div>
            <p className="text-xs text-dark-400">UPI</p>
            <p className="text-xs font-mono font-semibold text-dark-900 dark:text-dark-50">{d.upiId}</p>
          </div>
        )
        if (d.walletAddress) return (
          <div>
            <p className="text-xs text-dark-400">{d.network || 'Crypto'}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs font-mono font-semibold text-dark-900 dark:text-dark-50 truncate max-w-[100px]" title={d.walletAddress}>{d.walletAddress}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(d.walletAddress); toast.success('Address copied!') }}
                className="p-0.5 text-dark-400 hover:text-primary-500 flex-shrink-0"
                title="Copy wallet address"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
        if (d.bankAccountNumber || d.bankName || d.iban) return (
          <div>
            <p className="text-xs text-dark-400">{d.bankName || 'Bank'}</p>
            <p className="text-xs font-mono font-semibold text-dark-900 dark:text-dark-50">{d.bankAccountNumber || d.iban || '—'}</p>
            {d.iban && d.bankAccountNumber && <p className="text-xs text-dark-400">IBAN: {d.iban}</p>}
            {d.accountHolderName && <p className="text-xs text-dark-400">{d.accountHolderName}</p>}
          </div>
        )
        if (d.contactNumber) return (
          <div>
            <p className="text-xs text-dark-400">Angadiya</p>
            <p className="text-xs font-mono font-semibold text-dark-900 dark:text-dark-50">{d.contactNumber}</p>
          </div>
        )
        return <span className="text-dark-400 text-xs">—</span>
      },
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (v) => v ? <span className="text-xs text-dark-500 dark:text-dark-400">{formatDate(v)}</span> : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => v ? <StatusBadge status={v}>{v.toUpperCase()}</StatusBadge> : '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          {row.status === 'pending' ? (
            <>
              <Button
                size="sm"
                variant="success"
                icon={Check}
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmModal({ isOpen: true, action: 'approve', withdrawalId: row.id })
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={X}
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmModal({ isOpen: true, action: 'reject', withdrawalId: row.id })
                }}
              >
                Reject
              </Button>
            </>
          ) : (
            <span className="text-xs text-dark-400">—</span>
          )}
        </div>
      ),
    },
  ]

  const tabs = [
    {
      label: `Pending (${pending.length})`,
      content: (
        <Card noPadding>
          {pending.length > 0 ? (
            <DataTable columns={columns} data={pending} pageSize={10} />
          ) : (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-dark-500 dark:text-dark-400 font-medium">All caught up!</p>
              <p className="text-sm text-dark-400 mt-1">No pending withdrawals to review</p>
            </div>
          )}
        </Card>
      ),
    },
    {
      label: `Approved (${approved.length})`,
      content: (
        <Card noPadding>
          {approved.length > 0 ? (
            <DataTable columns={columns} data={approved} pageSize={10} />
          ) : (
            <div className="py-16 text-center text-dark-400 text-sm">No approved withdrawals</div>
          )}
        </Card>
      ),
    },
    {
      label: `Rejected (${rejected.length})`,
      content: (
        <Card noPadding>
          {rejected.length > 0 ? (
            <DataTable columns={columns} data={rejected} pageSize={10} />
          ) : (
            <div className="py-16 text-center text-dark-400 text-sm">No rejected withdrawals</div>
          )}
        </Card>
      ),
    },
    {
      label: `All (${withdrawals.length})`,
      content: (
        <Card noPadding>
          {withdrawals.length > 0 ? (
            <DataTable columns={columns} data={withdrawals} pageSize={15} />
          ) : (
            <div className="py-16 text-center text-dark-400 text-sm">No withdrawals yet</div>
          )}
        </Card>
      ),
    },
  ]

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Withdrawal Approvals</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Review and approve client withdrawals</p>
        </div>
        <Button
          icon={RefreshCw}
          variant="secondary"
          onClick={() => fetchWithdrawals(true)}
          isLoading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <p className="text-xs text-dark-500 dark:text-dark-400 font-medium">Total Withdrawals</p>
          </div>
          <p className="text-xl font-bold text-dark-900 dark:text-dark-50">{formatCurrency(totalAmount, 'USD')}</p>
          <p className="text-xs text-dark-400 mt-1">{withdrawals.length} transactions</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs text-dark-500 dark:text-dark-400 font-medium">Pending</p>
          </div>
          <p className="text-xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-dark-400 mt-1">{formatCurrency(pendingAmount, 'USD')}</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-dark-500 dark:text-dark-400 font-medium">Approved</p>
          </div>
          <p className="text-xl font-bold text-green-600">{approved.length}</p>
          <p className="text-xs text-dark-400 mt-1">{formatCurrency(approvedAmount, 'USD')}</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-xs text-dark-500 dark:text-dark-400 font-medium">Rejected</p>
          </div>
          <p className="text-xl font-bold text-red-600">{rejected.length}</p>
          <p className="text-xs text-dark-400 mt-1">{withdrawals.length > 0 ? `${((rejected.length / withdrawals.length) * 100).toFixed(0)}% rejection rate` : '—'}</p>
        </div>
      </div>

      {/* Tabs with tables */}
      <Tabs tabs={tabs} />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => { setConfirmModal({ isOpen: false, action: null, withdrawalId: null }); setRejectReason(''); }}
        title={confirmModal.action === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
        message={
          confirmModal.action === 'approve'
            ? 'This will debit the client\'s MT5 account with the withdrawal amount. Continue?'
            : (
              <div className="space-y-3">
                <p>Are you sure you want to reject this withdrawal? This cannot be undone.</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
                  rows="3"
                />
              </div>
            )
        }
        confirmText={confirmModal.action === 'approve' ? 'Approve & Debit MT5' : 'Reject'}
        variant={confirmModal.action === 'approve' ? 'success' : 'danger'}
        loading={loading}
        onConfirm={() =>
          confirmModal.action === 'approve'
            ? handleApprove(confirmModal.withdrawalId)
            : handleReject(confirmModal.withdrawalId)
        }
      />
    </motion.div>
  )
}
