import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Users, Target, BarChart3, DollarSign,
  Activity, RefreshCw, Wallet, LineChart, Shield, Zap, ArrowUpRight, ArrowDownRight,
  Clock, PieChart, Eye, X, Layers, Percent, Briefcase, AlertTriangle,
  ChevronRight, StopCircle, CheckCircle2, MinusCircle
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'

const REFRESH_INTERVAL = 15000

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatMoney = (val) => {
  const num = parseFloat(val || 0)
  if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatPercent = (val) => `${parseFloat(val || 0).toFixed(1)}%`

const allocationLabel = (method) => {
  const map = { lot: 'Lot-Based', percent: 'Percentage', equity: 'Equity-Based' }
  return map[(method || '').toLowerCase()] || method || 'Standard'
}

const allocationColor = (method) => {
  const map = {
    lot: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    percent: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    equity: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  }
  return map[(method || '').toLowerCase()] || 'bg-slate-500/10 text-slate-600 border-slate-500/20'
}

// ─── Animated Number ────────────────────────────────────────────────────────
const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 2, className = '' }) => {
  const num = parseFloat(value || 0)
  return (
    <motion.span
      key={num.toFixed(decimals)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {prefix}{num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </motion.span>
  )
}

// ─── Mini Sparkline SVG ─────────────────────────────────────────────────────
const MiniSparkline = ({ data = [], color = '#10b981', height = 40, width = 120 }) => {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const gradientId = `spark-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Win/Loss Donut ─────────────────────────────────────────────────────────
const WinLossDonut = ({ winRate = 0, size = 72 }) => {
  const pct = parseFloat(winRate || 0) / 100
  if (pct === 0) return null
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const winDash = pct * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ef444440" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#10b981" strokeWidth="6"
        strokeDasharray={`${winDash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 dark:fill-white text-xs font-bold">
        {(pct * 100).toFixed(0)}%
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const MamPage = () => {
  const [activeTab, setActiveTab] = useState('managers')
  const [managers, setManagers] = useState([])
  const [investments, setInvestments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Manager detail
  const [selectedManager, setSelectedManager] = useState(null)
  const [managerDetail, setManagerDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailSection, setDetailSection] = useState('positions')

  // Invest modal
  const [investModal, setInvestModal] = useState({ isOpen: false, manager: null })
  const [investForm, setInvestForm] = useState({ amount: '', allocationPct: 100, mt5AccountId: '' })
  const [isInvesting, setIsInvesting] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Stop investment confirmation
  const [stopConfirm, setStopConfirm] = useState(null)

  // Investment trades
  const [investmentTrades, setInvestmentTrades] = useState({})
  const [loadingTrades, setLoadingTrades] = useState({})

  // ─── Fetch all data ─────────────────────────────────────────────────────
  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true)
      else setIsRefreshing(true)
      setError(null)
      const [managersRes, investmentsRes] = await Promise.all([
        api.get('/mam/managers'),
        api.get('/mam/investments'),
      ])
      setManagers(managersRes.data?.data || managersRes.data || [])
      setInvestments(investmentsRes.data?.data || investmentsRes.data || [])
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch MAM data'
      console.error('Fetch MAM data error:', msg)
      if (showLoader) setError(msg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => fetchData(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  // ─── Fetch manager detail ──────────────────────────────────────────────
  const openManagerDetail = useCallback(async (manager) => {
    setSelectedManager(manager)
    setDetailSection('positions')
    setIsLoadingDetail(true)
    try {
      const res = await api.get(`/mam/managers/${manager.id}`)
      setManagerDetail(res.data?.data || res.data)
    } catch (err) {
      toast.error('Failed to load manager details')
      setManagerDetail(null)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const closeManagerDetail = useCallback(() => {
    setSelectedManager(null)
    setManagerDetail(null)
  }, [])

  // ─── Open invest modal ─────────────────────────────────────────────────
  const openInvestModal = useCallback(async (manager) => {
    setInvestModal({ isOpen: true, manager })
    setInvestForm({ amount: String(manager.minInvestment || 100), allocationPct: 100, mt5AccountId: '' })
    // Fetch user's MT5 accounts
    setLoadingAccounts(true)
    try {
      const res = await api.get('/accounts')
      const accounts = res.data?.data || res.data || []
      // Filter out demo accounts
      const liveAccounts = accounts.filter(a => a.accountType !== 'demo' && a.status === 'active')
      setUserAccounts(liveAccounts)
      // Auto-select first live account
      if (liveAccounts.length === 1) {
        setInvestForm(prev => ({ ...prev, mt5AccountId: String(liveAccounts[0].id) }))
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
      setUserAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const closeInvestModal = useCallback(() => {
    setInvestModal({ isOpen: false, manager: null })
    setInvestForm({ amount: '', allocationPct: 100, mt5AccountId: '' })
    setUserAccounts([])
  }, [])

  // ─── Submit investment ─────────────────────────────────────────────────
  const handleInvest = useCallback(async () => {
    const mgr = investModal.manager
    if (!mgr) return
    const amount = parseFloat(investForm.amount)
    const pct = parseInt(investForm.allocationPct, 10)
    const mt5AccountId = investForm.mt5AccountId
    if (!mt5AccountId) {
      toast.error('Please select an MT5 account')
      return
    }
    if (isNaN(amount) || amount < (mgr.minInvestment || 0)) {
      toast.error(`Minimum investment is ${formatMoney(mgr.minInvestment || 0)}`)
      return
    }
    if (isNaN(pct) || pct < 1 || pct > 100) {
      toast.error('Allocation must be between 1% and 100%')
      return
    }
    try {
      setIsInvesting(true)
      await api.post('/mam/invest', { managerId: mgr.id, mt5AccountId: parseInt(mt5AccountId), amount, allocationPct: pct })
      toast.success('Investment placed successfully!')
      closeInvestModal()
      fetchData(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Investment failed')
    } finally {
      setIsInvesting(false)
    }
  }, [investModal, investForm, closeInvestModal, fetchData])

  // ─── Stop investment ───────────────────────────────────────────────────
  const handleStopInvestment = useCallback(async (mamAccountId) => {
    try {
      await api.delete(`/mam/investments/${mamAccountId}`)
      toast.success('Investment stopped successfully')
      setStopConfirm(null)
      fetchData(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop investment')
    }
  }, [fetchData])

  // ─── Fetch investment trades ───────────────────────────────────────────
  const fetchInvestmentTrades = useCallback(async (mamAccountId) => {
    if (investmentTrades[mamAccountId]) return
    setLoadingTrades(prev => ({ ...prev, [mamAccountId]: true }))
    try {
      const res = await api.get(`/mam/investments/${mamAccountId}/trades`)
      setInvestmentTrades(prev => ({ ...prev, [mamAccountId]: res.data?.data || [] }))
    } catch (err) {
      toast.error('Failed to load trades')
    } finally {
      setLoadingTrades(prev => ({ ...prev, [mamAccountId]: false }))
    }
  }, [investmentTrades])

  // ─── Derived stats ─────────────────────────────────────────────────────
  const totalInvested = investments.reduce((s, inv) => s + parseFloat(inv.investedAmount || 0), 0)
  const totalCurrentValue = investments.reduce((s, inv) => s + parseFloat(inv.currentValue || 0), 0)
  const totalPL = investments.reduce((s, inv) => s + parseFloat(inv.totalProfit || 0), 0)
  const activeInvestments = investments.filter(inv => inv.status === 'active').length

  // ─── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader />
      </div>
    )
  }

  const getManagerName = (mgr) => {
    if (mgr?.user) return `${mgr.user.firstName || ''} ${mgr.user.lastName || ''}`.trim() || mgr.name || 'Manager'
    return mgr?.name || 'Manager'
  }

  const getInitials = (mgr) => {
    if (mgr?.user) return ((mgr.user.firstName?.[0] || '') + (mgr.user.lastName?.[0] || '')).toUpperCase() || '?'
    return (mgr?.name?.[0] || '?').toUpperCase()
  }

  // Sparkline data from recentTrades profit
  const getSparkData = (detail) => {
    const trades = detail?.recentTrades || []
    if (trades.length < 2) return []
    return trades.slice().reverse().reduce((acc, t) => {
      const last = acc.length > 0 ? acc[acc.length - 1] : 0
      acc.push(last + (parseFloat(t.profit) || 0))
      return acc
    }, [])
  }

  return (
    <motion.div variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">

      {/* ═══ HERO HEADER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:via-slate-900 dark:to-black p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-primary-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-green-500/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  MAM — Multi-Account Managers
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Invest with professional money managers and grow your portfolio
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchData(false)}
            className={`p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="relative flex gap-1 mt-6 p-1 bg-white/10 rounded-xl w-fit backdrop-blur-sm">
          {[
            { key: 'managers', label: 'MAM Managers', icon: Briefcase, count: managers.length },
            { key: 'investments', label: 'My Investments', icon: Wallet, count: investments.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.key
                  ? 'bg-primary-500/10 text-primary-600'
                  : 'bg-white/20 text-white/80'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => fetchData(true)} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — MAM MANAGERS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'managers' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Summary Stats */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Available Managers', value: managers.length, icon: Briefcase, color: 'blue', decimals: 0 },
              { label: 'Total Investors', value: managers.reduce((s, m) => s + (m.investorCount || 0), 0), icon: Users, color: 'purple', decimals: 0 },
              { label: 'Avg Win Rate', value: managers.length > 0 ? managers.reduce((s, m) => s + parseFloat(m.winRate || 0), 0) / managers.length : 0, icon: Target, color: 'green', suffix: '%', decimals: 1 },
              { label: 'Total Trades', value: managers.reduce((s, m) => s + (m.totalTrades || 0), 0), icon: BarChart3, color: 'cyan', decimals: 0 },
            ].map((stat, i) => (
              <motion.div key={i} variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                    <stat.icon className={`h-4 w-4 text-${stat.color}-500`} />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                </div>
                <AnimatedNumber value={stat.value} suffix={stat.suffix || ''} decimals={stat.decimals} className="text-xl font-black text-slate-900 dark:text-white" />
              </motion.div>
            ))}
          </motion.div>

          {/* Manager Cards Grid */}
          {managers.length === 0 ? (
            <Card variant="elevated">
              <CardBody className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Briefcase className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 font-medium">No MAM managers available yet</p>
                <p className="text-xs text-slate-400 mt-1">Check back soon for professional managers</p>
              </CardBody>
            </Card>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {managers.map((mgr) => {
                const profit = parseFloat(mgr.totalProfit || 0)
                const avgProfit = parseFloat(mgr.avgProfit || 0)
                return (
                  <motion.div
                    key={mgr.id}
                    variants={itemVariants}
                    className="group relative rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300"
                  >
                    {/* Active indicator */}
                    {mgr.isActive && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-primary-500 to-green-500" />
                    )}

                    <div className="p-5">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center text-lg font-black text-white shadow-md shadow-primary-500/20">
                            {getInitials(mgr)}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {mgr.name || getManagerName(mgr)}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Shield className="h-3 w-3" /> MT5: {mgr.account?.mt5Login || '—'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${allocationColor(mgr.allocationMethod)}`}>
                                {allocationLabel(mgr.allocationMethod)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {mgr.isActive && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full border border-green-500/20">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {mgr.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{mgr.description}</p>
                      )}

                      {/* Live Equity / Balance Row */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Live Equity</p>
                          <p className="text-lg font-black text-green-600 dark:text-green-400">
                            {formatMoney(mgr.liveEquity)}
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Live Balance</p>
                          <p className="text-lg font-black text-green-600 dark:text-green-400">
                            {formatMoney(mgr.liveBalance)}
                          </p>
                        </div>
                      </div>

                      {/* Performance Stats Row */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <p className="text-[10px] text-slate-400 mb-0.5">Win Rate</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{formatPercent(mgr.winRate)}</p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <p className="text-[10px] text-slate-400 mb-0.5">Trades</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{mgr.totalTrades || 0}</p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <p className="text-[10px] text-slate-400 mb-0.5">Avg Profit</p>
                          <p className={`text-sm font-bold ${avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(avgProfit)}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <p className="text-[10px] text-slate-400 mb-0.5">Total P&L</p>
                          <p className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(profit)}
                          </p>
                        </div>
                      </div>

                      {/* Fee + Investor Row */}
                      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              Mgmt: <strong>{mgr.managementFeePct || 0}%</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Percent className="h-3.5 w-3.5 text-orange-500" />
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              Perf: <strong>{mgr.performanceFeePct || 0}%</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-primary-500" />
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                            {mgr.investorCount || 0} investors
                          </span>
                        </div>
                      </div>

                      {/* Min Investment + Actions */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-xs text-slate-500">
                          <Wallet className="h-3.5 w-3.5 inline mr-1" />
                          Min: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(mgr.minInvestment)}</strong>
                        </div>
                        <button
                          onClick={() => openManagerDetail(mgr)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openInvestModal(mgr) }}
                          className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-primary-500 to-green-500 hover:from-primary-400 hover:to-green-400 shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all hover:-translate-y-0.5"
                        >
                          <Zap className="h-3.5 w-3.5" /> Invest
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — MY INVESTMENTS                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'investments' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Investment Summary Stats */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Invested', value: totalInvested, icon: Wallet, color: 'blue', prefix: '$' },
              { label: 'Current Value', value: totalCurrentValue, icon: DollarSign, color: 'green', prefix: '$' },
              { label: 'Total P&L', value: totalPL, icon: totalPL >= 0 ? TrendingUp : TrendingDown, color: totalPL >= 0 ? 'green' : 'red', prefix: totalPL >= 0 ? '+$' : '-$', absVal: true },
              { label: 'Active Investments', value: activeInvestments, icon: Activity, color: 'purple', decimals: 0 },
            ].map((stat, i) => (
              <motion.div key={i} variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                    <stat.icon className={`h-4 w-4 text-${stat.color}-500`} />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                </div>
                <AnimatedNumber
                  value={stat.absVal ? Math.abs(stat.value) : stat.value}
                  prefix={stat.prefix || ''}
                  decimals={stat.decimals !== undefined ? stat.decimals : 2}
                  className={`text-xl font-black ${
                    stat.color === 'red' ? 'text-red-600' :
                    stat.color === 'green' ? 'text-green-600' :
                    'text-slate-900 dark:text-white'
                  }`}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Investment Cards */}
          {investments.length === 0 ? (
            <Card variant="elevated">
              <CardBody className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 font-medium">No investments yet</p>
                <p className="text-xs text-slate-400 mt-1">Browse MAM managers and start investing</p>
                <Button variant="primary" className="mt-4" onClick={() => setActiveTab('managers')}>
                  Browse Managers
                </Button>
              </CardBody>
            </Card>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {investments.map((inv) => {
                const pnl = parseFloat(inv.totalProfit || 0)
                const netPnl = parseFloat(inv.netProfit || 0)
                const fees = parseFloat(inv.totalFees || 0)
                const isActive = inv.status === 'active'
                const trades = investmentTrades[inv.id]
                const isLoadingTrades = loadingTrades[inv.id]

                return (
                  <motion.div
                    key={inv.id}
                    variants={itemVariants}
                    className="relative rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all"
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-primary-500" />
                    )}

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-sm font-black text-white">
                            {(inv.manager?.name?.[0] || inv.manager?.user?.firstName?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {inv.manager?.name || `${inv.manager?.user?.firstName || ''} ${inv.manager?.user?.lastName || ''}`.trim() || 'Manager'}
                            </h3>
                            <span className="text-[11px] text-slate-400">Investment #{inv.id}</span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isActive
                            ? 'bg-green-500/10 text-green-600 border-green-500/20'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'
                        }`}>
                          {isActive ? <CheckCircle2 className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                          {(inv.status || 'unknown').toUpperCase()}
                        </span>
                      </div>

                      {/* Money Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Invested</p>
                          <p className="text-base font-black text-slate-900 dark:text-white">{formatMoney(inv.investedAmount)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Value</p>
                          <p className="text-base font-black text-primary-600 dark:text-primary-400">{formatMoney(inv.currentValue)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">P&L</p>
                          <p className={`text-base font-black ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                          </p>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="flex items-center gap-3 mb-4 text-xs">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <Activity className="h-3 w-3 text-orange-500" />
                          <span className="text-slate-600 dark:text-slate-300"><strong>{inv.openTrades || 0}</strong> open trades</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                          <PieChart className="h-3 w-3 text-purple-500" />
                          <span className="text-slate-600 dark:text-slate-300"><strong>{inv.allocationPct || 0}%</strong> allocation</span>
                        </div>
                        {fees > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <DollarSign className="h-3 w-3 text-amber-500" />
                            <span className="text-slate-600 dark:text-slate-300">Fees: {formatMoney(fees)}</span>
                          </div>
                        )}
                      </div>

                      {/* Net Profit (if different from totalProfit) */}
                      {netPnl !== pnl && (
                        <div className="p-2.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/30 dark:to-slate-700/50 rounded-lg mb-4 flex items-center justify-between">
                          <span className="text-xs text-slate-500">Net Profit (after fees)</span>
                          <span className={`text-sm font-bold ${netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netPnl >= 0 ? '+' : ''}{formatMoney(netPnl)}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fetchInvestmentTrades(inv.id)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-all"
                          disabled={isLoadingTrades}
                        >
                          {isLoadingTrades ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                          View Trades
                        </button>
                        {isActive && (
                          <>
                            {stopConfirm === inv.id ? (
                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-xs text-red-600 font-medium">Confirm stop?</span>
                                <button
                                  onClick={() => handleStopInvestment(inv.id)}
                                  className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
                                >
                                  Yes, Stop
                                </button>
                                <button
                                  onClick={() => setStopConfirm(null)}
                                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setStopConfirm(inv.id)}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-all ml-auto"
                              >
                                <StopCircle className="h-3.5 w-3.5" /> Stop Investment
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Trades Table (Expandable) */}
                      {trades && trades.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-primary-500" /> Trade History
                          </h4>
                          <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-700">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0">
                                <tr className="bg-slate-50 dark:bg-slate-800">
                                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Symbol</th>
                                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Type</th>
                                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Volume</th>
                                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Profit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trades.map((trade, idx) => {
                                  const tp = parseFloat(trade.profit || 0)
                                  const isBuy = (trade.type || '').toLowerCase() === 'buy'
                                  return (
                                    <tr key={trade.id || idx} className="border-b border-slate-50 dark:border-slate-700/50">
                                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{trade.symbol || '—'}</td>
                                      <td className="py-2 px-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isBuy ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                        }`}>
                                          {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                                          {isBuy ? 'BUY' : 'SELL'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{trade.volume || '—'}</td>
                                      <td className="py-2 px-3 text-right">
                                        <span className={`font-bold ${tp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {tp >= 0 ? '+' : ''}{formatMoney(tp)}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {trades && trades.length === 0 && (
                        <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4 text-center">
                          <p className="text-xs text-slate-400">No trades found for this investment</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MANAGER DETAIL MODAL                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
            onClick={closeManagerDetail}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full my-8"
              onClick={e => e.stopPropagation()}
            >
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-20">
                  <Loader />
                </div>
              ) : managerDetail ? (
                <>
                  {/* Detail Header */}
                  <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary-500/20 to-transparent rounded-full blur-3xl" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-primary-500/30">
                          {getInitials(managerDetail)}
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white">{managerDetail.name || getManagerName(managerDetail)}</h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Shield className="h-3 w-3" /> MT5: {managerDetail.account?.mt5Login || '—'}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Users className="h-3 w-3" /> {managerDetail.investorCount || 0} investors
                            </span>
                          </div>
                        </div>
                      </div>
                      <button onClick={closeManagerDetail} className="text-slate-400 hover:text-white transition-colors p-2">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      {[
                        { label: 'Live Equity', value: formatMoney(managerDetail.liveEquity), color: 'text-green-400' },
                        { label: 'Win Rate', value: formatPercent(managerDetail.winRate), color: 'text-purple-400' },
                        { label: 'Total Deals', value: managerDetail.totalDeals || 0, color: 'text-cyan-400' },
                        { label: 'Free Margin', value: formatMoney(managerDetail.freeMargin), color: 'text-amber-400' },
                      ].map((s, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg backdrop-blur-sm">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</p>
                          <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Performance Chart */}
                  {(() => {
                    const sparkData = getSparkData(managerDetail)
                    if (sparkData.length < 2) return null
                    const totalProfit = parseFloat(managerDetail.totalProfit || 0)
                    return (
                      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <LineChart className="h-4 w-4 text-primary-500" /> Performance Curve
                          </h3>
                          <span className={`text-sm font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)}
                          </span>
                        </div>
                        <div className="flex items-end justify-center">
                          <MiniSparkline
                            data={sparkData}
                            color={totalProfit >= 0 ? '#10b981' : '#ef4444'}
                            height={80}
                            width={560}
                          />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Detail Tabs */}
                  <div className="px-6 pt-4 pb-0">
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl w-fit">
                      {[
                        { key: 'positions', label: 'Live Positions', count: managerDetail.openPositionCount || (managerDetail.livePositions || []).length, icon: Activity },
                        { key: 'trades', label: 'Recent Trades', count: (managerDetail.recentTrades || []).length, icon: BarChart3 },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setDetailSection(tab.key)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            detailSection === tab.key
                              ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <tab.icon className="h-3.5 w-3.5" />
                          {tab.label}
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            detailSection === tab.key ? 'bg-primary-500/10 text-primary-600' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                          }`}>{tab.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Positions Table */}
                  {detailSection === 'positions' && (
                    <div className="p-6">
                      {(managerDetail.livePositions || []).length === 0 ? (
                        <div className="text-center py-10">
                          <Activity className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No open positions right now</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-700/50">
                                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Open Price</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Swap</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(managerDetail.livePositions || []).map((pos, idx) => {
                                const profit = parseFloat(pos.profit || 0)
                                const isBuy = (pos.type || '').toLowerCase() === 'buy'
                                return (
                                  <motion.tr
                                    key={pos.ticket || idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.04 }}
                                    className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
                                  >
                                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{(pos.symbol || '').replace(/\.#$/, '')}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isBuy ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                      }`}>
                                        {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                                        {isBuy ? 'BUY' : 'SELL'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{pos.volume}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{pos.openPrice}</td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">{pos.currentPrice}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">{parseFloat(pos.swap || 0).toFixed(2)}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                                      </span>
                                    </td>
                                  </motion.tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recent Trades Table */}
                  {detailSection === 'trades' && (
                    <div className="p-6">
                      {(managerDetail.recentTrades || []).length === 0 ? (
                        <div className="text-center py-10">
                          <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No recent trades</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700 max-h-72 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0">
                              <tr className="bg-slate-50 dark:bg-slate-700/50">
                                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Open</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Close</th>
                                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(managerDetail.recentTrades || []).map((trade, idx) => {
                                const profit = parseFloat(trade.profit || 0)
                                const isBuy = (trade.type || trade.action || '').toLowerCase() === 'buy'
                                return (
                                  <tr key={trade.id || trade.deal || idx} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{(trade.symbol || '').replace(/\.#$/, '')}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isBuy ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                      }`}>
                                        {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                                        {isBuy ? 'BUY' : 'SELL'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{trade.volume}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{trade.openPrice || trade.price || '—'}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{trade.closePrice || '—'}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detail Footer - Invest Button */}
                  <div className="p-6 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => { closeManagerDetail(); openInvestModal(managerDetail) }}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-green-500 text-white font-bold text-sm hover:from-primary-400 hover:to-green-400 shadow-lg shadow-primary-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="h-4 w-4" /> Invest with {managerDetail.name || getManagerName(managerDetail)}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-slate-500">Failed to load manager details</p>
                  <Button variant="secondary" className="mt-4" onClick={closeManagerDetail}>Close</Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* INVEST MODAL                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {investModal.isOpen && investModal.manager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeInvestModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary-500" /> Invest in MAM
                  </h3>
                  <button onClick={closeInvestModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Manager Info Badge */}
                <div className="p-4 bg-gradient-to-r from-primary-500/10 to-green-500/10 border border-primary-500/20 rounded-xl mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                      {getInitials(investModal.manager)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {investModal.manager.name || getManagerName(investModal.manager)}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-slate-500">
                          Mgmt Fee: <strong className="text-slate-700 dark:text-slate-300">{investModal.manager.managementFeePct || 0}%</strong>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Perf Fee: <strong className="text-slate-700 dark:text-slate-300">{investModal.manager.performanceFeePct || 0}%</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="px-6 space-y-4">
                {/* MT5 Account Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select MT5 Account
                  </label>
                  {loadingAccounts ? (
                    <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Loading accounts...
                    </div>
                  ) : userAccounts.length === 0 ? (
                    <div className="py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-600 dark:text-red-400">
                      No live MT5 accounts found. Demo accounts cannot be used for MAM investment.
                    </div>
                  ) : (
                    <select
                      value={investForm.mt5AccountId}
                      onChange={e => setInvestForm(prev => ({ ...prev, mt5AccountId: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm font-semibold appearance-none cursor-pointer"
                    >
                      <option value="">— Choose MT5 Account —</option>
                      {userAccounts.map(acc => (
                        <option key={acc.id} value={String(acc.id)}>
                          MT5 #{acc.mt5Login} — {(acc.accountType || 'standard').toUpperCase()} — Balance: ${parseFloat(acc.balance || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Only live accounts are shown. Demo accounts are excluded.
                  </p>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Investment Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      value={investForm.amount}
                      onChange={e => setInvestForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full pl-8 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-lg font-bold"
                      min={investModal.manager.minInvestment || 0}
                      placeholder={`Min: ${formatMoney(investModal.manager.minInvestment)}`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum investment: <strong>{formatMoney(investModal.manager.minInvestment)}</strong>
                  </p>
                </div>

                {/* Allocation % */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Allocation Percentage
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={investForm.allocationPct}
                      onChange={e => setInvestForm(prev => ({ ...prev, allocationPct: parseInt(e.target.value, 10) }))}
                      className="flex-1 h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-600 accent-primary-500"
                    />
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 min-w-[72px] justify-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={investForm.allocationPct}
                        onChange={e => {
                          let val = parseInt(e.target.value, 10)
                          if (isNaN(val)) val = 1
                          if (val < 1) val = 1
                          if (val > 100) val = 100
                          setInvestForm(prev => ({ ...prev, allocationPct: val }))
                        }}
                        className="w-10 text-center bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none"
                      />
                      <span className="text-sm font-bold text-slate-500">%</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Allocation determines what percentage of the manager's trades are proportionally applied to your account. At 100%, you mirror the full strategy.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 pt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={closeInvestModal}>Cancel</Button>
                <button
                  onClick={handleInvest}
                  disabled={isInvesting}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-green-500 text-white font-bold text-sm hover:from-primary-400 hover:to-green-400 shadow-lg shadow-primary-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isInvesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {isInvesting ? 'Investing...' : 'Invest Now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default MamPage
