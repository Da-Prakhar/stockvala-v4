import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, ArrowUpRight, ArrowDownRight, Send, RefreshCw, TrendingUp,
  DollarSign, CreditCard, Building2, ArrowRightLeft, X, Eye, EyeOff,
  ChevronRight, Clock, CheckCircle, AlertTriangle, Zap, PieChart,
  ArrowUp, ArrowDown, Landmark, Monitor
} from 'lucide-react'
import Button from '../components/ui/Button'
import api from '../utils/api'
import toast from 'react-hot-toast'

const REFRESH_INTERVAL = 30000

const formatMoney = (v) => {
  const n = parseFloat(v) || 0
  return n < 0 ? `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

// Transaction type config
const txnConfig = {
  deposit: { label: 'Deposit', icon: ArrowDown, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUp, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  transfer: { label: 'Transfer', icon: ArrowRightLeft, color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  commission: { label: 'Commission', icon: Zap, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  rebate: { label: 'Rebate', icon: TrendingUp, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  pamm_invest: { label: 'PAMM Invest', icon: PieChart, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  pamm_payout: { label: 'PAMM Payout', icon: DollarSign, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  pamm_refund: { label: 'PAMM Refund', icon: ArrowDownRight, color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
}

const WalletPage = () => {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [balanceHidden, setBalanceHidden] = useState(false)

  // Modals
  const [activeModal, setActiveModal] = useState(null) // 'deposit' | 'withdraw' | 'fundMt5' | 'withdrawMt5' | 'transfer'
  const [modalAmount, setModalAmount] = useState('')
  const [modalMt5AccountId, setModalMt5AccountId] = useState('')
  const [modalToUserId, setModalToUserId] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // ─── Fetch ───
  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true)
      else setIsRefreshing(true)

      const [summaryRes, txnRes] = await Promise.allSettled([
        api.get('/wallet/summary'),
        api.get('/wallet/transactions?limit=50')
      ])

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data?.data || summaryRes.value.data)
      }
      if (txnRes.status === 'fulfilled') {
        const d = txnRes.value.data?.data || txnRes.value.data || []
        setTransactions(Array.isArray(d) ? d : d.rows || [])
      }
    } catch (err) {
      console.error('Wallet fetch error:', err)
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

  // ─── Actions ───
  const closeModal = () => {
    setActiveModal(null)
    setModalAmount('')
    setModalMt5AccountId('')
    setModalToUserId('')
    setModalDescription('')
  }

  const handleAction = async () => {
    const amount = parseFloat(modalAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    try {
      setIsProcessing(true)
      let res

      switch (activeModal) {
        case 'deposit':
          res = await api.post('/wallet/deposit', { amount })
          break
        case 'withdraw':
          res = await api.post('/wallet/withdraw', { amount })
          break
        case 'fundMt5':
          if (!modalMt5AccountId) { toast.error('Select an MT5 account'); return }
          res = await api.post('/wallet/fund-account', { mt5AccountId: parseInt(modalMt5AccountId), amount })
          break
        case 'withdrawMt5':
          if (!modalMt5AccountId) { toast.error('Select an MT5 account'); return }
          res = await api.post('/wallet/withdraw-mt5', { mt5AccountId: parseInt(modalMt5AccountId), amount })
          break
        case 'transfer':
          if (!modalToUserId) { toast.error('Enter recipient User ID'); return }
          res = await api.post('/wallet/transfer', { amount, toUserId: modalToUserId, description: modalDescription })
          break
        default:
          return
      }

      toast.success(res.data?.message || 'Success!')
      closeModal()
      fetchData(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── Loading ───
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }} className="text-slate-500">Loading wallet...</p>
        </div>
      </div>
    )
  }

  const balance = summary?.balance || 0
  const mt5Accounts = summary?.mt5Accounts || []

  const quickActions = [
    { key: 'deposit', label: 'Deposit', icon: ArrowDown, color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
    { key: 'withdraw', label: 'Withdraw', icon: ArrowUp, color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
    { key: 'fundMt5', label: 'Fund MT5', icon: Monitor, color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
    { key: 'withdrawMt5', label: 'MT5 → Wallet', icon: Landmark, color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { key: 'transfer', label: 'Transfer', icon: Send, color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: '1200px', margin: '0 auto', padding: '0' }}
    >
      {/* ─── Balance Card ─── */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <div style={{
          borderRadius: '20px', overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4f46e5 100%)',
          padding: '32px', marginBottom: '24px', color: 'white'
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 200, height: 200,
            borderRadius: '50%', background: 'rgba(255,255,255,0.05)'
          }} />
          <div style={{
            position: 'absolute', bottom: -40, left: -40, width: 150, height: 150,
            borderRadius: '50%', background: 'rgba(255,255,255,0.03)'
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>Total Balance</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setBalanceHidden(!balanceHidden)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'white' }}
                >
                  {balanceHidden ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
                <button
                  onClick={() => fetchData(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'white' }}
                >
                  <RefreshCw style={{ width: 16, height: 16, animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            <h1 style={{ fontSize: '42px', fontWeight: 900, margin: '8px 0 16px', letterSpacing: '-1px' }}>
              {balanceHidden ? '••••••' : formatMoney(balance)}
            </h1>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '11px', opacity: 0.5, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Deposits</p>
                <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#86efac' }}>
                  {balanceHidden ? '••••' : formatMoney(summary?.totalDeposits || 0)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', opacity: 0.5, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Withdrawals</p>
                <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fca5a5' }}>
                  {balanceHidden ? '••••' : formatMoney(summary?.totalWithdrawals || 0)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', opacity: 0.5, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAMM Payouts</p>
                <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#c4b5fd' }}>
                  {balanceHidden ? '••••' : formatMoney(summary?.pammPayouts || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Quick Actions ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {quickActions.map(action => (
            <motion.button
              key={action.key}
              variants={itemVariants}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (action.key === 'deposit') { navigate('/fund/deposit'); return }
                if (action.key === 'withdraw') { navigate('/fund/withdraw'); return }
                setActiveModal(action.key)
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                padding: '20px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                background: 'transparent', transition: 'all 0.2s'
              }}
              className="bg-white dark:bg-slate-800 hover:shadow-lg border border-slate-100 dark:border-slate-700"
            >
              <div style={{
                width: 48, height: 48, borderRadius: '14px', background: action.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <action.icon style={{ width: 22, height: 22 }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }} className="text-slate-700 dark:text-slate-300">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ─── MT5 Accounts ─── */}
      {mt5Accounts.length > 0 && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px' }} className="text-slate-900 dark:text-white">
            Linked MT5 Accounts
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {mt5Accounts.map(acc => (
              <div
                key={acc.id}
                style={{
                  padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px',
                  border: '1px solid', transition: 'all 0.2s'
                }}
                className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
              >
                <div style={{
                  width: 42, height: 42, borderRadius: '12px',
                  background: acc.accountType === 'demo' ? 'linear-gradient(135deg,#94a3b8,#64748b)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0
                }}>
                  <Monitor style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                    MT5 #{acc.mt5Login}
                  </p>
                  <p style={{ fontSize: '11px', margin: '2px 0 0', textTransform: 'uppercase', fontWeight: 600 }} className="text-slate-400">
                    {acc.accountType}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                    {balanceHidden ? '••••' : formatMoney(acc.liveBalance || acc.balance || 0)}
                  </p>
                  {acc.liveEquity > 0 && acc.liveEquity !== acc.liveBalance && (
                    <p style={{ fontSize: '11px', margin: '2px 0 0' }} className="text-slate-400">
                      Eq: {formatMoney(acc.liveEquity)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Transaction History ─── */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <div style={{
          borderRadius: '16px', overflow: 'hidden', border: '1px solid'
        }} className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
          <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
              Transaction History
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-slate-400">
              {transactions.length} transactions
            </span>
          </div>

          {transactions.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '16px', background: 'rgba(99,102,241,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
              }}>
                <Clock style={{ width: 24, height: 24, color: '#6366f1' }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }} className="text-slate-700 dark:text-slate-300">No transactions yet</p>
              <p style={{ fontSize: '12px', margin: 0 }} className="text-slate-400">Deposit funds to get started</p>
            </div>
          ) : (
            <div style={{ padding: '0 12px 12px' }}>
              {transactions.map((txn, i) => {
                const conf = txnConfig[txn.type] || { label: txn.type, icon: DollarSign, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' }
                const TxnIcon = conf.icon
                const amount = parseFloat(txn.amount) || 0
                const isPositive = amount >= 0

                return (
                  <div
                    key={txn.id || i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 8px', borderRadius: '12px', transition: 'background 0.15s',
                      borderBottom: i < transactions.length - 1 ? '1px solid' : 'none'
                    }}
                    className="border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '12px', background: conf.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <TxnIcon style={{ width: 18, height: 18, color: conf.color }} />
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }} className="text-slate-900 dark:text-white">
                          {conf.label}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                          background: conf.bg, color: conf.color, textTransform: 'uppercase'
                        }}>
                          {txn.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '11px', margin: '3px 0 0', maxWidth: '400px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }} className="text-slate-400">
                        {txn.description || '—'}
                      </p>
                    </div>

                    {/* Amount + date */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{
                        fontSize: '14px', fontWeight: 800, margin: 0,
                        color: isPositive ? '#10b981' : '#ef4444'
                      }}>
                        {isPositive ? '+' : ''}{formatMoney(amount)}
                      </p>
                      <p style={{ fontSize: '10px', margin: '2px 0 0' }} className="text-slate-400">
                        {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                      {txn.balanceAfter != null && (
                        <p style={{ fontSize: '10px', margin: '1px 0 0' }} className="text-slate-300 dark:text-slate-500">
                          Bal: {formatMoney(txn.balanceAfter)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Modal ─── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '440px', borderRadius: '20px', overflow: 'hidden'
              }}
              className="bg-white dark:bg-slate-800"
            >
              {/* Modal header */}
              <div style={{
                padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid'
              }} className="border-slate-100 dark:border-slate-700">
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }} className="text-slate-900 dark:text-white">
                  {activeModal === 'deposit' && 'Deposit to Wallet'}
                  {activeModal === 'withdraw' && 'Withdraw from Wallet'}
                  {activeModal === 'fundMt5' && 'Fund MT5 Account'}
                  {activeModal === 'withdrawMt5' && 'MT5 → Wallet'}
                  {activeModal === 'transfer' && 'Transfer to User'}
                </h3>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} className="text-slate-400 hover:text-slate-600">
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {/* Current balance */}
                <div style={{
                  padding: '12px 16px', borderRadius: '12px', marginBottom: '20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: '1px solid'
                }} className="bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-600">
                  <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-slate-500">Wallet Balance</span>
                  <span style={{ fontSize: '18px', fontWeight: 900 }} className="text-slate-900 dark:text-white">{formatMoney(balance)}</span>
                </div>

                {/* MT5 account selector (for fund/withdraw MT5) */}
                {(activeModal === 'fundMt5' || activeModal === 'withdrawMt5') && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }} className="text-slate-600 dark:text-slate-400">
                      MT5 Account
                    </label>
                    {mt5Accounts.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '10px', fontSize: '13px' }} className="bg-red-50 dark:bg-red-900/20 text-red-500">
                        No MT5 accounts found. Create one first.
                      </div>
                    ) : (
                      <select
                        value={modalMt5AccountId}
                        onChange={e => setModalMt5AccountId(e.target.value)}
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                          fontWeight: 600, outline: 'none', border: '1px solid', cursor: 'pointer'
                        }}
                        className="border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="">Select MT5 account...</option>
                        {mt5Accounts.map(acc => (
                          <option key={acc.id} value={String(acc.id)}>
                            MT5 #{acc.mt5Login} — {(acc.accountType || '').toUpperCase()} — Balance: {formatMoney(acc.liveBalance || 0)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Recipient (for transfer) */}
                {activeModal === 'transfer' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }} className="text-slate-600 dark:text-slate-400">
                      Recipient User ID
                    </label>
                    <input
                      type="text"
                      value={modalToUserId}
                      onChange={e => setModalToUserId(e.target.value)}
                      placeholder="Enter user ID"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                        fontWeight: 600, outline: 'none', border: '1px solid', boxSizing: 'border-box'
                      }}
                      className="border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', marginTop: '12px' }} className="text-slate-600 dark:text-slate-400">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={modalDescription}
                      onChange={e => setModalDescription(e.target.value)}
                      placeholder="What's this for?"
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                        outline: 'none', border: '1px solid', boxSizing: 'border-box'
                      }}
                      className="border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Amount */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }} className="text-slate-600 dark:text-slate-400">
                    Amount (USD)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '18px', fontWeight: 800
                    }} className="text-slate-400">$</span>
                    <input
                      type="number"
                      value={modalAmount}
                      onChange={e => setModalAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%', padding: '14px 16px 14px 36px', borderRadius: '12px', fontSize: '18px',
                        fontWeight: 800, outline: 'none', border: '2px solid', boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                      className="border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:border-indigo-500"
                    />
                  </div>

                  {/* Quick amount buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    {[100, 500, 1000, 5000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setModalAmount(String(amt))}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                          fontWeight: 700, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        className="border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        ${amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info box for withdraw */}
                {activeModal === 'withdraw' && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '12px', border: '1px solid rgba(245,158,11,0.2)' }} className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                    <AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 6 }} />
                    Withdrawal processing takes 1-3 business days.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                      border: '1px solid', cursor: 'pointer', background: 'transparent'
                    }}
                    className="border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={isProcessing}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                      border: 'none', cursor: isProcessing ? 'wait' : 'pointer', color: 'white',
                      background: quickActions.find(a => a.key === activeModal)?.gradient || 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      opacity: isProcessing ? 0.7 : 1
                    }}
                  >
                    {isProcessing ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Processing...
                      </span>
                    ) : (
                      <>
                        {activeModal === 'deposit' && 'Deposit'}
                        {activeModal === 'withdraw' && 'Withdraw'}
                        {activeModal === 'fundMt5' && 'Fund Account'}
                        {activeModal === 'withdrawMt5' && 'Transfer to Wallet'}
                        {activeModal === 'transfer' && 'Send Transfer'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default WalletPage
