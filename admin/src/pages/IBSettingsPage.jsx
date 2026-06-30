import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Pencil, Trash2, Save, X, Users, DollarSign,
  BarChart3, TrendingUp, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const tabs = ['Commission Levels', 'IB Network', 'Commission History']

const statCard = (label, value, sub, color) => (
  <div className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700">
    <p className="text-sm text-dark-500 dark:text-dark-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-dark-400 mt-0.5">{sub}</p>}
  </div>
)

// ─── Commission Level Row ─────────────────────────────────────────────────────
const LevelRow = ({ level, onEdit, onDelete }) => {
  const isPerLot = level.commissionMode === 'per_lot'
  return (
    <tr className="border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/30 transition-colors">
      <td className="px-4 py-3 font-semibold text-dark-900 dark:text-dark-50">Level {level.level}</td>
      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{parseFloat(level.depositCommissionPercent || 0).toFixed(2)}%</td>
      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">
        {isPerLot ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">$/lot</span>
            ${parseFloat(level.perLotCommission || 0).toFixed(2)}
          </span>
        ) : (
          `${parseFloat(level.tradingCommissionPercent || 0).toFixed(2)}%`
        )}
      </td>
      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{parseFloat(level.referralBonusPercent || 0).toFixed(2)}%</td>
      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{level.minReferralsRequired || 0}</td>
      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">
        {level.minMonthlyDeposits ? `$${parseFloat(level.minMonthlyDeposits).toFixed(0)}` : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${level.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {level.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(level)} className="p-1.5 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
            <Pencil className="w-4 h-4 text-primary-600" />
          </button>
          <button onClick={() => onDelete(level)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Level Modal ─────────────────────────────────────────────────────────────
const LevelModal = ({ level, onClose, onSave }) => {
  const isEdit = !!level?.id
  const [form, setForm] = useState({
    level: level?.level || '',
    depositCommissionPercent: level?.depositCommissionPercent || '0',
    tradingCommissionPercent: level?.tradingCommissionPercent || '0',
    commissionMode: level?.commissionMode || 'percentage',
    perLotCommission: level?.perLotCommission || '0',
    referralBonusPercent: level?.referralBonusPercent || '0',
    minReferralsRequired: level?.minReferralsRequired || '0',
    minMonthlyDeposits: level?.minMonthlyDeposits || '',
    bonusAmount: level?.bonusAmount || '',
    description: level?.description || '',
    isActive: level?.isActive !== false,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!isEdit && !form.level) return toast.error('Level number is required')
    try {
      setSaving(true)
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, type = 'number', extra = {}) => (
    <div>
      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 text-sm"
        {...extra}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-bold text-dark-900 dark:text-dark-50">
            {isEdit ? `Edit Level ${level.level}` : 'Add Commission Level'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg">
            <X className="w-5 h-5 text-dark-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {!isEdit && field('Level Number *', 'level', 'number', { min: 1, placeholder: 'e.g. 1' })}
            {field('Deposit Commission %', 'depositCommissionPercent', 'number', { min: 0, max: 100, step: '0.01', placeholder: '0.00' })}
          </div>

          {/* Trading commission mode */}
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Trading Commission Mode</label>
            <div className="flex rounded-lg overflow-hidden border border-dark-200 dark:border-dark-600">
              {[{ value: 'percentage', label: '% of Profit' }, { value: 'per_lot', label: '$ per Lot' }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, commissionMode: opt.value }))}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.commissionMode === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {form.commissionMode === 'percentage'
              ? field('Trading Commission %', 'tradingCommissionPercent', 'number', { min: 0, max: 100, step: '0.01', placeholder: '0.00' })
              : field('Commission per Lot ($)', 'perLotCommission', 'number', { min: 0, step: '0.0001', placeholder: '0.00' })
            }
            {field('Referral Bonus %', 'referralBonusPercent', 'number', { min: 0, max: 100, step: '0.01', placeholder: '0.00' })}
            {field('Min Referrals Required', 'minReferralsRequired', 'number', { min: 0 })}
            {field('Min Monthly Deposits ($)', 'minMonthlyDeposits', 'number', { min: 0, placeholder: 'Optional' })}
            {field('One-time Bonus ($)', 'bonusAmount', 'number', { min: 0, placeholder: 'Optional' })}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description for this level"
              className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <label htmlFor="isActive" className="text-sm text-dark-700 dark:text-dark-300">Active</label>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-dark-200 dark:border-dark-600 text-dark-700 dark:text-dark-300 text-sm font-medium hover:bg-dark-50 dark:hover:bg-dark-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Level'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:   { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
    approved:  { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   icon: <CheckCircle className="w-3 h-3" /> },
    paid:      { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
    forfeited: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       icon: <AlertCircle className="w-3 h-3" /> },
  }
  const { color, icon } = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {icon}{status}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const IBSettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [levels, setLevels] = useState([])
  const [network, setNetwork] = useState([])
  const [commissions, setCommissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Pagination
  const [networkPage, setNetworkPage] = useState(1)
  const [networkTotal, setNetworkTotal] = useState(0)
  const [commPage, setCommPage] = useState(1)
  const [commTotal, setCommTotal] = useState(0)
  const [commFilter, setCommFilter] = useState({ status: '', type: '' })

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editLevel, setEditLevel] = useState(null)

  const fetchStats = async () => {
    try {
      const r = await api.get('/admin/ib/stats')
      setStats(r.data?.data || {})
    } catch (_) {}
  }

  const fetchLevels = async () => {
    try {
      const r = await api.get('/admin/ib/levels')
      setLevels(r.data?.data || [])
    } catch (_) {}
  }

  const fetchNetwork = async (page = 1) => {
    try {
      const r = await api.get(`/admin/ib/network?page=${page}&limit=20`)
      const d = r.data?.data
      setNetwork(d?.rows || [])
      setNetworkTotal(d?.total || 0)
    } catch (_) {}
  }

  const fetchCommissions = async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (commFilter.status) params.set('status', commFilter.status)
      if (commFilter.type) params.set('type', commFilter.type)
      const r = await api.get(`/admin/ib/commissions?${params}`)
      const d = r.data?.data
      setCommissions(d?.rows || [])
      setCommTotal(d?.total || 0)
    } catch (_) {}
  }

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([fetchStats(), fetchLevels(), fetchNetwork(), fetchCommissions()])
      setIsLoading(false)
    }
    init()
  }, [])

  useEffect(() => { fetchCommissions(commPage) }, [commFilter, commPage])

  const handleSaveLevel = async (form) => {
    try {
      if (editLevel?.id) {
        await api.put(`/admin/ib/levels/${editLevel.id}`, form)
        toast.success('Level updated')
      } else {
        await api.post('/admin/ib/levels', form)
        toast.success('Level created')
      }
      setShowModal(false)
      setEditLevel(null)
      fetchLevels()
      fetchStats()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save level')
      throw e
    }
  }

  const handleDeleteLevel = async (level) => {
    if (!window.confirm(`Delete Level ${level.level}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/ib/levels/${level.id}`)
      toast.success('Level deleted')
      fetchLevels()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete')
    }
  }

  const handleCommissionStatus = async (commissionId, status) => {
    try {
      await api.put(`/admin/ib/commissions/${commissionId}/status`, { status })
      toast.success(`Commission marked as ${status}`)
      fetchCommissions(commPage)
      fetchStats()
    } catch (e) {
      toast.error('Failed to update status')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-50">IB / Referral Program</h1>
        <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">Configure commission levels and manage the IB network</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard('Total IBs', stats?.totalIBs || 0, 'All registered IBs', 'text-blue-600 dark:text-blue-400')}
        {statCard('Active IBs', stats?.activeIBs || 0, null, 'text-green-600 dark:text-green-400')}
        {statCard('Pending Commissions', `$${parseFloat(stats?.totalPending || 0).toFixed(2)}`, 'Awaiting payout', 'text-yellow-600 dark:text-yellow-400')}
        {statCard('Total Paid', `$${parseFloat(stats?.totalPaid || 0).toFixed(2)}`, 'All time paid out', 'text-primary-600 dark:text-primary-400')}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700">
        <div className="flex border-b border-dark-200 dark:border-dark-700">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === i
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab 0: Commission Levels ── */}
        {activeTab === 0 && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-dark-900 dark:text-dark-50">Commission Tiers</h3>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                  Set deposit %, trading volume %, and referral bonus for each IB level
                </p>
              </div>
              <button
                onClick={() => { setEditLevel(null); setShowModal(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add Level
              </button>
            </div>

            {levels.length === 0 ? (
              <div className="text-center py-12 text-dark-400">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No commission levels configured yet.</p>
                <p className="text-sm mt-1">Click <strong>Add Level</strong> to create your first tier.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-dark-500 dark:text-dark-400 border-b border-dark-200 dark:border-dark-700">
                      <th className="px-4 pb-3 font-medium">Level</th>
                      <th className="px-4 pb-3 font-medium">Deposit %</th>
                      <th className="px-4 pb-3 font-medium">Trading Vol %</th>
                      <th className="px-4 pb-3 font-medium">Referral Bonus %</th>
                      <th className="px-4 pb-3 font-medium">Min Referrals</th>
                      <th className="px-4 pb-3 font-medium">Min Monthly Dep</th>
                      <th className="px-4 pb-3 font-medium">Status</th>
                      <th className="px-4 pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map(l => (
                      <LevelRow
                        key={l.id}
                        level={l}
                        onEdit={l => { setEditLevel(l); setShowModal(true) }}
                        onDelete={handleDeleteLevel}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Info box */}
            <div className="mt-5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
              <strong>How it works:</strong>
              <ul className="mt-1 list-disc list-inside space-y-1 text-xs">
                <li><strong>Deposit %</strong> — commission earned when a referred user makes a deposit</li>
                <li><strong>Trading Vol %</strong> — commission on every trade executed by referred users</li>
                <li><strong>Referral Bonus %</strong> — extra bonus when IB brings a new referred user</li>
                <li><strong>Min Referrals</strong> — number of referrals required to unlock this level</li>
                <li><strong>Min Monthly Deposits</strong> — minimum total deposits by referrals per month to maintain this level</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Tab 1: IB Network ── */}
        {activeTab === 1 && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-dark-900 dark:text-dark-50">IB Network ({networkTotal})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-500 dark:text-dark-400 border-b border-dark-200 dark:border-dark-700">
                    <th className="px-4 pb-3 font-medium">IB</th>
                    <th className="px-4 pb-3 font-medium">IB Code</th>
                    <th className="px-4 pb-3 font-medium">Level</th>
                    <th className="px-4 pb-3 font-medium">Referrals</th>
                    <th className="px-4 pb-3 font-medium">Total Commissions</th>
                    <th className="px-4 pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {network.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-dark-400">No IBs registered yet</td></tr>
                  ) : network.map(ib => (
                    <tr key={ib.id} className="border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-dark-900 dark:text-dark-50">{ib.User?.firstName} {ib.User?.lastName}</p>
                        <p className="text-xs text-dark-400">{ib.User?.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-primary-600 dark:text-primary-400">{ib.ibCode}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">Level {ib.level}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{ib.liveReferralCount || 0}</td>
                      <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                        ${parseFloat(ib.totalCommissions || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ib.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {ib.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {networkTotal > 20 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-dark-500">Page {networkPage} of {Math.ceil(networkTotal / 20)}</p>
                <div className="flex gap-2">
                  <button disabled={networkPage === 1} onClick={() => { setNetworkPage(p => p - 1); fetchNetwork(networkPage - 1) }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-dark-200 dark:border-dark-600 disabled:opacity-40">
                    Prev
                  </button>
                  <button disabled={networkPage >= Math.ceil(networkTotal / 20)} onClick={() => { setNetworkPage(p => p + 1); fetchNetwork(networkPage + 1) }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-dark-200 dark:border-dark-600 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Commission History ── */}
        {activeTab === 2 && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <select
                value={commFilter.status}
                onChange={e => { setCommFilter(p => ({ ...p, status: e.target.value })); setCommPage(1) }}
                className="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="forfeited">Forfeited</option>
              </select>
              <select
                value={commFilter.type}
                onChange={e => { setCommFilter(p => ({ ...p, type: e.target.value })); setCommPage(1) }}
                className="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 text-sm"
              >
                <option value="">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="trading">Trading</option>
                <option value="referral">Referral</option>
              </select>
              <span className="text-sm text-dark-400 self-center">{commTotal} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-500 dark:text-dark-400 border-b border-dark-200 dark:border-dark-700">
                    <th className="px-4 pb-3 font-medium">IB</th>
                    <th className="px-4 pb-3 font-medium">Type</th>
                    <th className="px-4 pb-3 font-medium">Base Amount</th>
                    <th className="px-4 pb-3 font-medium">Rate</th>
                    <th className="px-4 pb-3 font-medium">Commission</th>
                    <th className="px-4 pb-3 font-medium">Status</th>
                    <th className="px-4 pb-3 font-medium">Date</th>
                    <th className="px-4 pb-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-dark-400">No commissions found</td></tr>
                  ) : commissions.map(c => (
                    <tr key={c.id} className="border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-dark-900 dark:text-dark-50 text-xs">
                          {c.IbTree?.User?.firstName} {c.IbTree?.User?.lastName}
                        </p>
                        <p className="text-xs text-dark-400 font-mono">{c.IbTree?.ibCode}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-dark-700 dark:text-dark-300">{c.commissionType}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">${parseFloat(c.baseAmount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{parseFloat(c.commissionPercent || 0)}%</td>
                      <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                        +${parseFloat(c.commissionAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-dark-500 text-xs">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === 'pending' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCommissionStatus(c.id, 'approved')}
                              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleCommissionStatus(c.id, 'forfeited')}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
                            >
                              Forfeit
                            </button>
                          </div>
                        )}
                        {c.status === 'approved' && (
                          <button
                            onClick={() => handleCommissionStatus(c.id, 'paid')}
                            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                          >
                            Mark Paid
                          </button>
                        )}
                        {(c.status === 'paid' || c.status === 'forfeited') && (
                          <span className="text-xs text-dark-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {commTotal > 50 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-dark-500">Page {commPage} of {Math.ceil(commTotal / 50)}</p>
                <div className="flex gap-2">
                  <button disabled={commPage === 1} onClick={() => setCommPage(p => p - 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-dark-200 dark:border-dark-600 disabled:opacity-40">Prev</button>
                  <button disabled={commPage >= Math.ceil(commTotal / 50)} onClick={() => setCommPage(p => p + 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-dark-200 dark:border-dark-600 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Level Modal */}
      {showModal && (
        <LevelModal
          level={editLevel}
          onClose={() => { setShowModal(false); setEditLevel(null) }}
          onSave={handleSaveLevel}
        />
      )}
    </div>
  )
}

export default IBSettingsPage
