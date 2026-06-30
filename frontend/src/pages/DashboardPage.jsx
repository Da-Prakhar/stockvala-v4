import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, LineChart, RefreshCw, Briefcase, ArrowUpDown } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardBody } from '../components/ui/Card'
import PortfolioChart from '../components/dashboard/PortfolioChart'
import PnLChart from '../components/dashboard/PnLChart'
import MarketOverview from '../components/dashboard/MarketOverview'
import RecentTrades from '../components/dashboard/RecentTrades'
import QuickActions from '../components/dashboard/QuickActions'
import MarketNews from '../components/dashboard/MarketNews'
import { pageTransitionVariants, containerVariants } from '../utils/animations'
import { useAuthStore } from '../store/authStore'
import { useAccountStore } from '../store/accountStore'
import { useTradeStore } from '../store/tradeStore'
import { useNotificationStore } from '../store/notificationStore'
import api from '../utils/api'

const DashboardPage = () => {
  const { user } = useAuthStore()
  const { accounts, fetchAccounts, syncAccount } = useAccountStore()
  const { positions, tradeHistory, fetchPositions, fetchLivePositions, fetchTradeHistory } = useTradeStore()
  const { notifications, fetchNotifications } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [depositTotal, setDepositTotal] = useState(0)
  const [withdrawalTotal, setWithdrawalTotal] = useState(0)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      await Promise.all([
        fetchAccounts(),
        fetchPositions().catch(() => []),
        fetchTradeHistory(1, 50).catch(() => ({ trades: [] })),
        fetchNotifications().catch(() => []),
      ])

      // Fetch deposit/withdrawal totals
      try {
        const [depRes, withRes] = await Promise.allSettled([
          api.get('/funds/deposits?limit=1000'),
          api.get('/funds/withdrawals?limit=1000'),
        ])
        if (depRes.status === 'fulfilled') {
          const deps = depRes.value.data?.data?.rows || depRes.value.data?.data || []
          const approved = Array.isArray(deps) ? deps.filter(d => d.status === 'approved') : []
          setDepositTotal(approved.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0))
        }
        if (withRes.status === 'fulfilled') {
          const withs = withRes.value.data?.data?.rows || withRes.value.data?.data || []
          const approved = Array.isArray(withs) ? withs.filter(w => w.status === 'approved') : []
          setWithdrawalTotal(approved.reduce((sum, w) => sum + parseFloat(w.amount || 0), 0))
        }
      } catch (_) {}
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // After accounts load, fetch positions across ALL accounts (not just selected)
  useEffect(() => {
    if (accounts.length === 0) return
    const fetchAllPositions = async () => {
      try {
        const allPositions = []
        await Promise.allSettled(
          accounts.map(async (acc) => {
            try {
              const res = await api.get(`/accounts/${acc.id}/positions`)
              const data = res.data?.data || {}
              const rawPositions = data.positions || data || []
              const mapped = (Array.isArray(rawPositions) ? rawPositions : []).map((pos) => ({
                id: pos.ticket || pos.position || `${acc.id}-${Math.random()}`,
                symbol: pos.symbol || '',
                type: pos.type === 0 || pos.type === 'BUY' ? 'buy' : pos.type === 1 || pos.type === 'SELL' ? 'sell' : String(pos.type || '').toLowerCase(),
                volume: pos.volume || 0,
                openPrice: pos.price_open || pos.priceOpen || 0,
                currentPrice: pos.price_current || pos.priceCurrent || 0,
                pnl: pos.profit || 0,
                sl: pos.sl || 0,
                tp: pos.tp || 0,
                openTime: pos.time_create || pos.timeCreate || new Date().toISOString(),
                swap: pos.swap || 0,
                commission: pos.commission || 0,
                accountLogin: acc.login || acc.mt5Login,
              }))
              allPositions.push(...mapped)
            } catch (_) {}
          })
        )
        // Update the tradeStore with all positions combined
        if (allPositions.length > 0) {
          useTradeStore.setState({ positions: allPositions })
        }
      } catch (_) {}
    }
    fetchAllPositions()
  }, [accounts])

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      await Promise.all(accounts.map((acc) => syncAccount(acc.id)))
      await fetchAccounts()
      await fetchLivePositions().catch(() => {})
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  const totalBalance = (accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0)
  const totalEquity = (accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.equity) || 0), 0)
  const totalPnL = (positions || []).reduce((sum, pos) => sum + (parseFloat(pos.pnl) || 0), 0)
  const totalMargin = (accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.margin) || 0), 0)
  const totalFreeMargin = (accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.freeMargin) || 0), 0)

  const stats = [
    {
      icon: DollarSign,
      label: 'Total Balance',
      value: `$${totalBalance.toFixed(2)}`,
      trend: `${(accounts || []).length} account${(accounts || []).length !== 1 ? 's' : ''}`,
      changeType: 'neutral',
    },
    {
      icon: Briefcase,
      label: 'Total Equity',
      value: `$${totalEquity.toFixed(2)}`,
      trend: `Free margin: $${totalFreeMargin.toFixed(2)}`,
      changeType: totalEquity >= totalBalance ? 'positive' : 'negative',
    },
    {
      icon: TrendingUp,
      label: 'Open P&L',
      value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`,
      trend: `${(positions || []).length} open position${(positions || []).length !== 1 ? 's' : ''}`,
      changeType: totalPnL >= 0 ? 'positive' : 'negative',
    },
    {
      icon: ArrowUpDown,
      label: 'Net Deposits',
      value: `$${(depositTotal - withdrawalTotal).toFixed(2)}`,
      trend: `In: $${depositTotal.toFixed(0)} / Out: $${withdrawalTotal.toFixed(0)}`,
      changeType: depositTotal >= withdrawalTotal ? 'positive' : 'negative',
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
      {/* Welcome Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-lg p-6 md:p-8 text-white"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {user?.firstName || user?.name || 'Trader'}!
            </h2>
            <p className="text-primary-100">
              You have {(accounts || []).length} MT5 account{(accounts || []).length !== 1 ? 's' : ''} and {(positions || []).length} active position{(positions || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing || (accounts || []).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync MT5'}
          </button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div key={index} variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { delay: index * 0.1 } }
          }}>
            <StatCard
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              changeType={stat.changeType}
              trend={stat.trend}
              loading={isLoading}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <motion.div
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          className="lg:col-span-2"
        >
          <PnLChart trades={tradeHistory} positions={positions} />
        </motion.div>
        <motion.div
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        >
          <PortfolioChart positions={positions} accounts={accounts} />
        </motion.div>
      </motion.div>

      {/* Market Overview + News */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2">
          <MarketOverview />
        </div>
        <div>
          <MarketNews />
        </div>
      </motion.div>

      {/* Recent Trades */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <RecentTrades trades={tradeHistory} positions={positions} />
      </motion.div>

      {/* Notifications Feed */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card variant="elevated">
          <CardBody>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Latest Notifications
            </h3>
            <div className="space-y-3">
              {notifications && notifications.length > 0 ? (
                notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      notif.type === 'success'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : notif.type === 'warning'
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      {notif.title}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {notif.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  No notifications yet
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default DashboardPage
