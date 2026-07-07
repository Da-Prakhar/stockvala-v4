import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Users, Target, BarChart3, ArrowLeft, Copy, X, DollarSign,
  Activity, RefreshCw, Wallet, LineChart, Shield, Zap, ArrowUpRight, ArrowDownRight,
  Clock, Award, PieChart, Eye, ChevronDown, ChevronUp, Star
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'

const REFRESH_INTERVAL = 10000

// Helpers
const formatMoney = (val) => {
  const num = parseFloat(val || 0)
  if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
  if (Math.abs(num) >= 1000) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${num.toFixed(2)}`
}

const formatPercent = (val) => `${parseFloat(val || 0).toFixed(1)}%`

// Animated counter
const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 2, className = '' }) => {
  const num = parseFloat(value || 0)
  return (
    <motion.span
      key={num.toFixed(decimals)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {prefix}{num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </motion.span>
  )
}

// Mini sparkline chart (SVG)
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

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// Donut chart for win/loss
const WinLossDonut = ({ wins = 0, losses = 0, size = 80 }) => {
  const total = wins + losses
  if (total === 0) return null
  const winPct = wins / total
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const winDash = winPct * circ
  const lossDash = (1 - winPct) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ef444440" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#10b981" strokeWidth="8"
        strokeDasharray={`${winDash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="fill-slate-900 dark:fill-white text-sm font-bold">
        {(winPct * 100).toFixed(0)}%
      </text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="fill-slate-500 text-[10px]">
        Win Rate
      </text>
    </svg>
  )
}

const MasterDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [master, setMaster] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [mt5Accounts, setMt5Accounts] = useState([])
  const [activeSection, setActiveSection] = useState('positions')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Follow modal
  const [showFollowModal, setShowFollowModal] = useState(false)
  const [followForm, setFollowForm] = useState({ allocationAmount: '100', followerMt5AccountId: '', copyRatio: '1.0' })

  const fetchMaster = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true)
      else setIsRefreshing(true)
      const masterRes = await api.get(`/copy-trading/masters/${id}`)
      setMaster(masterRes.data?.data)
    } catch (err) {
      if (showLoader) setError(err.response?.data?.message || 'Failed to fetch')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [masterRes, followingsRes, accountsRes] = await Promise.allSettled([
          api.get(`/copy-trading/masters/${id}`),
          api.get('/copy-trading/followings'),
          api.get('/accounts'),
        ])
        if (masterRes.status === 'fulfilled') setMaster(masterRes.value.data?.data)
        else setError('Failed to fetch master details')
        if (followingsRes.status === 'fulfilled') {
          const followings = followingsRes.value.data?.data?.rows || followingsRes.value.data?.data || []
          setIsFollowing((Array.isArray(followings) ? followings : []).some(f => String(f.masterId) === String(id) && f.status === 'active'))
        }
        if (accountsRes.status === 'fulfilled') {
          const d = accountsRes.value.data?.data || accountsRes.value.data || []
          setMt5Accounts(Array.isArray(d) ? d : [])
        }
      } catch (err) { setError(err.message || 'Failed to fetch') }
      finally { setIsLoading(false) }
    }
    fetchAll()
  }, [id])

  useEffect(() => {
    if (!master) return
    const interval = setInterval(() => fetchMaster(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [master, fetchMaster])

  const handleFollow = async () => {
    if (!followForm.allocationAmount || parseFloat(followForm.allocationAmount) <= 0) return toast.error('Enter a valid allocation amount')
    try {
      await api.post(`/copy-trading/follow/${id}`, {
        allocationAmount: parseFloat(followForm.allocationAmount),
        followerMt5AccountId: followForm.followerMt5AccountId || undefined,
        copyRatio: parseFloat(followForm.copyRatio) || 1.0
      })
      toast.success('Now following this master trader!')
      setIsFollowing(true)
      setShowFollowModal(false)
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to follow') }
  }

  const handleUnfollow = async () => {
    if (!confirm('Stop following this master?')) return
    try {
      await api.delete(`/copy-trading/unfollow/${id}`)
      setIsFollowing(false)
      toast.success('Unfollowed master trader')
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
  }

  const getMasterName = () => {
    if (master?.user) return `${master.user.firstName || ''} ${master.user.lastName || ''}`.trim() || master.displayName || 'Trader'
    return master?.displayName || 'Trader'
  }

  const getInitials = () => {
    if (master?.user) return ((master.user.firstName?.[0] || '') + (master.user.lastName?.[0] || '')).toUpperCase() || '?'
    return (master?.displayName?.[0] || '?').toUpperCase()
  }

  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader /></div>
  if (error || !master) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300">Error: {error || 'Master not found'}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/copy-trading')}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      </div>
    )
  }

  const liveAccount = master.liveAccount || {}
  const liveStats = master.liveStats || {}
  const livePositions = master.livePositions || []
  const recentDeals = master.recentDeals || []
  const recentCopyTrades = master.recentCopyTrades || []
  const totalPL = livePositions.reduce((s, p) => s + parseFloat(p.profit || 0), 0)

  // Generate sparkline data from deals profit
  const sparkData = recentDeals.slice().reverse().reduce((acc, d) => {
    const last = acc.length > 0 ? acc[acc.length - 1] : 0
    acc.push(last + (parseFloat(d.profit) || 0))
    return acc
  }, [])

  return (
    <motion.div variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/copy-trading')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Copy Trading
      </button>

      {/* ═══ HERO HEADER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:via-slate-900 dark:to-black p-6 sm:p-8">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-green-500/10 to-transparent rounded-full blur-2xl" />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-primary-500/30">
              {getInitials()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-3 border-slate-900 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{getMasterName()}</h1>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                LIVE TRADING
              </span>
              {livePositions.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full border border-orange-500/30 animate-pulse">
                  <Activity className="h-3 w-3" /> {livePositions.length} Open
                </span>
              )}
            </div>
            {master.displayName && master.user && (
              <p className="text-primary-400 font-semibold text-sm mb-1">{master.displayName}</p>
            )}
            <p className="text-slate-400 text-sm max-w-xl">{master.description || 'Professional trader'}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {master.tradingStyle && (
                <span className="px-3 py-1 bg-white/10 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                  {master.tradingStyle}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Shield className="h-3 w-3" /> MT5: {master.mt5Login || master.account?.mt5Login || '—'}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <DollarSign className="h-3 w-3" /> Fee: {master.performanceFeePct || 0}%
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Wallet className="h-3 w-3" /> Min: ${master.minInvestment || 0}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users className="h-3 w-3" /> {master.followerCount || 0} followers
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => fetchMaster(false)}
              className={`p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {isFollowing ? (
              <button onClick={handleUnfollow} className="px-5 py-3 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold text-sm hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all">
                Following ✓
              </button>
            ) : (
              <button
                onClick={() => {
                  setFollowForm({ allocationAmount: String(master.minInvestment || 100), followerMt5AccountId: mt5Accounts[0]?.id || '', copyRatio: '1.0' })
                  setShowFollowModal(true)
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/30 transition-all hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5"
              >
                <Copy className="h-4 w-4 inline mr-2" /> Copy This Trader
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ LIVE STATS GRID ═══ */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Equity */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">Equity</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(liveAccount.equity)}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            <Zap className="h-2.5 w-2.5" /> Live
          </span>
        </motion.div>

        {/* Balance */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">Balance</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(liveAccount.balance)}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            <Zap className="h-2.5 w-2.5" /> Live
          </span>
        </motion.div>

        {/* Unrealized P&L */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalPL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {totalPL >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <span className="text-xs font-medium text-slate-500">Unrealized P&L</span>
          </div>
          <p className={`text-xl font-black ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(totalPL)}</p>
          <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${totalPL >= 0 ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
            {totalPL >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />} Open trades
          </span>
        </motion.div>

        {/* Win Rate */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">Win Rate</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{formatPercent(liveStats.winRate || master.winRate)}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">
            <Clock className="h-2.5 w-2.5" /> 30 days
          </span>
        </motion.div>

        {/* Open Positions */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">Open Positions</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{livePositions.length}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
            <Zap className="h-2.5 w-2.5" /> Now
          </span>
        </motion.div>

        {/* Total Trades */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">Total Trades</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{liveStats.totalTrades || 0}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">
            <Clock className="h-2.5 w-2.5" /> 30 days
          </span>
        </motion.div>
      </motion.div>

      {/* ═══ PERFORMANCE CHART + DONUT ═══ */}
      {(liveStats.totalTrades > 0 || sparkData.length > 2) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Equity Curve */}
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LineChart className="h-5 w-5 text-primary-500" />
                Profit Curve (30 Days)
              </h3>
              <span className={`text-lg font-black ${(liveStats.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(liveStats.totalProfit)}
              </span>
            </div>
            {sparkData.length > 2 ? (
              <div className="flex items-end justify-center">
                <MiniSparkline
                  data={sparkData}
                  color={(liveStats.totalProfit || 0) >= 0 ? '#10b981' : '#ef4444'}
                  height={120}
                  width={Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 200 : 600)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Not enough data for chart</div>
            )}

            {/* Stats row under chart */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Total</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{liveStats.totalTrades || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Winning</p>
                <p className="text-sm font-bold text-green-600">{liveStats.winningTrades || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Losing</p>
                <p className="text-sm font-bold text-red-600">{liveStats.losingTrades || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Win Rate</p>
                <p className="text-sm font-bold text-blue-600">{formatPercent(liveStats.winRate)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Total Profit</p>
                <p className={`text-sm font-bold ${(liveStats.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(liveStats.totalProfit)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5">Avg/Trade</p>
                <p className={`text-sm font-bold ${(liveStats.avgProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(liveStats.avgProfit)}</p>
              </div>
            </div>
          </div>

          {/* Win/Loss Donut + Summary */}
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-500" /> Trade Distribution
            </h3>
            <WinLossDonut wins={liveStats.winningTrades || 0} losses={liveStats.losingTrades || 0} size={120} />
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Wins: {liveStats.winningTrades || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Losses: {liveStats.losingTrades || 0}</span>
              </div>
            </div>
            {/* Performance badge */}
            <div className={`mt-4 px-4 py-2 rounded-full text-xs font-bold ${
              (liveStats.winRate || 0) >= 60 ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
              (liveStats.winRate || 0) >= 40 ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' :
              'bg-red-500/10 text-red-600 border border-red-500/20'
            }`}>
              {(liveStats.winRate || 0) >= 60 ? '🔥 Strong Performer' :
               (liveStats.winRate || 0) >= 40 ? '📊 Average' : '⚠️ High Risk'}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECTION TABS ═══ */}
      <div className="flex gap-1 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {[
          { key: 'positions', label: `Live Positions`, count: livePositions.length, icon: Activity, color: 'text-green-500' },
          { key: 'deals', label: `Deal History`, count: recentDeals.length, icon: BarChart3, color: 'text-blue-500' },
          { key: 'copyTrades', label: `Copy Trades`, count: recentCopyTrades.length, icon: Copy, color: 'text-purple-500' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeSection === tab.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeSection === tab.key ? tab.color : ''}`} />
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeSection === tab.key ? 'bg-primary-500/10 text-primary-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ═══ LIVE OPEN POSITIONS ═══ */}
      {activeSection === 'positions' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" /> Live Open Positions
            </h3>
            <span className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Auto-refreshing every 10s
            </span>
          </div>
          {livePositions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Activity className="h-8 w-8 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No open positions right now</p>
              <p className="text-xs text-slate-400 mt-1">Positions appear here when the master opens trades</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ticket</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Open Price</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Swap</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {livePositions.map((pos, idx) => {
                    const profit = parseFloat(pos.profit || 0)
                    const isBuy = pos.type === 'buy'
                    return (
                      <motion.tr
                        key={pos.ticket || idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{pos.ticket}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-white">{(pos.symbol || '').replace(/\.#$/, '')}</span>
                          {(pos.symbol || '').endsWith('.#') && <span className="text-[10px] text-slate-400 ml-1">.#</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                            isBuy ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{pos.volume}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{pos.openPrice}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{pos.currentPrice}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{parseFloat(pos.swap || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                          </span>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <td colSpan={7} className="py-3 px-4 text-right font-bold text-sm text-slate-700 dark:text-slate-300">Total P&L:</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-black text-lg ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalPL >= 0 ? '+' : ''}{formatMoney(totalPL)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ DEAL HISTORY ═══ */}
      {activeSection === 'deals' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" /> MT5 Deal History (Last 30 Days)
            </h3>
          </div>
          {recentDeals.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-slate-500">No deals in the last 30 days</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Deal</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.map((deal, idx) => {
                    const profit = parseFloat(deal.profit || 0)
                    const isBuy = deal.type === 'buy'
                    return (
                      <tr key={deal.deal || idx} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{deal.deal}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{(deal.symbol || '').replace(/\.#$/, '')}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                            isBuy ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {(deal.type || '').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{deal.volume}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{deal.price}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500">
                          {deal.time ? new Date(deal.time * 1000).toLocaleString() : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ COPY TRADES ═══ */}
      {activeSection === 'copyTrades' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Copy className="h-5 w-5 text-purple-500" /> Recent Copy Trades
            </h3>
          </div>
          {recentCopyTrades.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Copy className="h-8 w-8 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-slate-500">No copy trades yet</p>
              <p className="text-xs text-slate-400 mt-1">Trades appear here when the engine copies master positions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Master Lots</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Your Lots</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                    <th className="text-center py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCopyTrades.map(trade => (
                    <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{(trade.symbol || '').replace(/\.#$/, '')}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                          trade.action === 'buy' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                        }`}>
                          {trade.action === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {(trade.action || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{trade.masterLots}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{trade.followerLots}</td>
                      <td className="py-3 px-4 text-right">
                        {trade.status === 'closed' ? (
                          <span className={`font-bold ${parseFloat(trade.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(trade.profit)}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          trade.status === 'open' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                          trade.status === 'closed' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' :
                          'bg-red-500/10 text-red-600 border border-red-500/20'
                        }`}>
                          {trade.status === 'open' ? '● ' : ''}{trade.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500">{trade.openedAt ? new Date(trade.openedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ FOLLOW MODAL ═══ */}
      <AnimatePresence>
        {showFollowModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowFollowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary-500" /> Copy {getMasterName()}
                </h3>
                <button onClick={() => setShowFollowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 bg-gradient-to-r from-green-500/10 to-primary-500/10 border border-green-500/20 rounded-xl mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-0.5">Auto-Copy Engine</p>
                    <p className="text-xs text-green-600/80 dark:text-green-500/80">
                      Trades from MT5 #{master.mt5Login || master.account?.mt5Login} will be <strong>automatically mirrored</strong> to your account within 3 seconds.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Your MT5 Account</label>
                  <select
                    value={followForm.followerMt5AccountId}
                    onChange={e => setFollowForm({ ...followForm, followerMt5AccountId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  >
                    {mt5Accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.mt5Login} ({acc.accountType})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Allocation Amount ($)</label>
                  <input
                    type="number"
                    value={followForm.allocationAmount}
                    onChange={e => setFollowForm({ ...followForm, allocationAmount: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    min={master.minInvestment || 100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Copy Ratio</label>
                  <input
                    type="number"
                    step="0.1"
                    value={followForm.copyRatio}
                    onChange={e => setFollowForm({ ...followForm, copyRatio: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    min="0.1" max="10"
                  />
                  <p className="text-xs text-slate-500 mt-1">1.0 = proportional to equity. 0.5 = half size. 2.0 = double size.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowFollowModal(false)}>Cancel</Button>
                <button
                  onClick={handleFollow}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-green-500 text-white font-bold text-sm hover:from-primary-400 hover:to-green-400 shadow-lg transition-all"
                >
                  Start Auto-Copying
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default MasterDetailPage
