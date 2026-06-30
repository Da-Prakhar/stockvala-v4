import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users, TrendingUp, DollarSign, BarChart3, Eye, Trash2, Edit, RefreshCw, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Loader } from '../components/ui/Loader'
import { formatCurrency } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

const fmt = (v) => {
  const n = parseFloat(v || 0)
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MAMManagerPage() {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [investorsModal, setInvestorsModal] = useState(null)
  const [investors, setInvestors] = useState([])
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    userId: '', mt5AccountId: '', name: '', description: '',
    allocationMethod: 'percent', managementFeePct: 0, performanceFeePct: 20, minInvestment: 1000
  })
  const [editingManager, setEditingManager] = useState(null)

  useEffect(() => { fetchManagers() }, [])

  const fetchManagers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/mam/managers')
      setManagers(res.data?.data || [])
    } catch (err) {
      toast.error('Failed to load MAM managers')
    } finally { setLoading(false) }
  }

  const fetchClients = async () => {
    try {
      const res = await api.get('/admin/clients?limit=500')
      const clientsList = res.data?.data || []
      setClients(clientsList)
    } catch (err) { console.error('Failed to fetch clients:', err) }
  }

  const openCreateModal = async () => {
    await fetchClients()
    setForm({ userId: '', mt5AccountId: '', name: '', description: '', allocationMethod: 'percent', managementFeePct: 0, performanceFeePct: 20, minInvestment: 1000 })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    if (!form.userId || !form.mt5AccountId || !form.name) {
      toast.error('User, MT5 account and name are required')
      return
    }
    try {
      await api.post('/admin/mam/managers', form)
      toast.success('MAM Manager created')
      setCreateModal(false)
      fetchManagers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create manager')
    }
  }

  const handleToggleActive = async (manager) => {
    try {
      await api.put(`/admin/mam/managers/${manager.id}`, { isActive: !manager.isActive })
      toast.success(`Manager ${manager.isActive ? 'deactivated' : 'activated'}`)
      fetchManagers()
    } catch (err) {
      toast.error('Failed to update manager')
    }
  }

  const viewDetail = async (managerId) => {
    setDetailModal(managerId)
    setDetailLoading(true)
    try {
      const res = await api.get(`/mam/managers/${managerId}`)
      setDetailData(res.data?.data || null)
    } catch (err) {
      toast.error('Failed to load details')
    } finally { setDetailLoading(false) }
  }

  const viewInvestors = async (managerId) => {
    setInvestorsModal(managerId)
    try {
      const res = await api.get(`/admin/mam/managers/${managerId}/investors`)
      setInvestors(res.data?.data || [])
    } catch (err) {
      toast.error('Failed to load investors')
    }
  }

  // Get MT5 accounts for selected user
  const selectedUser = clients.find(c => String(c.id) === String(form.userId))
  const userAccounts = selectedUser?.accounts || []

  const statCards = [
    { label: 'Total Managers', value: managers.length, icon: Users, color: '#3b82f6' },
    { label: 'Active', value: managers.filter(m => m.isActive).length, icon: Activity, color: '#10b981' },
    { label: 'Total Investors', value: managers.reduce((s, m) => s + (m.investorCount || 0), 0), icon: Users, color: '#8b5cf6' },
    { label: 'Total Profit', value: fmt(managers.reduce((s, m) => s + parseFloat(m.totalProfit || 0), 0)), icon: DollarSign, color: '#f59e0b' },
  ]

  if (loading) return <div className="flex items-center justify-center min-h-96"><Loader /></div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">MAM Management</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Multi-Account Managers — trade replication to investor accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={fetchManagers}>Refresh</Button>
          <Button icon={Plus} onClick={openCreateModal}>Create Manager</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={i}>
            <div className="p-4 flex items-center gap-3">
              <div style={{ background: `${s.color}15`, color: s.color }} className="p-2 rounded-lg">
                <s.icon size={20} />
              </div>
              <div>
                <div className="text-sm text-dark-500 dark:text-dark-400">{s.label}</div>
                <div className="text-xl font-bold text-dark-900 dark:text-dark-50">{s.value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Manager Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left p-3 font-semibold text-dark-600 dark:text-dark-400">Manager</th>
                <th className="text-left p-3 font-semibold text-dark-600 dark:text-dark-400">MT5 Login</th>
                <th className="text-left p-3 font-semibold text-dark-600 dark:text-dark-400">Method</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Investors</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Trades</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Total Profit</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Fees</th>
                <th className="text-center p-3 font-semibold text-dark-600 dark:text-dark-400">Status</th>
                <th className="text-center p-3 font-semibold text-dark-600 dark:text-dark-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-dark-500">No MAM managers yet. Create one to get started.</td></tr>
              ) : managers.map(m => (
                <tr key={m.id} className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-dark-900 dark:text-dark-50">{m.name}</div>
                    <div className="text-xs text-dark-500">{m.user?.firstName} {m.user?.lastName}</div>
                  </td>
                  <td className="p-3"><span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-mono">{m.account?.mt5Login || '—'}</span></td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      m.allocationMethod === 'percent' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                      m.allocationMethod === 'equity' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>{m.allocationMethod?.toUpperCase()}</span>
                  </td>
                  <td className="p-3 text-right font-semibold">{m.investorCount || 0}</td>
                  <td className="p-3 text-right">{m.totalTrades || 0}</td>
                  <td className="p-3 text-right">
                    <span className={parseFloat(m.totalProfit) >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(m.totalProfit)}</span>
                  </td>
                  <td className="p-3 text-right text-xs text-dark-500">
                    P: {m.performanceFeePct}% / M: {m.managementFeePct}%
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={m.isActive ? 'active' : 'inactive'}>{m.isActive ? 'ACTIVE' : 'INACTIVE'}</StatusBadge>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => viewDetail(m.id)} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="View Details"><Eye size={16} /></button>
                      <button onClick={() => viewInvestors(m.id)} className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600" title="View Investors"><Users size={16} /></button>
                      <button onClick={() => handleToggleActive(m)} className="p-1.5 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600" title={m.isActive ? 'Deactivate' : 'Activate'}>
                        <Activity size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create MAM Manager">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Select Client</label>
            <select
              value={form.userId}
              onChange={(e) => {
                const uid = e.target.value
                setForm({ ...form, userId: uid, mt5AccountId: '' })
              }}
              className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800"
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
              ))}
            </select>
          </div>
          {form.userId && (
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">MT5 Account</label>
              <select
                value={form.mt5AccountId}
                onChange={(e) => setForm({ ...form, mt5AccountId: e.target.value })}
                className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800"
              >
                <option value="">Select MT5 account...</option>
                {userAccounts.map(a => (
                  <option key={a.id} value={a.id}>Login: {a.mt5Login} ({a.accountType})</option>
                ))}
              </select>
            </div>
          )}
          <Input label="Manager Display Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Gold Scalper Pro" fullWidth />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Trading strategy description..." fullWidth />
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Allocation Method</label>
            <select value={form.allocationMethod} onChange={(e) => setForm({ ...form, allocationMethod: e.target.value })}
              className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800">
              <option value="percent">Percent — investor gets X% of manager's lots</option>
              <option value="equity">Equity — proportional to equity ratio</option>
              <option value="lot">Lot — fixed lot multiplier</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Perf Fee %" type="number" value={form.performanceFeePct} onChange={(e) => setForm({ ...form, performanceFeePct: parseFloat(e.target.value) || 0 })} fullWidth />
            <Input label="Mgmt Fee %" type="number" value={form.managementFeePct} onChange={(e) => setForm({ ...form, managementFeePct: parseFloat(e.target.value) || 0 })} fullWidth />
            <Input label="Min Invest $" type="number" value={form.minInvestment} onChange={(e) => setForm({ ...form, minInvestment: parseFloat(e.target.value) || 0 })} fullWidth />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} fullWidth>Create Manager</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailModal} onClose={() => { setDetailModal(null); setDetailData(null) }} title="Manager Details">
        {detailLoading ? <div className="py-8 flex justify-center"><Loader /></div> : detailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400">Equity</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(detailData.liveEquity)}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600 dark:text-green-400">Total Profit</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(detailData.totalProfit)}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-600 dark:text-purple-400">Win Rate</div>
                <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{detailData.winRate || 0}%</div>
              </div>
            </div>
            {detailData.livePositions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">Open Positions</h4>
                <div className="border rounded-lg overflow-hidden dark:border-dark-700">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Symbol</th><th className="p-2">Type</th><th className="p-2 text-right">Lots</th><th className="p-2 text-right">Profit</th></tr></thead>
                    <tbody>
                      {detailData.livePositions.map((p, i) => (
                        <tr key={i} className="border-t dark:border-dark-700">
                          <td className="p-2 font-mono">{p.symbol}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{p.type?.toUpperCase()}</span>
                          </td>
                          <td className="p-2 text-right">{p.volume}</td>
                          <td className={`p-2 text-right font-semibold ${parseFloat(p.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Investors Modal */}
      <Modal isOpen={!!investorsModal} onClose={() => { setInvestorsModal(null); setInvestors([]) }} title="Manager Investors">
        {investors.length === 0 ? (
          <p className="py-4 text-center text-dark-500">No investors yet</p>
        ) : (
          <div className="border rounded-lg overflow-hidden dark:border-dark-700">
            <table className="w-full text-sm">
              <thead><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Investor</th><th className="p-2 text-right">Invested</th><th className="p-2 text-right">Alloc %</th><th className="p-2 text-right">Profit</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {investors.map((inv, i) => (
                  <tr key={i} className="border-t dark:border-dark-700">
                    <td className="p-2">{inv.investor?.firstName} {inv.investor?.lastName}<br /><span className="text-xs text-dark-500">MT5: {inv.investorAccount?.mt5Login}</span></td>
                    <td className="p-2 text-right">{fmt(inv.investedAmount)}</td>
                    <td className="p-2 text-right">{inv.allocationPct}%</td>
                    <td className={`p-2 text-right font-semibold ${parseFloat(inv.totalProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(inv.totalProfit)}</td>
                    <td className="p-2 text-center"><StatusBadge status={inv.status}>{inv.status?.toUpperCase()}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
