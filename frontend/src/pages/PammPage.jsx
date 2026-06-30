import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Users, DollarSign, Activity, RefreshCw, Wallet,
  Shield, Zap, ArrowUpRight, ArrowDownRight, ArrowLeft, Clock, PieChart,
  BarChart3, X, AlertTriangle, CheckCircle, Percent, Layers, Award,
  ChevronRight, Eye, Lock, Unlock
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'

const REFRESH_INTERVAL = 15000

// ─── Helpers ───
const formatMoney = (val) => {
  const num = parseFloat(val || 0)
  if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
  if (Math.abs(num) >= 1000) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${num.toFixed(2)}`
}

const formatPercent = (val) => `${parseFloat(val || 0).toFixed(2)}%`

const formatDate = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateTime = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Animated Number ───
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

// ─── SVG Donut Chart ───
const PoolDonut = ({ segments = [], size = 140, strokeWidth = 14 }) => {
  const r = (size / 2) - strokeWidth
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0)
  if (total === 0) return null

  let offset = 0
  const arcs = segments.map((seg, i) => {
    const pct = seg.value / total
    const dash = pct * circ
    const arc = (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'all 0.7s ease' }}
      />
    )
    offset += dash
    return arc
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} opacity="0.3" />
      {arcs}
    </svg>
  )
}

// ─── Status Badge ───
const StatusBadge = ({ status }) => {
  const styles = {
    active: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'Active' },
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Pending' },
    withdrawn: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', border: 'rgba(107,114,128,0.3)', label: 'Withdrawn' },
    settled: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)', label: 'Settled' },
  }
  const s = styles[status] || styles.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

const PammPage = () => {
  const [activeTab, setActiveTab] = useState('pools')
  const [pools, setPools] = useState([])
  const [investments, setInvestments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Detail view
  const [selectedPool, setSelectedPool] = useState(null)
  const [poolDetail, setPoolDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Invest modal
  const [investModal, setInvestModal] = useState({ isOpen: false, pool: null })
  const [investAmount, setInvestAmount] = useState('')
  const [walletBalance, setWalletBalance] = useState(null)
  const [isInvesting, setIsInvesting] = useState(false)

  // Withdraw confirmation
  const [withdrawConfirm, setWithdrawConfirm] = useState(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // ─── Fetch data ───
  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true)
      else setIsRefreshing(true)
      setError(null)
      const [poolsRes, investmentsRes] = await Promise.allSettled([
        api.get('/pamm/pools'),
        api.get('/pamm/investments'),
      ])
      if (poolsRes.status === 'fulfilled') {
        const d = poolsRes.value.data?.data || poolsRes.value.data || []
        setPools(Array.isArray(d) ? d : d.rows || [])
      }
      if (investmentsRes.status === 'fulfilled') {
        const d = investmentsRes.value.data?.data || investmentsRes.value.data || []
        setInvestments(Array.isArray(d) ? d : d.rows || [])
      }
      if (poolsRes.status === 'rejected' && investmentsRes.status === 'rejected') {
        setError('Failed to fetch PAMM data')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch PAMM data')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData(true) }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => fetchData(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  // ─── Fetch pool detail ───
  const openPoolDetail = useCallback(async (pool) => {
    setSelectedPool(pool)
    setIsLoadingDetail(true)
    try {
      const res = await api.get(`/pamm/pools/${pool.id}`)
      setPoolDetail(res.data?.data || res.data)
    } catch (err) {
      toast.error('Failed to load pool details')
      setPoolDetail(null)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  // ─── Invest ───
  const openInvestModal = async (pool) => {
    setInvestModal({ isOpen: true, pool })
    setInvestAmount(String(pool.minInvestment || 100))
    setWalletBalance(null)
    // Fetch wallet balance
    try {
      const res = await api.get('/wallet/balance')
      const w = res.data?.data || res.data || {}
      setWalletBalance(parseFloat(w.balance) || 0)
    } catch (err) {
      console.error('Failed to fetch wallet balance:', err)
      setWalletBalance(0)
    }
  }

  const closeInvestModal = () => {
    setInvestModal({ isOpen: false, pool: null })
    setInvestAmount('')
    setWalletBalance(null)
  }

  const handleInvest = async () => {
    const pool = investModal.pool
    const amount = parseFloat(investAmount)
    if (isNaN(amount) || amount < (pool?.minInvestment || 0)) {
      toast.error(`Minimum investment is ${formatMoney(pool?.minInvestment || 0)}`)
      return
    }
    try {
      setIsInvesting(true)
      await api.post('/pamm/invest', { poolId: pool.id, amount })
      toast.success('Investment successful! Your funds have been allocated to the pool.')
      closeInvestModal()
      fetchData(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Investment failed')
    } finally {
      setIsInvesting(false)
    }
  }

  // ─── Withdraw ───
  const handleWithdraw = async (investmentId) => {
    try {
      setIsWithdrawing(true)
      await api.delete(`/pamm/investments/${investmentId}`)
      toast.success('Withdrawal request submitted successfully')
      setWithdrawConfirm(null)
      fetchData(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdrawal failed')
    } finally {
      setIsWithdrawing(false)
    }
  }

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <Loader />
      </div>
    )
  }

  // ─── Pool detail view ───
  if (selectedPool) {
    const pool = poolDetail || selectedPool
    const positions = pool.livePositions || []
    const settlements = pool.settlements || []
    const totalPL = positions.reduce((s, p) => s + parseFloat(p.profit || 0), 0)
    const managerName = pool.user ? `${pool.user.firstName || ''} ${pool.user.lastName || ''}`.trim() : 'Manager'

    return (
      <motion.div variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Back button */}
        <button
          onClick={() => { setSelectedPool(null); setPoolDetail(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px',
            color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.target.style.color = '#8b5cf6'}
          onMouseLeave={e => e.target.style.color = '#94a3b8'}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Back to PAMM Pools
        </button>

        {/* Detail Hero */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: '16px',
          background: 'linear-gradient(135deg, #581c87, #7c3aed, #4c1d95)',
          padding: '32px',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '300px', height: '300px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent)',
            borderRadius: '50%', filter: 'blur(60px)'
          }} />
          <div style={{
            position: 'absolute', bottom: '-40px', left: '-20px', width: '200px', height: '200px',
            background: 'radial-gradient(circle, rgba(168,85,247,0.2), transparent)',
            borderRadius: '50%', filter: 'blur(40px)'
          }} />

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>
                    {pool.name}
                  </h1>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                    background: pool.isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                    color: pool.isActive ? '#6ee7b7' : '#fca5a5',
                    border: `1px solid ${pool.isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: pool.isActive ? '#6ee7b7' : '#fca5a5' }} />
                    {pool.isActive ? 'ACTIVE' : 'CLOSED'}
                  </span>
                </div>
                <p style={{ color: '#c4b5fd', fontSize: '14px', margin: 0 }}>
                  Managed by <strong style={{ color: '#e9d5ff' }}>{managerName}</strong>
                  {pool.account?.mt5Login && <span style={{ marginLeft: '8px', color: '#a78bfa' }}>MT5 #{pool.account.mt5Login}</span>}
                </p>
                {pool.description && (
                  <p style={{ color: '#a78bfa', fontSize: '13px', margin: '8px 0 0', maxWidth: '600px' }}>
                    {pool.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => openInvestModal(pool)}
                style={{
                  padding: '14px 28px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(139,92,246,0.4)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 32px rgba(139,92,246,0.5)' }}
                onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 24px rgba(139,92,246,0.4)' }}
              >
                <DollarSign style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                Invest in Pool
              </button>
            </div>

            {/* Detail stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '8px' }}>
              {[
                { label: 'Total AUM', value: formatMoney(pool.totalAum), icon: Wallet, accent: '#c4b5fd' },
                { label: 'Live Equity', value: formatMoney(pool.liveEquity), icon: Activity, accent: '#6ee7b7' },
                { label: 'Live Balance', value: formatMoney(pool.liveBalance), icon: DollarSign, accent: '#93c5fd' },
                { label: 'Free Margin', value: formatMoney(pool.freeMargin), icon: Shield, accent: '#fbbf24' },
                { label: 'Investors', value: pool.investorCount || 0, icon: Users, accent: '#f9a8d4' },
                { label: 'Open Positions', value: pool.openPositionCount || positions.length, icon: BarChart3, accent: '#fdba74' },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                  borderRadius: '12px', padding: '14px', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <stat.icon style={{ width: 14, height: 14, color: stat.accent }} />
                    <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>{stat.label}</span>
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: 0 }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isLoadingDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><Loader /></div>
        ) : (
          <>
            {/* Live Positions */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
              borderRadius: '16px', overflow: 'hidden',
              background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e2e8f0)'
            }} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px', borderBottom: '1px solid'
              }} className="border-slate-100 dark:border-slate-700">
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }} className="text-slate-900 dark:text-white">
                  <Activity style={{ width: 20, height: 20, color: '#10b981' }} /> Manager Live Positions
                </h3>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600
                }} className="text-green-600 dark:text-green-400">
                  <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                    <span className="animate-ping" style={{
                      position: 'absolute', display: 'inline-flex', width: '100%', height: '100%',
                      borderRadius: '50%', background: '#10b981', opacity: 0.75
                    }} />
                    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  </span>
                  Live from MT5
                </span>
              </div>

              {positions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{
                    width: 56, height: 56, margin: '0 auto 12px', borderRadius: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }} className="bg-slate-100 dark:bg-slate-700">
                    <Activity style={{ width: 28, height: 28 }} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400" style={{ fontWeight: 500, margin: 0 }}>No open positions</p>
                  <p className="text-slate-400" style={{ fontSize: '12px', marginTop: '4px' }}>The manager has no active trades right now</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        {['Symbol', 'Type', 'Volume', 'Open Price', 'Current', 'Swap', 'Profit'].map(h => (
                          <th key={h} style={{
                            textAlign: h === 'Symbol' || h === 'Type' ? 'left' : 'right',
                            padding: '12px 16px', fontSize: '11px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                          }} className="text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, idx) => {
                        const profit = parseFloat(pos.profit || 0)
                        const isBuy = (pos.type || '').toLowerCase() === 'buy'
                        return (
                          <motion.tr
                            key={pos.ticket || idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.04 }}
                            className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                            style={{ transition: 'background 0.15s' }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 700 }} className="text-slate-900 dark:text-white">
                              {(pos.symbol || '').replace(/\.#$/, '')}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                background: isBuy ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: isBuy ? '#10b981' : '#ef4444'
                              }}>
                                {isBuy ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
                                {isBuy ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }} className="text-slate-700 dark:text-slate-300">{pos.volume}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }} className="text-slate-600 dark:text-slate-400">{pos.openPrice}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }} className="text-slate-700 dark:text-slate-300">{pos.currentPrice}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }} className="text-slate-500">{parseFloat(pos.swap || 0).toFixed(2)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, color: profit >= 0 ? '#10b981' : '#ef4444' }}>
                                {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td colSpan={6} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px' }} className="text-slate-700 dark:text-slate-300">
                          Total Unrealized P&L:
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 900, fontSize: '16px', color: totalPL >= 0 ? '#10b981' : '#ef4444' }}>
                            {totalPL >= 0 ? '+' : ''}{formatMoney(totalPL)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Settlement History */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{
              borderRadius: '16px', overflow: 'hidden'
            }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div style={{ padding: '20px', borderBottom: '1px solid' }} className="border-slate-100 dark:border-slate-700">
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }} className="text-slate-900 dark:text-white">
                  <Clock style={{ width: 20, height: 20, color: '#8b5cf6' }} /> Settlement History
                </h3>
              </div>

              {settlements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{
                    width: 56, height: 56, margin: '0 auto 12px', borderRadius: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }} className="bg-slate-100 dark:bg-slate-700">
                    <Clock style={{ width: 28, height: 28 }} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-500" style={{ fontWeight: 500, margin: 0 }}>No settlements yet</p>
                  <p className="text-slate-400" style={{ fontSize: '12px', marginTop: '4px' }}>Settlements appear when profits are distributed to investors</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        {['Date', 'Start Equity', 'End Equity', 'P&L', 'Fees Collected', 'Status'].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 0 || i === 5 ? 'left' : 'right',
                            padding: '12px 16px', fontSize: '11px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                          }} className="text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((s, idx) => {
                        const pnl = parseFloat(s.totalPnl || s.pnl || 0)
                        return (
                          <tr key={s.id || idx} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '12px' }} className="text-slate-700 dark:text-slate-300">
                              {formatDate(s.settledAt || s.createdAt)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }} className="text-slate-600 dark:text-slate-400">{formatMoney(s.startEquity)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }} className="text-slate-600 dark:text-slate-400">{formatMoney(s.endEquity)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                                {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }} className="text-slate-500">{formatMoney(s.totalFees || s.fees || 0)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <StatusBadge status={s.status || 'settled'} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Pool Allocation Donut */}
            {(pool.totalAum > 0 || pool.liveEquity > 0) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{
                borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} className="text-slate-900 dark:text-white">
                  <PieChart style={{ width: 20, height: 20, color: '#8b5cf6' }} /> Pool Overview
                </h3>
                <PoolDonut
                  size={160}
                  strokeWidth={16}
                  segments={[
                    { value: parseFloat(pool.liveBalance || 0), color: '#8b5cf6' },
                    { value: Math.abs(parseFloat(pool.liveProfit || 0)), color: parseFloat(pool.liveProfit || 0) >= 0 ? '#10b981' : '#ef4444' },
                    { value: parseFloat(pool.freeMargin || 0), color: '#60a5fa' },
                  ]}
                />
                <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {[
                    { color: '#8b5cf6', label: 'Balance', val: formatMoney(pool.liveBalance) },
                    { color: parseFloat(pool.liveProfit || 0) >= 0 ? '#10b981' : '#ef4444', label: 'Floating P&L', val: formatMoney(pool.liveProfit) },
                    { color: '#60a5fa', label: 'Free Margin', val: formatMoney(pool.freeMargin) },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '12px' }} className="text-slate-600 dark:text-slate-400">{item.label}: <strong>{item.val}</strong></span>
                    </div>
                  ))}
                </div>
                {pool.totalFees > 0 && (
                  <p style={{ fontSize: '12px', marginTop: '12px', color: '#8b5cf6', fontWeight: 600 }}>
                    Total Fees Earned by Manager: {formatMoney(pool.totalFees)}
                  </p>
                )}
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    )
  }

  // ─── Computed stats ───
  const totalInvested = investments.reduce((s, inv) => s + parseFloat(inv.investedAmount || 0), 0)
  const totalEstValue = investments.reduce((s, inv) => s + parseFloat(inv.estimatedValue || 0), 0)
  const totalReturn = investments.reduce((s, inv) => s + parseFloat(inv.profitLoss || 0), 0)
  const overallReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

  // ─── MAIN RENDER ───
  return (
    <motion.div variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ═══ HERO ═══ */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: '16px',
        background: 'linear-gradient(135deg, #581c87, #7c3aed, #6d28d9, #4c1d95)',
        padding: '32px',
      }}>
        {/* Decorations */}
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px', width: '280px', height: '280px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent)',
          borderRadius: '50%', filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-40px', left: '10%', width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent)',
          borderRadius: '50%', filter: 'blur(50px)'
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(192,132,252,0.08), transparent)',
          borderRadius: '50%', filter: 'blur(80px)', transform: 'translate(-50%, -50%)'
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(139,92,246,0.4)'
                }}>
                  <Layers style={{ width: 24, height: 24, color: '#fff' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.5px' }}>
                    PAMM Pools
                  </h1>
                  <p style={{ color: '#c4b5fd', fontSize: '14px', margin: '2px 0 0' }}>
                    Profit Allocation Management Module
                  </p>
                </div>
              </div>
              <p style={{ color: '#a78bfa', fontSize: '13px', maxWidth: '500px', margin: '8px 0 0', lineHeight: '1.5' }}>
                Invest in professionally managed pools. Profits are distributed proportionally based on your share percentage at each settlement.
              </p>
            </div>

            <button
              onClick={() => fetchData(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.1)', color: '#e9d5ff',
                border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                backdropFilter: 'blur(8px)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            >
              <RefreshCw style={{ width: 14, height: 14, animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>

          {/* Summary stats */}
          {investments.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px', marginTop: '20px'
            }}>
              {[
                { label: 'Total Invested', value: formatMoney(totalInvested), icon: Wallet, accent: '#c4b5fd' },
                { label: 'Est. Value', value: formatMoney(totalEstValue), icon: Eye, accent: '#6ee7b7' },
                { label: 'Total Return', value: `${totalReturn >= 0 ? '+' : ''}${formatMoney(totalReturn)}`, icon: totalReturn >= 0 ? TrendingUp : TrendingDown, accent: totalReturn >= 0 ? '#6ee7b7' : '#fca5a5' },
                { label: 'ROI', value: `${overallReturnPct >= 0 ? '+' : ''}${overallReturnPct.toFixed(2)}%`, icon: Percent, accent: overallReturnPct >= 0 ? '#6ee7b7' : '#fca5a5' },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                  borderRadius: '12px', padding: '14px', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <stat.icon style={{ width: 14, height: 14, color: stat.accent }} />
                    <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>{stat.label}</span>
                  </div>
                  <p style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '16px', borderRadius: '12px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '14px', color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <div style={{
        display: 'flex', gap: '4px', padding: '5px',
        borderRadius: '14px', width: 'fit-content'
      }} className="bg-slate-100 dark:bg-slate-800">
        {[
          { key: 'pools', label: 'PAMM Pools', count: pools.length, icon: Layers, color: '#8b5cf6' },
          { key: 'investments', label: 'My Investments', count: investments.length, icon: Wallet, color: '#10b981' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === tab.key ? 'var(--btn-active-bg, #fff)' : 'transparent',
              color: activeTab === tab.key ? 'var(--btn-active-color, #1e293b)' : '#94a3b8',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
            className={activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}
          >
            <tab.icon style={{ width: 16, height: 16, color: activeTab === tab.key ? tab.color : undefined }} />
            {tab.label}
            <span style={{
              padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700,
              background: activeTab === tab.key ? 'rgba(139,92,246,0.1)' : undefined,
              color: activeTab === tab.key ? '#8b5cf6' : undefined,
            }} className={activeTab !== tab.key ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : ''}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: PAMM POOLS ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === 'pools' && (
          <motion.div
            key="pools"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {pools.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '64px 24px', borderRadius: '16px'
              }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div style={{
                  width: 64, height: 64, margin: '0 auto 16px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} className="bg-slate-100 dark:bg-slate-700">
                  <Layers style={{ width: 32, height: 32 }} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400" style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>No PAMM Pools Available</p>
                <p className="text-slate-400" style={{ fontSize: '13px', marginTop: '6px' }}>Check back later for new investment opportunities</p>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}
              >
                {pools.map((pool) => {
                  const managerName = pool.user ? `${pool.user.firstName || ''} ${pool.user.lastName || ''}`.trim() : 'Manager'
                  const profitVal = parseFloat(pool.liveProfit || 0)
                  const distributedPnl = parseFloat(pool.totalDistributedPnl || 0)

                  return (
                    <motion.div
                      key={pool.id}
                      variants={itemVariants}
                      style={{
                        borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                        transition: 'all 0.2s', position: 'relative'
                      }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:shadow-purple-500/5"
                      whileHover={{ y: -2 }}
                      onClick={() => openPoolDetail(pool)}
                    >
                      {/* Card header gradient bar */}
                      <div style={{
                        height: '4px',
                        background: pool.isActive
                          ? 'linear-gradient(90deg, #8b5cf6, #a855f7, #c084fc)'
                          : 'linear-gradient(90deg, #6b7280, #9ca3af)'
                      }} />

                      <div style={{ padding: '20px' }}>
                        {/* Pool name + manager */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                                {pool.name}
                              </h3>
                              {pool.isActive && (
                                <span style={{
                                  width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                                  boxShadow: '0 0 8px rgba(16,185,129,0.5)'
                                }} />
                              )}
                            </div>
                            <p style={{ fontSize: '12px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }} className="text-slate-500">
                              <Users style={{ width: 12, height: 12 }} /> {managerName}
                              {pool.account?.mt5Login && <span style={{ marginLeft: '4px' }}>| MT5 #{pool.account.mt5Login}</span>}
                            </p>
                          </div>
                          <ChevronRight style={{ width: 18, height: 18, flexShrink: 0, marginTop: '4px' }} className="text-slate-300 dark:text-slate-600" />
                        </div>

                        {/* AUM - Prominent */}
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(168,85,247,0.05))',
                          borderRadius: '12px', padding: '16px', marginBottom: '16px',
                          border: '1px solid rgba(139,92,246,0.1)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Wallet style={{ width: 14, height: 14, color: '#8b5cf6' }} />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Total AUM
                            </span>
                          </div>
                          <p style={{ fontSize: '26px', fontWeight: 900, margin: 0, color: '#8b5cf6' }}>
                            {formatMoney(pool.totalAum)}
                          </p>
                        </div>

                        {/* Key metrics grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Live Equity</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {formatMoney(pool.liveEquity)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Live Profit</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: profitVal >= 0 ? '#10b981' : '#ef4444' }}>
                              {profitVal >= 0 ? '+' : ''}{formatMoney(profitVal)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Investors</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {pool.investorCount || 0}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Settlements</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {pool.settlementCount || 0}
                            </p>
                          </div>
                        </div>

                        {/* Fee structure + min investment */}
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px'
                        }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600
                          }} className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                            <Award style={{ width: 11, height: 11 }} /> Perf: {pool.performanceFeePct || 0}%
                          </span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600
                          }} className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                            <Shield style={{ width: 11, height: 11 }} /> Mgmt: {pool.managementFeePct || 0}%
                          </span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600
                          }} className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <Lock style={{ width: 11, height: 11 }} /> Min: {formatMoney(pool.minInvestment)}
                          </span>
                        </div>

                        {/* Distributed P&L */}
                        {distributedPnl !== 0 && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: '8px', marginBottom: '16px',
                            background: distributedPnl >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                            border: `1px solid ${distributedPnl >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`
                          }}>
                            <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-slate-500">Total Distributed P&L</span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: distributedPnl >= 0 ? '#10b981' : '#ef4444' }}>
                              {distributedPnl >= 0 ? '+' : ''}{formatMoney(distributedPnl)}
                            </span>
                          </div>
                        )}

                        {/* Invest button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openInvestModal(pool) }}
                          style={{
                            width: '100%', padding: '12px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(139,92,246,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          <DollarSign style={{ width: 16, height: 16 }} /> Invest Now
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ TAB 2: MY INVESTMENTS ═══ */}
        {activeTab === 'investments' && (
          <motion.div
            key="investments"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {investments.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '64px 24px', borderRadius: '16px'
              }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div style={{
                  width: 64, height: 64, margin: '0 auto 16px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} className="bg-slate-100 dark:bg-slate-700">
                  <Wallet style={{ width: 32, height: 32 }} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400" style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>No Investments Yet</p>
                <p className="text-slate-400" style={{ fontSize: '13px', marginTop: '6px', maxWidth: '400px', margin: '6px auto 0' }}>
                  Browse available PAMM pools and start investing to see your allocations here
                </p>
                <button
                  onClick={() => setActiveTab('pools')}
                  style={{
                    marginTop: '20px', padding: '10px 24px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    color: '#fff', fontWeight: 600, fontSize: '14px', border: 'none',
                    cursor: 'pointer', boxShadow: '0 4px 16px rgba(139,92,246,0.3)'
                  }}
                >
                  Browse Pools
                </button>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}
              >
                {investments.map((inv) => {
                  const invested = parseFloat(inv.investedAmount || 0)
                  const estValue = parseFloat(inv.estimatedValue || 0)
                  const sharePct = parseFloat(inv.currentSharePct || 0)
                  const pnl = parseFloat(inv.profitLoss || 0)
                  const netReturn = parseFloat(inv.netReturn || 0)
                  const returnPct = parseFloat(inv.returnPct || 0)
                  const poolName = inv.manager?.name || inv.manager?.user ? `${inv.manager?.user?.firstName || ''} ${inv.manager?.user?.lastName || ''}`.trim() : 'Pool'

                  return (
                    <motion.div
                      key={inv.id}
                      variants={itemVariants}
                      style={{ borderRadius: '16px', overflow: 'hidden', position: 'relative' }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {/* Top gradient */}
                      <div style={{
                        height: '4px',
                        background: inv.status === 'active'
                          ? 'linear-gradient(90deg, #10b981, #059669)'
                          : 'linear-gradient(90deg, #6b7280, #9ca3af)'
                      }} />

                      <div style={{ padding: '20px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div>
                            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {inv.manager?.name || poolName}
                            </h3>
                            <p style={{ fontSize: '12px', margin: '2px 0 0' }} className="text-slate-500">
                              {poolName !== (inv.manager?.name || poolName) && poolName}
                            </p>
                          </div>
                          <StatusBadge status={inv.status} />
                        </div>

                        {/* Share % - Prominent */}
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(168,85,247,0.06))',
                          borderRadius: '12px', padding: '16px', marginBottom: '16px',
                          border: '1px solid rgba(139,92,246,0.15)', textAlign: 'center'
                        }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: '#8b5cf6', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Your Pool Share
                          </p>
                          <p style={{ fontSize: '32px', fontWeight: 900, color: '#8b5cf6', margin: 0, lineHeight: 1 }}>
                            {sharePct.toFixed(2)}%
                          </p>
                          {parseFloat(inv.manager?.totalAum) > 0 && (
                            <p style={{ fontSize: '11px', margin: '6px 0 0' }} className="text-slate-500">
                              of {formatMoney(inv.manager?.totalAum)} pool AUM
                            </p>
                          )}
                        </div>

                        {/* Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Invested</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {formatMoney(invested)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Est. Value</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                              {formatMoney(estValue)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Net Return</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: netReturn >= 0 ? '#10b981' : '#ef4444' }}>
                              {netReturn >= 0 ? '+' : ''}{formatMoney(netReturn)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', margin: '0 0 2px', fontWeight: 600 }} className="text-slate-500">Return %</p>
                            <p style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: returnPct >= 0 ? '#10b981' : '#ef4444' }}>
                              {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                            </p>
                          </div>
                        </div>

                        {/* Settlement P&L */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '8px', marginBottom: '16px',
                          background: pnl >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                          border: `1px solid ${pnl >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-slate-500">Settlement P&L</span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                            {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                          </span>
                        </div>

                        {/* Withdraw button */}
                        {inv.status === 'active' && (
                          <button
                            onClick={() => setWithdrawConfirm(inv)}
                            style={{
                              width: '100%', padding: '12px', borderRadius: '10px',
                              background: 'transparent', color: '#ef4444',
                              fontWeight: 700, fontSize: '14px',
                              border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                          >
                            <Unlock style={{ width: 16, height: 16 }} /> Withdraw
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ INVEST MODAL ═══ */}
      <AnimatePresence>
        {investModal.isOpen && investModal.pool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 50, padding: '16px'
            }}
            onClick={closeInvestModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '28px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
              }}
              className="bg-white dark:bg-slate-800"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }} className="text-slate-900 dark:text-white">
                  <Zap style={{ width: 20, height: 20, color: '#8b5cf6' }} /> Invest in Pool
                </h3>
                <button
                  onClick={closeInvestModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              {/* Pool info banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(168,85,247,0.06))',
                borderRadius: '12px', padding: '16px', marginBottom: '20px',
                border: '1px solid rgba(139,92,246,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '16px' }} className="text-slate-900 dark:text-white">
                    {investModal.pool.name}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6' }}>
                    AUM: {formatMoney(investModal.pool.totalAum)}
                  </span>
                </div>
                <p style={{ fontSize: '12px', margin: 0 }} className="text-slate-500">
                  {investModal.pool.user ? `${investModal.pool.user.firstName || ''} ${investModal.pool.user.lastName || ''}`.trim() : 'Manager'}
                  {investModal.pool.account?.mt5Login && ` | MT5 #${investModal.pool.account.mt5Login}`}
                </p>
              </div>

              {/* Wallet balance + PAMM info */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(139,92,246,0.2)' }} className="bg-purple-50 dark:bg-purple-900/20">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-purple-700 dark:text-purple-300">Wallet Balance</span>
                  <span style={{ fontSize: '16px', fontWeight: 700 }} className="text-purple-700 dark:text-purple-200">
                    {walletBalance !== null ? formatMoney(walletBalance) : '...'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', margin: 0, lineHeight: '1.4' }} className="text-purple-600 dark:text-purple-400">
                  Funds will be deducted from your wallet. Returns are credited back to your wallet when the admin runs a settlement.
                </p>
              </div>

              {/* Amount input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }} className="text-slate-700 dark:text-slate-300">
                  Investment Amount (USD)
                </label>
                <input
                  type="number"
                  value={investAmount}
                  onChange={e => setInvestAmount(e.target.value)}
                  min={investModal.pool.minInvestment || 0}
                  step="0.01"
                  placeholder={`Min: ${formatMoney(investModal.pool.minInvestment)}`}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: '12px',
                    fontSize: '18px', fontWeight: 700, outline: 'none',
                    transition: 'all 0.2s', boxSizing: 'border-box'
                  }}
                  className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p style={{ fontSize: '11px', marginTop: '4px' }} className="text-slate-500">
                  Minimum investment: {formatMoney(investModal.pool.minInvestment)}
                </p>
              </div>

              {/* Share preview */}
              {(() => {
                const amt = parseFloat(investAmount) || 0
                const currentAum = parseFloat(investModal.pool.totalAum) || 0
                const approxShare = amt > 0 ? (amt / (currentAum + amt)) * 100 : 0
                return approxShare > 0 ? (
                  <div style={{
                    background: 'rgba(139,92,246,0.06)', borderRadius: '10px',
                    padding: '14px', marginBottom: '16px', border: '1px solid rgba(139,92,246,0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-slate-600 dark:text-slate-400">
                        Approx. Share %
                      </span>
                      <span style={{ fontSize: '22px', fontWeight: 900, color: '#8b5cf6' }}>
                        {approxShare.toFixed(2)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', margin: '6px 0 0' }} className="text-slate-400">
                      Estimated pool ownership after investment. Actual share may vary.
                    </p>
                  </div>
                ) : null
              })()}

              {/* Fee disclosure */}
              <div style={{
                borderRadius: '10px', padding: '12px', marginBottom: '20px',
                display: 'flex', flexDirection: 'column', gap: '6px'
              }} className="bg-slate-50 dark:bg-slate-700/50">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: '#f59e0b' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-slate-700 dark:text-slate-300">Fee Disclosure</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }} className="text-slate-600 dark:text-slate-400">
                  <span>Performance Fee</span>
                  <span style={{ fontWeight: 700 }}>{investModal.pool.performanceFeePct || 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }} className="text-slate-600 dark:text-slate-400">
                  <span>Management Fee</span>
                  <span style={{ fontWeight: 700 }}>{investModal.pool.managementFeePct || 0}%</span>
                </div>
                <p style={{ fontSize: '10px', margin: '4px 0 0', lineHeight: '1.4' }} className="text-slate-400">
                  Fees are deducted from profits at settlement. No fees if no profit.
                </p>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  variant="secondary"
                  style={{ flex: 1 }}
                  onClick={closeInvestModal}
                >
                  Cancel
                </Button>
                <button
                  onClick={handleInvest}
                  disabled={isInvesting}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px',
                    background: isInvesting ? '#9ca3af' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none',
                    cursor: isInvesting ? 'not-allowed' : 'pointer',
                    boxShadow: isInvesting ? 'none' : '0 6px 20px rgba(139,92,246,0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isInvesting ? 'Investing...' : 'Confirm Investment'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ WITHDRAW CONFIRMATION MODAL ═══ */}
      <AnimatePresence>
        {withdrawConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 50, padding: '16px'
            }}
            onClick={() => setWithdrawConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                borderRadius: '20px', maxWidth: '420px', width: '100%', padding: '28px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
              }}
              className="bg-white dark:bg-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 16px', borderRadius: '16px',
                  background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <AlertTriangle style={{ width: 28, height: 28, color: '#ef4444' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 8px' }} className="text-slate-900 dark:text-white">
                  Confirm Withdrawal
                </h3>
                <p style={{ fontSize: '14px', margin: 0, lineHeight: '1.5' }} className="text-slate-500">
                  Are you sure you want to withdraw from <strong className="text-slate-700 dark:text-slate-300">{withdrawConfirm.manager?.name || 'this pool'}</strong>?
                  Your invested amount of <strong style={{ color: '#8b5cf6' }}>{formatMoney(withdrawConfirm.investedAmount)}</strong> will be processed.
                </p>
              </div>

              <div style={{
                borderRadius: '10px', padding: '12px', marginBottom: '20px',
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)'
              }}>
                <p style={{ fontSize: '12px', margin: 0, lineHeight: '1.5', color: '#b45309' }}>
                  Withdrawal may take time to process depending on the pool's settlement schedule. Your share will be calculated at the next settlement.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  variant="secondary"
                  style={{ flex: 1 }}
                  onClick={() => setWithdrawConfirm(null)}
                >
                  Cancel
                </Button>
                <button
                  onClick={() => handleWithdraw(withdrawConfirm.id)}
                  disabled={isWithdrawing}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px',
                    background: isWithdrawing ? '#9ca3af' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none',
                    cursor: isWithdrawing ? 'not-allowed' : 'pointer',
                    boxShadow: isWithdrawing ? 'none' : '0 6px 20px rgba(239,68,68,0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isWithdrawing ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default PammPage
