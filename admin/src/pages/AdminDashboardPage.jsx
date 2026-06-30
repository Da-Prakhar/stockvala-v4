import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  TrendingUp,
  DollarSign,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { VolumeChart } from '../components/dashboard/VolumeChart'
import { DepositWithdrawalChart } from '../components/dashboard/DepositWithdrawalChart'
import { AccountTypesPie } from '../components/dashboard/AccountTypesPie'
import { CountriesChart } from '../components/dashboard/CountriesChart'
import { formatCurrency } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

const depositColumns = [
  {
    key: 'id',
    label: 'ID',
    sortable: true,
    render: (value) => <span className="text-dark-400 font-mono text-xs">#{value}</span>,
  },
  {
    key: 'client',
    label: 'Client',
    sortable: true,
    render: (_, row) => (
      <div>
        <p className="text-dark-800 dark:text-dark-100 font-medium text-sm">
          {row.user?.firstName || ''} {row.user?.lastName || ''}
        </p>
        <p className="text-dark-400 dark:text-dark-500 text-xs">{row.user?.email || ''}</p>
      </div>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (value) => (
      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
        {formatCurrency(value, 'USD')}
      </span>
    ),
  },
  {
    key: 'mt5Login',
    label: 'Account',
    render: (_, row) => (
      <span className="text-dark-500 dark:text-dark-400 font-mono text-xs">
        {row.account?.mt5Login || '—'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value}>{(value || '').toUpperCase()}</StatusBadge>,
  },
]

const withdrawalColumns = [
  {
    key: 'id',
    label: 'ID',
    sortable: true,
    render: (value) => <span className="text-dark-400 font-mono text-xs">#{value}</span>,
  },
  {
    key: 'client',
    label: 'Client',
    sortable: true,
    render: (_, row) => (
      <div>
        <p className="text-dark-800 dark:text-dark-100 font-medium text-sm">
          {row.user?.firstName || ''} {row.user?.lastName || ''}
        </p>
        <p className="text-dark-400 dark:text-dark-500 text-xs">{row.user?.email || ''}</p>
      </div>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (value) => (
      <span className="text-amber-600 dark:text-amber-400 font-semibold">
        {formatCurrency(value, 'USD')}
      </span>
    ),
  },
  {
    key: 'mt5Login',
    label: 'Account',
    render: (_, row) => (
      <span className="text-dark-500 dark:text-dark-400 font-mono text-xs">
        {row.account?.mt5Login || '—'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value}>{(value || '').toUpperCase()}</StatusBadge>,
  },
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [charts, setCharts] = useState(null)
  const [recentDeposits, setRecentDeposits] = useState([])
  const [recentWithdrawals, setRecentWithdrawals] = useState([])
  const [liveMT5Balance, setLiveMT5Balance] = useState(null) // { totalBalance, totalEquity, count }
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Fetch live MT5 balances for all accounts
  const fetchLiveMT5Totals = useCallback(async () => {
    try {
      // Get all MT5 accounts from clients endpoint
      const clientsRes = await api.get('/admin/clients?limit=500')
      const clients = clientsRes.data?.data || []
      const allLogins = []
      clients.forEach(c => {
        (c.mt5Logins || []).forEach(login => allLogins.push(login))
      })

      if (!allLogins.length) {
        setLiveMT5Balance({ totalBalance: 0, totalEquity: 0, count: 0 })
        return
      }

      let totalBalance = 0
      let totalEquity = 0
      let count = 0

      // Fetch in parallel batches
      const batchSize = 10
      for (let i = 0; i < allLogins.length; i += batchSize) {
        const batch = allLogins.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(login =>
            api.get(`/admin/mt5/accounts/${login}`).then(r => r.data?.data || r.data)
          )
        )
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value) {
            totalBalance += parseFloat(r.value.balance) || 0
            totalEquity += parseFloat(r.value.equity) || 0
            count++
          }
        })
      }

      setLiveMT5Balance({ totalBalance, totalEquity, count })
    } catch (err) {
      console.error('Error fetching live MT5 totals:', err)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [statsRes, chartsRes, depositsRes, withdrawalsRes] = await Promise.all([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/dashboard/charts').catch(() => ({ data: { data: null } })),
        api.get('/admin/deposits?limit=5'),
        api.get('/admin/withdrawals?limit=5'),
      ])

      setStats(statsRes.data?.data)
      setCharts(chartsRes.data?.data)
      setRecentDeposits(depositsRes.data?.data || [])
      setRecentWithdrawals(withdrawalsRes.data?.data || [])
      setError(null)

      // Fetch live MT5 balances after stats
      fetchLiveMT5Totals()
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
      if (!isRefresh) toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-300">
        <p className="font-medium mb-2">Failed to load dashboard</p>
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          onClick={() => fetchDashboardData()}
          className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  // Build chart data from API response
  const volumeData = charts?.depositTrend?.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    volume: d.amount || 0,
  })) || []

  const depWithData = charts?.depositTrend?.map((d, i) => {
    const w = charts?.withdrawalTrend?.[i]
    return {
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      deposits: d.amount || 0,
      withdrawals: w?.amount || 0,
    }
  }) || []

  const accountTypeData = stats?.totalAccounts
    ? [{ name: 'Standard', value: stats.totalAccounts }]
    : []

  const countriesData = []

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-50">Dashboard</h1>
          <p className="text-dark-500 dark:text-dark-400 text-sm mt-1">
            Platform overview and recent activity
          </p>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-700 hover:bg-dark-50 dark:hover:bg-dark-600 border border-dark-200 dark:border-dark-600 rounded-lg text-dark-600 dark:text-dark-300 text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Primary Stats */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Clients"
          value={stats?.totalUsers?.toLocaleString() || '0'}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="MT5 Accounts"
          value={stats?.totalAccounts?.toLocaleString() || '0'}
          icon={Eye}
          color="success"
        />
        <StatCard
          title="MT5 Total Balance (Live)"
          value={liveMT5Balance ? formatCurrency(liveMT5Balance.totalBalance, 'USD') : '...'}
          icon={Wallet}
          color="info"
        />
        <StatCard
          title="MT5 Total Equity (Live)"
          value={liveMT5Balance ? formatCurrency(liveMT5Balance.totalEquity, 'USD') : '...'}
          icon={DollarSign}
          color="warning"
        />
      </motion.div>

      {/* Financial & Pending Items */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        <StatCard
          title="Total Deposits"
          value={formatCurrency(stats?.totalDeposits || 0, 'USD')}
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Total Withdrawals"
          value={formatCurrency(stats?.totalWithdrawals || 0, 'USD')}
          icon={ArrowUpRight}
          color="danger"
        />
        <StatCard
          title="Pending Deposits"
          value={stats?.pendingDeposits?.toString() || '0'}
          icon={ArrowDownLeft}
          color="info"
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats?.pendingWithdrawals?.toString() || '0'}
          icon={ArrowUpRight}
          color="warning"
        />
        <StatCard
          title="Pending KYC"
          value={stats?.pendingKYC?.toString() || '0'}
          icon={Clock}
          color="danger"
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100 mb-4">
            Deposit Volume (Last 30 Days)
          </h3>
          <VolumeChart data={volumeData} />
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100 mb-4">
            Deposits vs Withdrawals
          </h3>
          <DepositWithdrawalChart data={depWithData} />
        </Card>
      </motion.div>

      {/* Pie Charts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100 mb-4">
            Account Distribution
          </h3>
          <AccountTypesPie data={accountTypeData} />
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100 mb-4">
            Client Countries
          </h3>
          <CountriesChart data={countriesData} />
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card noPadding>
          <div className="px-6 pt-5 pb-3 border-b border-dark-200 dark:border-dark-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100">Recent Deposits</h3>
              <span className="text-xs text-dark-400 dark:text-dark-500">{recentDeposits.length} latest</span>
            </div>
          </div>
          {recentDeposits.length > 0 ? (
            <DataTable columns={depositColumns} data={recentDeposits} pageSize={5} />
          ) : (
            <div className="py-12 text-center text-dark-400 dark:text-dark-500 text-sm">No deposits yet</div>
          )}
        </Card>

        <Card noPadding>
          <div className="px-6 pt-5 pb-3 border-b border-dark-200 dark:border-dark-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-dark-800 dark:text-dark-100">Recent Withdrawals</h3>
              <span className="text-xs text-dark-400 dark:text-dark-500">{recentWithdrawals.length} latest</span>
            </div>
          </div>
          {recentWithdrawals.length > 0 ? (
            <DataTable columns={withdrawalColumns} data={recentWithdrawals} pageSize={5} />
          ) : (
            <div className="py-12 text-center text-dark-400 dark:text-dark-500 text-sm">No withdrawals yet</div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
