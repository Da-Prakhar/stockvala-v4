import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'

const FundPage = () => {
  const navigate = useNavigate()
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [walletBalance, setWalletBalance] = useState(null)

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet/balance')
      const b = res.data?.data?.balance ?? res.data?.balance ?? 0
      setWalletBalance(parseFloat(b))
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchWallet()
    const fetchTransactions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [depositsRes, withdrawalsRes] = await Promise.all([
          api.get('/funds/deposits'),
          api.get('/funds/withdrawals')
        ])
        const depsData = depositsRes.data?.data
        const withsData = withdrawalsRes.data?.data
        const deps = depsData?.deposits || (Array.isArray(depsData) ? depsData : [])
        const withs = withsData?.withdrawals || (Array.isArray(withsData) ? withsData : [])
        setDeposits(deps)
        setWithdrawals(withs)
      } catch (err) {
        console.error('Fetch transactions error:', err.message)
        setError(err.response?.data?.message || err.message || 'Failed to fetch transactions')
      } finally {
        setIsLoading(false)
      }
    }
    fetchTransactions()
  }, [fetchWallet])

  const allTransactions = [
    ...deposits.map(d => ({
      id: d.id,
      type: 'deposit',
      amount: parseFloat(d.amount || 0),
      method: d.paymentMethod?.name || d.PaymentMethod?.name || '-',
      status: d.status || 'pending',
      date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-',
      reference: d.transactionRef || d.transaction_ref || `DEP-${d.id}`,
    })),
    ...withdrawals.map(w => ({
      id: w.id,
      type: 'withdrawal',
      amount: parseFloat(w.amount || 0),
      method: w.paymentMethod?.name || w.PaymentMethod?.name || '-',
      status: w.status || 'pending',
      date: w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '-',
      reference: `WTH-${w.id}`,
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (value) => (
        <div className="flex items-center gap-2">
          {value === 'deposit' ? (
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-red-600" />
          )}
          <span className="capitalize font-medium">
            {value === 'deposit' ? 'Deposit' : 'Withdrawal'}
          </span>
        </div>
      ),
    },
    { key: 'amount', label: 'Amount', render: (v) => `$${Number(v).toFixed(2)}` },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} label={v} /> },
    { key: 'date', label: 'Date' },
    { key: 'reference', label: 'Reference' },
  ]

  const depositTransactions = allTransactions.filter((t) => t.type === 'deposit')
  const withdrawalTransactions = allTransactions.filter((t) => t.type === 'withdrawal')

  const tabs = [
    {
      label: 'All Transactions',
      content: <DataTable columns={columns} data={allTransactions} sortable paginated itemsPerPage={10} />,
    },
    {
      label: 'Deposits',
      content: <DataTable columns={columns} data={depositTransactions} sortable paginated />,
    },
    {
      label: 'Withdrawals',
      content: <DataTable columns={columns} data={withdrawalTransactions} sortable paginated />,
    },
  ]

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Fund Management</h2>
        <p className="text-slate-600 dark:text-slate-400">Manage deposits, withdrawals and wallet balance</p>
      </div>

      {/* Wallet Balance Banner */}
      <motion.div variants={itemVariants}>
        <Card variant="elevated" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">Wallet Balance</p>
                <p className="text-3xl font-bold">
                  {walletBalance !== null ? `$${walletBalance.toFixed(2)}` : '—'}
                </p>
              </div>
              <Wallet className="w-10 h-10 text-white/30" />
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Quick Actions — MT5 Deposit / Withdraw */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <motion.div variants={itemVariants}>
          <Card variant="elevated" hoverable onClick={() => navigate('/fund/deposit')} className="cursor-pointer">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <ArrowDownLeft className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Deposit Funds</h3>
              <Button variant="secondary" size="sm" className="w-full">Deposit</Button>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card variant="elevated" hoverable onClick={() => navigate('/fund/withdraw')} className="cursor-pointer">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <ArrowUpRight className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Withdraw Funds</h3>
              <Button variant="secondary" size="sm" className="w-full">Withdraw</Button>
            </CardBody>
          </Card>
        </motion.div>
      </motion.div>

      {/* Transaction History */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Card variant="elevated">
          <CardBody>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Transaction History</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader /></div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">{error}</div>
            ) : (
              <Tabs tabs={tabs} />
            )}
          </CardBody>
        </Card>
      </motion.div>

    </motion.div>
  )
}

export default FundPage
