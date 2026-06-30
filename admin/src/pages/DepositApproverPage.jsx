import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowDownLeft,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Loader } from '../components/ui/Loader'
import { formatCurrency, formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { API_URL } from '../utils/domainConfig'

const apiBase = API_URL.replace(/\/api\/?$/, '')

function getProofUrl(v) {
  if (!v) return null
  if (v.startsWith('http')) return v
  const uploadsIdx = v.indexOf('uploads/')
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : v.replace(/^\//, '')
  return `${apiBase}/${relativePath}`
}

export default function DepositApproverPage() {
  const [deposits, setDeposits] = useState([])
  const [proofModal, setProofModal] = useState({ isOpen: false, image: null })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, depositId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDeposits()
  }, [])

  const fetchDeposits = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setPageLoading(true)
      const response = await api.get('/admin/deposits?limit=100')
      setDeposits(response.data.data || [])
    } catch (err) {
      console.error('Error fetching deposits:', err)
      toast.error('Failed to load deposits')
    } finally {
      setPageLoading(false)
      setRefreshing(false)
    }
  }

  const pending = deposits.filter(d => d.status === 'pending')
  const approved = deposits.filter(d => d.status === 'approved')
  const rejected = deposits.filter(d => d.status === 'rejected')

  // Stats
  const totalAmount = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const approvedAmount = approved.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const pendingAmount = pending.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)

  const handleApprove = async (depositId) => {
    setLoading(true)
    try {
      await api.put(`/admin/deposits/${depositId}/approve`)
      setDeposits(prev => prev.map(d => d.id === depositId ? { ...d, status: 'approved' } : d))
      toast.success('Deposit approved! MT5 account credited.')
    } catch (err) {
      console.error('Error approving deposit:', err)
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to approve deposit'
      toast.error(msg)
    } finally {
      setConfirmModal({ isOpen: false, action: null, depositId: null })
      setLoading(false)
    }
  }

  const handleReject = async (depositId) => {
    setLoading(true)
    try {
      await api.put(`/admin/deposits/${depositId}/reject`, { reason: rejectReason })
      setDeposits(prev => prev.map(d => d.id === depositId ? { ...d, status: 'rejected' } : d))
      toast.success('Deposit rejected.')
    } catch (err) {
      console.error('Error rejecting deposit:', err)
      toast.error('Failed to reject deposit')
    } finally {
      setConfirmModal({ isOpen: false, action: null, depositId: null })
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
      render: (v) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(v, 'USD')}</span>,
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
      key: 'transactionRef',
      label: 'Txn Ref',
      sortable: true,
      render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-dark-400">—</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (v) => v ? <span className="text-xs text-dark-500 dark:text-dark-400">{formatDate(v)}</span> : '—',
    },
    {
      key: 'proofImageUrl',
      label: 'Proof',
      render: (v) => {
        if (!v) return <span className="text-dark-400 text-xs">No proof</span>
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setProofModal({ isOpen: true, image: getProofUrl(v) })
            }}
            className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors text-xs font-medium"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            View
          </button>
        )
      },
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
                  setConfirmModal({ isOpen: true, action: 'approve', depositId: row.id })
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
                  setConfirmModal({ isOpen: true, action: 'reject', depositId: row.id })
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
              <p className="text-sm text-dark-400 mt-1">No pending deposits to review</p>
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
            <div className="py-16 text-center text-dark-400 text-sm">No approved deposits</div>
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
            <div className="py-16 text-center text-dark-400 text-sm">No rejected deposits</div>
          )}
        </Card>
      ),
    },
    {
      label: `All (${deposits.length})`,
      content: (
        <Card noPadding>
          {deposits.length > 0 ? (
            <DataTable columns={columns} data={deposits} pageSize={15} />
          ) : (
            <div className="py-16 text-center text-dark-400 text-sm">No deposits yet</div>
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
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Deposit Approvals</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Review and approve client deposits</p>
        </div>
        <Button
          icon={RefreshCw}
          variant="secondary"
          onClick={() => fetchDeposits(true)}
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
            <p className="text-xs text-dark-500 dark:text-dark-400 font-medium">Total Deposits</p>
          </div>
          <p className="text-xl font-bold text-dark-900 dark:text-dark-50">{formatCurrency(totalAmount, 'USD')}</p>
          <p className="text-xs text-dark-400 mt-1">{deposits.length} transactions</p>
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
          <p className="text-xs text-dark-400 mt-1">{deposits.length > 0 ? `${((rejected.length / deposits.length) * 100).toFixed(0)}% rejection rate` : '—'}</p>
        </div>
      </div>

      {/* Tabs with tables */}
      <Tabs tabs={tabs} />

      {/* Proof Modal */}
      <Modal
        isOpen={proofModal.isOpen}
        onClose={() => setProofModal({ isOpen: false, image: null })}
        title="Deposit Proof"
        size="lg"
      >
        <div className="bg-dark-100 dark:bg-dark-700 rounded-lg p-4 flex items-center justify-center min-h-96">
          {proofModal.image ? (
            <img
              src={proofModal.image}
              alt="Deposit proof"
              className="max-w-full max-h-[500px] rounded-lg object-contain"
              onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<p class="text-dark-400 text-center">Failed to load proof image</p>'; }}
            />
          ) : (
            <div className="text-center">
              <ImageIcon className="w-16 h-16 text-dark-400 mx-auto mb-2" />
              <p className="text-dark-400">No proof image available</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => { setConfirmModal({ isOpen: false, action: null, depositId: null }); setRejectReason(''); }}
        title={confirmModal.action === 'approve' ? 'Approve Deposit' : 'Reject Deposit'}
        message={
          confirmModal.action === 'approve'
            ? 'This will credit the client\'s MT5 account with the deposit amount. Continue?'
            : (
              <div className="space-y-3">
                <p>Are you sure you want to reject this deposit? This cannot be undone.</p>
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
        confirmText={confirmModal.action === 'approve' ? 'Approve & Credit MT5' : 'Reject'}
        variant={confirmModal.action === 'approve' ? 'success' : 'danger'}
        loading={loading}
        onConfirm={() =>
          confirmModal.action === 'approve'
            ? handleApprove(confirmModal.depositId)
            : handleReject(confirmModal.depositId)
        }
      />
    </motion.div>
  )
}
