import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Edit2, Eye, Users, CheckCircle, XCircle, Ban,
  BarChart3, RefreshCw, Settings, StopCircle, Play, Pause,
  ChevronDown, ChevronUp, Search, Filter
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { Loader } from '../components/ui/Loader'
import { StatCard } from '../components/ui/StatCard'
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

// ─── Lot Mode labels ────────────────────────────────────────────────────────
const LOT_MODE_LABELS = {
  ratio:         'Copy Ratio',
  fixed:         'Fixed Lot',
  equity_pct:    'Equity %',
  balance_ratio: 'Balance Ratio',
  risk_pct:      'Risk %',
}

// ─── Follower Edit Modal ─────────────────────────────────────────────────────
function FollowerEditModal({ isOpen, follower, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (follower) {
      setForm({
        status:         follower.status         || 'active',
        lotMode:        follower.lotMode         || 'ratio',
        copyRatio:      follower.copyRatio       ?? 1,
        fixedLot:       follower.fixedLot        ?? '',
        equityPct:      follower.equityPct       ?? '',
        riskPct:        follower.riskPct         ?? '',
        maxLotPerTrade: follower.maxLotPerTrade  ?? '',
        allocationAmount: follower.allocationAmount ?? '',
      })
    }
  }, [follower])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        status:           form.status,
        lotMode:          form.lotMode,
        allocationAmount: parseFloat(form.allocationAmount) || undefined,
        maxLotPerTrade:   form.maxLotPerTrade !== '' ? parseFloat(form.maxLotPerTrade) : null,
      }
      if (form.lotMode === 'ratio' || form.lotMode === 'balance_ratio') {
        payload.copyRatio = parseFloat(form.copyRatio) || 1
      }
      if (form.lotMode === 'fixed') {
        payload.fixedLot = parseFloat(form.fixedLot) || null
      }
      if (form.lotMode === 'equity_pct') {
        payload.equityPct = parseFloat(form.equityPct) || null
      }
      if (form.lotMode === 'risk_pct') {
        payload.riskPct = parseFloat(form.riskPct) || null
      }

      await api.put(`/admin/copy-trading/followers/${follower.id}`, payload)
      toast.success('Follower settings saved & synced to MT5 engine')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!follower) return null

  const followerName = follower.follower
    ? `${follower.follower.firstName || ''} ${follower.follower.lastName || ''}`.trim() || follower.follower.email
    : `User #${follower.followerUserId}`

  const masterName = follower.master?.displayName || `Master #${follower.masterId}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Follower — ${followerName}`} size="lg">
      <div className="space-y-4">
        {/* Info strip */}
        <div className="p-3 bg-dark-50 dark:bg-dark-800 rounded-lg text-sm space-y-1">
          <p className="text-dark-500 dark:text-dark-400">
            <span className="font-medium text-dark-700 dark:text-dark-200">Email:</span>{' '}
            {follower.follower?.email || '—'}
          </p>
          <p className="text-dark-500 dark:text-dark-400">
            <span className="font-medium text-dark-700 dark:text-dark-200">MT5 Login:</span>{' '}
            {follower.followerAccount?.mt5Login || '—'}
          </p>
          <p className="text-dark-500 dark:text-dark-400">
            <span className="font-medium text-dark-700 dark:text-dark-200">Master:</span>{' '}
            {masterName}
            {follower.master?.account?.mt5Login ? ` (MT5: ${follower.master.account.mt5Login})` : ''}
          </p>
          <p className="text-dark-500 dark:text-dark-400">
            <span className="font-medium text-dark-700 dark:text-dark-200">P&L:</span>{' '}
            <span className={parseFloat(follower.totalCopiedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
              ${parseFloat(follower.totalCopiedProfit || 0).toFixed(2)}
            </span>
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Status</label>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="active">Active — copying trades</option>
            <option value="paused">Paused — subscribed but not copying</option>
            <option value="stopped">Stopped — ended subscription</option>
          </select>
        </div>

        {/* Allocation */}
        <Input
          label="Allocation Amount ($)"
          type="number"
          value={form.allocationAmount}
          onChange={e => setForm(f => ({ ...f, allocationAmount: e.target.value }))}
          fullWidth
        />

        {/* Lot Mode */}
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Lot Sizing Mode</label>
          <select
            value={form.lotMode}
            onChange={e => setForm(f => ({ ...f, lotMode: e.target.value }))}
            className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="ratio">ratio — multiply master's lots by ratio</option>
            <option value="fixed">fixed — always use a fixed lot size</option>
            <option value="equity_pct">equity_pct — % of follower equity per trade</option>
            <option value="balance_ratio">balance_ratio — scale by balance ratio</option>
            <option value="risk_pct">risk_pct — % of balance risked per trade</option>
          </select>
        </div>

        {/* Mode-specific field */}
        {(form.lotMode === 'ratio' || form.lotMode === 'balance_ratio') && (
          <Input
            label="Copy Ratio (e.g. 1.0 = same lots as master, 0.5 = half)"
            type="number"
            step="0.01"
            min="0.01"
            value={form.copyRatio}
            onChange={e => setForm(f => ({ ...f, copyRatio: e.target.value }))}
            fullWidth
          />
        )}
        {form.lotMode === 'fixed' && (
          <Input
            label="Fixed Lot Size"
            type="number"
            step="0.01"
            min="0.01"
            value={form.fixedLot}
            onChange={e => setForm(f => ({ ...f, fixedLot: e.target.value }))}
            fullWidth
          />
        )}
        {form.lotMode === 'equity_pct' && (
          <Input
            label="Equity % per trade (e.g. 5 = 5% of equity)"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            value={form.equityPct}
            onChange={e => setForm(f => ({ ...f, equityPct: e.target.value }))}
            fullWidth
          />
        )}
        {form.lotMode === 'risk_pct' && (
          <Input
            label="Risk % of balance per trade"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            value={form.riskPct}
            onChange={e => setForm(f => ({ ...f, riskPct: e.target.value }))}
            fullWidth
          />
        )}

        {/* Max Lot Cap (always) */}
        <Input
          label="Max Lot Per Trade (hard cap — leave blank for no limit)"
          type="number"
          step="0.01"
          value={form.maxLotPerTrade}
          onChange={e => setForm(f => ({ ...f, maxLotPerTrade: e.target.value }))}
          fullWidth
        />

        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2">
          ⚡ Changes sync to the MT5 copy engine immediately — no restart required.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
            Save & Sync to MT5
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CopyTradeManagerPage() {
  const [stats, setStats] = useState({})
  const [masters, setMasters] = useState([])
  const [copyTrades, setCopyTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // Edit modal
  const [editModal, setEditModal] = useState({ isOpen: false, master: null })
  const [editForm, setEditForm] = useState({})

  // Create modal
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '', mt5Login: '', displayName: '', description: '',
    tradingStyle: '', performanceFeePct: 20, managementFee: 0,
    minInvestment: 100, maxFollowers: 100
  })

  // Approve/Reject modals
  const [approveModal, setApproveModal] = useState({ isOpen: false, master: null })
  const [approveForm, setApproveForm] = useState({ performanceFeePct: 20, maxFollowers: 100 })
  const [rejectModal, setRejectModal] = useState({ isOpen: false, master: null })
  const [rejectReason, setRejectReason] = useState('')

  // Per-master followers modal
  const [followersModal, setFollowersModal] = useState({ isOpen: false, masterId: null, masterName: '', followers: [], loading: false })

  // All followers tab
  const [allFollowers, setAllFollowers] = useState([])
  const [followersLoading, setFollowersLoading] = useState(false)
  const [followerSearch, setFollowerSearch] = useState('')
  const [followerStatusFilter, setFollowerStatusFilter] = useState('')

  // Follower edit
  const [followerEditModal, setFollowerEditModal] = useState({ isOpen: false, follower: null })

  // Copy trades tab
  const [tradesLoading, setTradesLoading] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (activeTab === 'followers' && allFollowers.length === 0) fetchAllFollowers()
    if (activeTab === 'trades' && copyTrades.length === 0) fetchCopyTrades()
  }, [activeTab])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [statsRes, mastersRes] = await Promise.allSettled([
        api.get('/admin/copy-trading/stats'),
        api.get('/admin/copy-trading/masters'),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data || {})
      if (mastersRes.status === 'fulfilled') {
        const d = mastersRes.value.data?.data?.rows || mastersRes.value.data?.data || []
        setMasters(Array.isArray(d) ? d : [])
      }
    } catch {
      toast.error('Failed to load copy trading data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllFollowers = async () => {
    try {
      setFollowersLoading(true)
      const res = await api.get('/admin/copy-trading/followers?limit=500')
      const d = res.data?.data?.rows || res.data?.data || []
      setAllFollowers(Array.isArray(d) ? d : [])
    } catch {
      toast.error('Failed to load followers')
    } finally {
      setFollowersLoading(false)
    }
  }

  const fetchCopyTrades = async () => {
    try {
      setTradesLoading(true)
      const res = await api.get('/admin/copy-trading/copy-trades?limit=100')
      const d = res.data?.data?.rows || res.data?.data || []
      setCopyTrades(Array.isArray(d) ? d : [])
    } catch {
      toast.error('Failed to load copy trades')
    } finally {
      setTradesLoading(false)
    }
  }

  // ── Approve
  const handleApprove = async () => {
    try {
      await api.put(`/admin/copy-trading/masters/${approveModal.master.id}/approve`, {
        performanceFeePct: parseFloat(approveForm.performanceFeePct) || 20,
        maxFollowers: parseInt(approveForm.maxFollowers) || 100
      })
      toast.success('Master approved')
      setApproveModal({ isOpen: false, master: null })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve')
    }
  }

  // ── Reject
  const handleReject = async () => {
    try {
      await api.put(`/admin/copy-trading/masters/${rejectModal.master.id}/reject`, { rejectionReason: rejectReason })
      toast.success('Master rejected')
      setRejectModal({ isOpen: false, master: null })
      setRejectReason('')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject')
    }
  }

  // ── Suspend
  const handleSuspend = async (masterId) => {
    if (!confirm('Suspend this master trader? All followers will stop receiving trades.')) return
    try {
      await api.put(`/admin/copy-trading/masters/${masterId}/suspend`)
      toast.success('Master suspended')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to suspend')
    }
  }

  // ── Update master
  const handleUpdate = async () => {
    try {
      await api.put(`/admin/copy-trading/masters/${editModal.master.id}`, editForm)
      toast.success('Master updated')
      setEditModal({ isOpen: false, master: null })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update')
    }
  }

  // ── Create master
  const handleCreate = async () => {
    if (!createForm.email) { toast.error('Email is required'); return }
    try {
      await api.post('/admin/copy-trading/masters', {
        ...createForm,
        mt5Login: createForm.mt5Login || undefined,
        performanceFeePct: parseFloat(createForm.performanceFeePct),
        managementFee: parseFloat(createForm.managementFee),
        minInvestment: parseFloat(createForm.minInvestment),
        maxFollowers: parseInt(createForm.maxFollowers),
      })
      toast.success('Master trader created and auto-approved')
      setCreateModal(false)
      setCreateForm({ email: '', mt5Login: '', displayName: '', description: '', tradingStyle: '', performanceFeePct: 20, managementFee: 0, minInvestment: 100, maxFollowers: 100 })
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create master')
    }
  }

  // ── View per-master followers
  const handleViewFollowers = async (master) => {
    setFollowersModal({ isOpen: true, masterId: master.id, masterName: getMasterName(master), followers: [], loading: true })
    try {
      const res = await api.get(`/admin/copy-trading/masters/${master.id}/followers`)
      const d = res.data?.data || []
      // Attach master info so edit modal can show MT5 login
      const enriched = (Array.isArray(d) ? d : []).map(f => ({ ...f, master: { id: master.id, displayName: getMasterName(master), account: master.account } }))
      setFollowersModal(prev => ({ ...prev, followers: enriched, loading: false }))
    } catch {
      setFollowersModal(prev => ({ ...prev, followers: [], loading: false }))
      toast.error('Failed to load followers')
    }
  }

  // ── Open master edit
  const openEdit = (master) => {
    setEditModal({ isOpen: true, master })
    setEditForm({
      displayName: master.displayName || '',
      description: master.description || '',
      tradingStyle: master.tradingStyle || '',
      performanceFeePct: master.performanceFeePct || 20,
      managementFee: master.managementFee || 0,
      minInvestment: master.minInvestment || 100,
      maxFollowers: master.maxFollowers || 100,
      isActive: master.isActive
    })
  }

  // ── Helpers
  const getMasterName = (master) => {
    if (master?.user) return `${master.user.firstName || ''} ${master.user.lastName || ''}`.trim() || master.displayName || 'Trader'
    return master?.displayName || 'Trader'
  }

  const getFollowerName = (f) => {
    if (f.follower) return `${f.follower.firstName || ''} ${f.follower.lastName || ''}`.trim() || f.follower.email || `User #${f.followerUserId}`
    return `User #${f.followerUserId}`
  }

  const filteredMasters = masters.filter(m => {
    if (activeTab === 'pending') return m.status === 'pending'
    if (activeTab === 'approved') return m.status === 'approved'
    if (activeTab === 'rejected') return m.status === 'rejected'
    if (activeTab === 'suspended') return m.status === 'suspended'
    return true
  })

  const filteredAllFollowers = allFollowers.filter(f => {
    const matchSearch = !followerSearch ||
      getFollowerName(f).toLowerCase().includes(followerSearch.toLowerCase()) ||
      (f.follower?.email || '').toLowerCase().includes(followerSearch.toLowerCase()) ||
      String(f.followerAccount?.mt5Login || '').includes(followerSearch) ||
      (f.master?.displayName || '').toLowerCase().includes(followerSearch.toLowerCase())
    const matchStatus = !followerStatusFilter || f.status === followerStatusFilter
    return matchSearch && matchStatus
  })

  const statusColor = (status) => {
    if (status === 'active') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    if (status === 'paused') return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
  }

  if (loading) return <div className="flex items-center justify-center min-h-96"><Loader /></div>

  const tabs = [
    { key: 'all',       label: `All (${masters.length})` },
    { key: 'pending',   label: `Pending (${masters.filter(m => m.status === 'pending').length})` },
    { key: 'approved',  label: `Approved (${masters.filter(m => m.status === 'approved').length})` },
    { key: 'rejected',  label: `Rejected (${masters.filter(m => m.status === 'rejected').length})` },
    { key: 'followers', label: `Followers (${stats.totalFollowers || 0})` },
    { key: 'trades',    label: 'Copy Trades' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Copy Trading</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Manage masters, followers, and copy trades</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={() => { fetchAll(); if (activeTab === 'followers') fetchAllFollowers() }}>Refresh</Button>
          <Button icon={Plus} onClick={() => setCreateModal(true)}>Add Master</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Masters"   value={stats.totalMasters   || 0} icon={Users} />
        <StatCard title="Pending"         value={stats.pendingMasters  || 0} icon={Users} color={stats.pendingMasters > 0 ? 'warning' : 'primary'} />
        <StatCard title="Approved"        value={stats.approvedMasters || 0} icon={CheckCircle} color="success" />
        <StatCard title="Rejected"        value={stats.rejectedMasters || 0} icon={XCircle} color="danger" />
        <StatCard title="Active Followers" value={stats.totalFollowers || 0} icon={Users} color="info" />
        <StatCard title="Copy Trades"     value={stats.totalCopyTrades || 0} icon={BarChart3} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-dark-600 dark:text-dark-400 hover:text-dark-800 dark:hover:text-dark-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Masters List ── */}
      {activeTab !== 'trades' && activeTab !== 'followers' && (
        <>
          {filteredMasters.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-dark-400 mx-auto mb-4" />
                <p className="text-dark-600 dark:text-dark-400">No master traders in this category</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredMasters.map(master => (
                <Card key={master.id}>
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50">{getMasterName(master)}</h3>
                          <p className="text-sm text-dark-500 dark:text-dark-400">
                            {master.user?.email || '—'}{master.account?.mt5Login ? ` · MT5: ${master.account.mt5Login}` : ''}
                          </p>
                          {master.displayName && <p className="text-sm text-primary-600 dark:text-primary-400">{master.displayName}</p>}
                          {master.tradingStyle && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                              {master.tradingStyle}
                            </span>
                          )}
                        </div>
                        <StatusBadge status={master.status === 'approved' ? 'active' : master.status === 'suspended' ? 'inactive' : master.status}>
                          {master.status?.toUpperCase()}
                        </StatusBadge>
                      </div>
                      {master.description && (
                        <p className="text-sm text-dark-600 dark:text-dark-400 mb-3 line-clamp-2">{master.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        <div className="bg-dark-50 dark:bg-dark-800 p-2 rounded-lg">
                          <p className="text-xs text-dark-500">Followers</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-dark-50">{master.totalFollowers || 0}</p>
                        </div>
                        <div className="bg-dark-50 dark:bg-dark-800 p-2 rounded-lg">
                          <p className="text-xs text-dark-500">Total Profit</p>
                          <p className={`text-sm font-bold ${parseFloat(master.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(master.totalProfit || 0, 'USD')}
                          </p>
                        </div>
                        <div className="bg-dark-50 dark:bg-dark-800 p-2 rounded-lg">
                          <p className="text-xs text-dark-500">Win Rate</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-dark-50">{parseFloat(master.winRate || 0).toFixed(1)}%</p>
                        </div>
                        <div className="bg-dark-50 dark:bg-dark-800 p-2 rounded-lg">
                          <p className="text-xs text-dark-500">Fee</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-dark-50">{master.performanceFeePct || 0}%</p>
                        </div>
                        <div className="bg-dark-50 dark:bg-dark-800 p-2 rounded-lg">
                          <p className="text-xs text-dark-500">Min Invest</p>
                          <p className="text-sm font-bold text-dark-900 dark:text-dark-50">${master.minInvestment || 0}</p>
                        </div>
                      </div>
                      {master.status === 'rejected' && master.rejectionReason && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-xs text-red-600 dark:text-red-400">Rejection: {master.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[140px]">
                      {master.status === 'pending' && (
                        <>
                          <Button size="sm" variant="success" icon={CheckCircle}
                            onClick={() => { setApproveModal({ isOpen: true, master }); setApproveForm({ performanceFeePct: master.performanceFeePct || 20, maxFollowers: master.maxFollowers || 100 }) }}
                            fullWidth>Approve</Button>
                          <Button size="sm" variant="danger" icon={XCircle}
                            onClick={() => setRejectModal({ isOpen: true, master })} fullWidth>Reject</Button>
                        </>
                      )}
                      {master.status === 'approved' && (
                        <>
                          <Button size="sm" variant="secondary" icon={Users}
                            onClick={() => handleViewFollowers(master)} fullWidth>
                            Followers ({master.totalFollowers || 0})
                          </Button>
                          <Button size="sm" variant="secondary" icon={Edit2}
                            onClick={() => openEdit(master)} fullWidth>Edit</Button>
                          <Button size="sm" variant="danger" icon={Ban}
                            onClick={() => handleSuspend(master.id)} fullWidth>Suspend</Button>
                        </>
                      )}
                      {(master.status === 'rejected' || master.status === 'suspended') && (
                        <Button size="sm" variant="success" icon={CheckCircle}
                          onClick={() => { setApproveModal({ isOpen: true, master }); setApproveForm({ performanceFeePct: master.performanceFeePct || 20, maxFollowers: master.maxFollowers || 100 }) }}
                          fullWidth>
                          {master.status === 'suspended' ? 'Reactivate' : 'Approve'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── All Followers Tab ── */}
      {activeTab === 'followers' && (
        <div className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search by name, email, MT5 login, or master..."
                value={followerSearch}
                onChange={e => setFollowerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={followerStatusFilter}
              onChange={e => setFollowerStatusFilter(e.target.value)}
              className="border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
            </select>
            <Button variant="secondary" icon={RefreshCw} onClick={fetchAllFollowers}>Refresh</Button>
          </div>

          {followersLoading ? (
            <div className="flex items-center justify-center p-12"><Loader /></div>
          ) : filteredAllFollowers.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-dark-400 mx-auto mb-4" />
                <p className="text-dark-600 dark:text-dark-400">
                  {allFollowers.length === 0 ? 'No followers yet' : 'No followers match your search'}
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-200 dark:border-dark-700">
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Follower</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">MT5</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Master</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Allocation</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Mode</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Ratio/Lot</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Max Lot</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">P&L</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllFollowers.map(f => (
                      <tr key={f.id} className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-dark-900 dark:text-dark-50">{getFollowerName(f)}</p>
                          <p className="text-xs text-dark-500">{f.follower?.email || '—'}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-dark-700 dark:text-dark-300">{f.followerAccount?.mt5Login || '—'}</td>
                        <td className="py-3 px-4">
                          <p className="text-dark-700 dark:text-dark-300">{f.master?.displayName || `#${f.masterId}`}</p>
                          {f.master?.account?.mt5Login && <p className="text-xs text-dark-500 font-mono">{f.master.account.mt5Login}</p>}
                        </td>
                        <td className="py-3 px-4 font-medium">${parseFloat(f.allocationAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-dark-100 dark:bg-dark-700 rounded text-xs font-medium">
                            {LOT_MODE_LABELS[f.lotMode] || f.lotMode || 'ratio'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-dark-700 dark:text-dark-300">
                          {f.lotMode === 'fixed' ? (f.fixedLot || '—') :
                           f.lotMode === 'equity_pct' ? `${f.equityPct || '—'}%` :
                           f.lotMode === 'risk_pct' ? `${f.riskPct || '—'}%` :
                           `${f.copyRatio || 1}x`}
                        </td>
                        <td className="py-3 px-4 text-dark-700 dark:text-dark-300">{f.maxLotPerTrade || '—'}</td>
                        <td className="py-3 px-4 font-bold">
                          <span className={parseFloat(f.totalCopiedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${parseFloat(f.totalCopiedProfit || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor(f.status)}`}>
                            {(f.status || 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Settings}
                            onClick={() => setFollowerEditModal({ isOpen: true, follower: f })}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-dark-500 px-4 py-2 border-t border-dark-100 dark:border-dark-800">
                Showing {filteredAllFollowers.length} of {allFollowers.length} followers
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── Copy Trades Tab ── */}
      {activeTab === 'trades' && (
        <Card>
          {tradesLoading ? (
            <div className="flex items-center justify-center p-12"><Loader /></div>
          ) : copyTrades.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-dark-400 mx-auto mb-4" />
              <p className="text-dark-600 dark:text-dark-400">No copy trades recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700">
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Master</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Action</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">M. Lots</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">F. Lots</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Open</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Close</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">P&L</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {copyTrades.map(trade => (
                    <tr key={trade.id} className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50">
                      <td className="py-3 px-4 font-medium text-dark-900 dark:text-dark-50">{trade.master?.displayName || `#${trade.masterId}`}</td>
                      <td className="py-3 px-4">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${trade.action === 'buy' ? 'text-green-600' : 'text-red-600'}`}>{trade.action?.toUpperCase()}</span>
                      </td>
                      <td className="py-3 px-4">{trade.masterLots}</td>
                      <td className="py-3 px-4">{trade.followerLots}</td>
                      <td className="py-3 px-4">{trade.openPrice || '—'}</td>
                      <td className="py-3 px-4">{trade.closePrice || '—'}</td>
                      <td className="py-3 px-4 font-bold">
                        {trade.status === 'closed' ? (
                          <span className={parseFloat(trade.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${parseFloat(trade.profit || 0).toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={trade.status === 'open' ? 'active' : trade.status === 'closed' ? 'completed' : 'failed'}>
                          {trade.status?.toUpperCase()}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-4 text-dark-500 text-xs">{trade.openedAt ? formatDate(trade.openedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Per-Master Followers Modal ── */}
      <Modal
        isOpen={followersModal.isOpen}
        onClose={() => setFollowersModal({ isOpen: false, masterId: null, masterName: '', followers: [], loading: false })}
        title={`Followers — ${followersModal.masterName}`}
        size="xl"
      >
        {followersModal.loading ? (
          <div className="flex items-center justify-center p-8"><Loader /></div>
        ) : followersModal.followers.length === 0 ? (
          <p className="text-dark-500 dark:text-dark-400 text-center py-8">No followers yet for this master</p>
        ) : (
          <div className="space-y-2">
            {followersModal.followers.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 border border-dark-200 dark:border-dark-700 rounded-lg gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-900 dark:text-dark-50 truncate">{getFollowerName(f)}</p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 truncate">
                    {f.follower?.email || '—'}{f.followerAccount?.mt5Login ? ` · MT5: ${f.followerAccount.mt5Login}` : ''}
                  </p>
                  <p className="text-xs text-dark-400 mt-0.5">
                    ${parseFloat(f.allocationAmount || 0).toLocaleString()} · {LOT_MODE_LABELS[f.lotMode] || 'ratio'}&nbsp;
                    {f.lotMode === 'fixed' ? f.fixedLot :
                     f.lotMode === 'equity_pct' ? `${f.equityPct}%` :
                     f.lotMode === 'risk_pct' ? `${f.riskPct}%` :
                     `${f.copyRatio || 1}x`}
                    {f.maxLotPerTrade ? ` · cap ${f.maxLotPerTrade}` : ''}
                    {' · '}P&L:&nbsp;
                    <span className={parseFloat(f.totalCopiedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${parseFloat(f.totalCopiedProfit || 0).toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor(f.status)}`}>
                    {(f.status || 'unknown').toUpperCase()}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Settings}
                    onClick={() => setFollowerEditModal({ isOpen: true, follower: f })}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Follower Edit Modal ── */}
      <FollowerEditModal
        isOpen={followerEditModal.isOpen}
        follower={followerEditModal.follower}
        onClose={() => setFollowerEditModal({ isOpen: false, follower: null })}
        onSaved={() => {
          // Refresh whichever list is visible
          if (activeTab === 'followers') fetchAllFollowers()
          if (followersModal.isOpen) handleViewFollowers({ id: followersModal.masterId, account: null, user: null, displayName: followersModal.masterName })
        }}
      />

      {/* ── Approve Modal ── */}
      <Modal isOpen={approveModal.isOpen} onClose={() => setApproveModal({ isOpen: false, master: null })}
        title={`Approve: ${approveModal.master ? getMasterName(approveModal.master) : ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-dark-600 dark:text-dark-400">Set terms before approving this master trader.</p>
          <Input label="Performance Fee (%)" type="number" value={approveForm.performanceFeePct}
            onChange={e => setApproveForm({ ...approveForm, performanceFeePct: e.target.value })} fullWidth />
          <Input label="Max Followers" type="number" value={approveForm.maxFollowers}
            onChange={e => setApproveForm({ ...approveForm, maxFollowers: e.target.value })} fullWidth />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setApproveModal({ isOpen: false, master: null })} fullWidth>Cancel</Button>
            <Button variant="success" onClick={handleApprove} fullWidth>Approve Master</Button>
          </div>
        </div>
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal isOpen={rejectModal.isOpen}
        onClose={() => { setRejectModal({ isOpen: false, master: null }); setRejectReason('') }}
        title={`Reject: ${rejectModal.master ? getMasterName(rejectModal.master) : ''}`}>
        <div className="space-y-4">
          <Input label="Rejection Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Explain why this application is being rejected..." fullWidth />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setRejectModal({ isOpen: false, master: null }); setRejectReason('') }} fullWidth>Cancel</Button>
            <Button variant="danger" onClick={handleReject} fullWidth>Reject</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Master Modal ── */}
      <Modal isOpen={editModal.isOpen} onClose={() => setEditModal({ isOpen: false, master: null })}
        title={`Edit: ${editModal.master ? getMasterName(editModal.master) : ''}`}>
        <div className="space-y-4">
          <Input label="Display Name" value={editForm.displayName || ''} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} fullWidth />
          <Input label="Description" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} fullWidth />
          <Input label="Trading Style" value={editForm.tradingStyle || ''} onChange={e => setEditForm({ ...editForm, tradingStyle: e.target.value })} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Performance Fee (%)" type="number" value={editForm.performanceFeePct || 0} onChange={e => setEditForm({ ...editForm, performanceFeePct: parseFloat(e.target.value) })} fullWidth />
            <Input label="Management Fee ($)" type="number" value={editForm.managementFee || 0} onChange={e => setEditForm({ ...editForm, managementFee: parseFloat(e.target.value) })} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Investment ($)" type="number" value={editForm.minInvestment || 100} onChange={e => setEditForm({ ...editForm, minInvestment: parseFloat(e.target.value) })} fullWidth />
            <Input label="Max Followers" type="number" value={editForm.maxFollowers || 100} onChange={e => setEditForm({ ...editForm, maxFollowers: parseInt(e.target.value) })} fullWidth />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditModal({ isOpen: false, master: null })} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleUpdate} fullWidth>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Create Master Modal ── */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Add Master Trader">
        <div className="space-y-4">
          <p className="text-sm text-dark-500 dark:text-dark-400">Create a master trader directly (auto-approved).</p>
          <Input label="User Email *" type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="trader@example.com" fullWidth />
          <Input label="MT5 Login (Master Account)" type="text" value={createForm.mt5Login} onChange={e => setCreateForm({ ...createForm, mt5Login: e.target.value })} placeholder="Leave blank to auto-pick first MT5 account" fullWidth />
          <Input label="Display Name" value={createForm.displayName} onChange={e => setCreateForm({ ...createForm, displayName: e.target.value })} placeholder="Gold Scalper Pro" fullWidth />
          <Input label="Description" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Strategy description" fullWidth />
          <Input label="Trading Style" value={createForm.tradingStyle} onChange={e => setCreateForm({ ...createForm, tradingStyle: e.target.value })} placeholder="Scalping, Day Trading, etc." fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Performance Fee (%)" type="number" value={createForm.performanceFeePct} onChange={e => setCreateForm({ ...createForm, performanceFeePct: e.target.value })} fullWidth />
            <Input label="Management Fee ($)" type="number" value={createForm.managementFee} onChange={e => setCreateForm({ ...createForm, managementFee: e.target.value })} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Investment ($)" type="number" value={createForm.minInvestment} onChange={e => setCreateForm({ ...createForm, minInvestment: e.target.value })} fullWidth />
            <Input label="Max Followers" type="number" value={createForm.maxFollowers} onChange={e => setCreateForm({ ...createForm, maxFollowers: e.target.value })} fullWidth />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} fullWidth>Create Master</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
