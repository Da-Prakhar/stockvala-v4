import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Users, TrendingUp, DollarSign, Eye, RefreshCw, Activity, PlayCircle, Clock, BarChart3 } from 'lucide-react'
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

export default function PAMMManagerPage() {
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [investorsModal, setInvestorsModal] = useState(null)
  const [investors, setInvestors] = useState([])
  const [settlementsModal, setSettlementsModal] = useState(false)
  const [settlements, setSettlements] = useState([])
  const [clients, setClients] = useState([])
  const [settling, setSettling] = useState(null)
  const [form, setForm] = useState({
    userId: '', mt5AccountId: '', name: '', description: '',
    performanceFeePct: 20, managementFeePct: 0, minInvestment: 1000
  })

  useEffect(() => { fetchPools() }, [])

  const fetchPools = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/pamm/pools')
      setPools(res.data?.data || [])
    } catch (err) { toast.error('Failed to load PAMM pools') }
    finally { setLoading(false) }
  }

  const fetchClients = async () => {
    try {
      const res = await api.get('/admin/clients?limit=500')
      setClients(res.data?.data || [])
    } catch (err) { console.error('Failed to fetch clients:', err) }
  }

  const openCreateModal = async () => {
    await fetchClients()
    setForm({ userId: '', mt5AccountId: '', name: '', description: '', performanceFeePct: 20, managementFeePct: 0, minInvestment: 1000 })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    if (!form.userId || !form.mt5AccountId || !form.name) {
      toast.error('User, MT5 account and name are required')
      return
    }
    try {
      await api.post('/admin/pamm/pools', form)
      toast.success('PAMM Pool created')
      setCreateModal(false)
      fetchPools()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create pool')
    }
  }

  const handleToggleActive = async (pool) => {
    try {
      await api.put(`/admin/pamm/pools/${pool.id}`, { isActive: !pool.isActive })
      toast.success(`Pool ${pool.isActive ? 'deactivated' : 'activated'}`)
      fetchPools()
    } catch (err) { toast.error('Failed to update pool') }
  }

  const handleSettle = async (poolId) => {
    setSettling(poolId)
    try {
      const res = await api.post(`/admin/pamm/pools/${poolId}/settle`)
      const settlement = res.data?.data
      toast.success(`Settlement completed! P&L: ${fmt(settlement?.totalPnl || 0)}`)
      fetchPools()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed')
    } finally { setSettling(null) }
  }

  const viewDetail = async (poolId) => {
    setDetailModal(poolId)
    setDetailLoading(true)
    try {
      const res = await api.get(`/pamm/pools/${poolId}`)
      setDetailData(res.data?.data || null)
    } catch (err) { toast.error('Failed to load details') }
    finally { setDetailLoading(false) }
  }

  const viewInvestors = async (poolId) => {
    setInvestorsModal(poolId)
    try {
      const res = await api.get(`/admin/pamm/pools/${poolId}/investors`)
      setInvestors(res.data?.data || [])
    } catch (err) { toast.error('Failed to load investors') }
  }

  const viewSettlements = async () => {
    setSettlementsModal(true)
    try {
      const res = await api.get('/admin/pamm/settlements?limit=50')
      setSettlements(res.data?.data || [])
    } catch (err) { toast.error('Failed to load settlements') }
  }

  const selectedUser = clients.find(c => String(c.id) === String(form.userId))
  const userAccounts = selectedUser?.accounts || []

  const statCards = [
    { label: 'Total Pools', value: pools.length, icon: BarChart3, color: '#8b5cf6' },
    { label: 'Active', value: pools.filter(p => p.isActive).length, icon: Activity, color: '#10b981' },
    { label: 'Total Investors', value: pools.reduce((s, p) => s + (p.investorCount || 0), 0), icon: Users, color: '#3b82f6' },
    { label: 'Total AUM', value: fmt(pools.reduce((s, p) => s + parseFloat(p.totalAum || 0), 0)), icon: DollarSign, color: '#f59e0b' },
  ]

  if (loading) return <div className="flex items-center justify-center min-h-96"><Loader /></div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">PAMM Management</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Percentage Allocation Pools — profit/loss distribution to investors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Clock} onClick={viewSettlements}>Settlement History</Button>
          <Button variant="secondary" icon={RefreshCw} onClick={fetchPools}>Refresh</Button>
          <Button icon={Plus} onClick={openCreateModal}>Create Pool</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={i}>
            <div className="p-4 flex items-center gap-3">
              <div style={{ background: `${s.color}15`, color: s.color }} className="p-2 rounded-lg"><s.icon size={20} /></div>
              <div>
                <div className="text-sm text-dark-500 dark:text-dark-400">{s.label}</div>
                <div className="text-xl font-bold text-dark-900 dark:text-dark-50">{s.value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pool Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700">
                <th className="text-left p-3 font-semibold text-dark-600 dark:text-dark-400">Pool</th>
                <th className="text-left p-3 font-semibold text-dark-600 dark:text-dark-400">MT5 Login</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">AUM</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Investors</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Settlements</th>
                <th className="text-right p-3 font-semibold text-dark-600 dark:text-dark-400">Fees</th>
                <th className="text-center p-3 font-semibold text-dark-600 dark:text-dark-400">Status</th>
                <th className="text-center p-3 font-semibold text-dark-600 dark:text-dark-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pools.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-dark-500">No PAMM pools yet. Create one to get started.</td></tr>
              ) : pools.map(p => (
                <tr key={p.id} className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-dark-900 dark:text-dark-50">{p.name}</div>
                    <div className="text-xs text-dark-500">{p.user?.firstName} {p.user?.lastName}</div>
                  </td>
                  <td className="p-3"><span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-mono">{p.account?.mt5Login || '—'}</span></td>
                  <td className="p-3 text-right font-semibold text-dark-900 dark:text-dark-50">{fmt(p.totalAum)}</td>
                  <td className="p-3 text-right">{p.investorCount || 0}</td>
                  <td className="p-3 text-right">{p.settlementCount || 0}</td>
                  <td className="p-3 text-right text-xs text-dark-500">P: {p.performanceFeePct}% / M: {p.managementFeePct}%</td>
                  <td className="p-3 text-center"><StatusBadge status={p.isActive ? 'active' : 'inactive'}>{p.isActive ? 'ACTIVE' : 'INACTIVE'}</StatusBadge></td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => viewDetail(p.id)} className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600" title="Details"><Eye size={16} /></button>
                      <button onClick={() => viewInvestors(p.id)} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="Investors"><Users size={16} /></button>
                      <button
                        onClick={() => handleSettle(p.id)}
                        disabled={settling === p.id}
                        className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 disabled:opacity-50"
                        title="Trigger Settlement"
                      >
                        {settling === p.id ? <RefreshCw size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                      </button>
                      <button onClick={() => handleToggleActive(p)} className="p-1.5 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600" title={p.isActive ? 'Deactivate' : 'Activate'}>
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
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create PAMM Pool">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Select Manager (Client)</label>
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value, mt5AccountId: '' })}
              className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>)}
            </select>
          </div>
          {form.userId && (
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">MT5 Account (Pool Account)</label>
              <select value={form.mt5AccountId} onChange={(e) => setForm({ ...form, mt5AccountId: e.target.value })}
                className="w-full border border-dark-300 dark:border-dark-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800">
                <option value="">Select MT5 account...</option>
                {userAccounts.map(a => <option key={a.id} value={a.id}>Login: {a.mt5Login} ({a.accountType})</option>)}
              </select>
            </div>
          )}
          <Input label="Pool Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Conservative Growth Pool" fullWidth />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Pool investment strategy..." fullWidth />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Perf Fee %" type="number" value={form.performanceFeePct} onChange={(e) => setForm({ ...form, performanceFeePct: parseFloat(e.target.value) || 0 })} fullWidth />
            <Input label="Mgmt Fee %" type="number" value={form.managementFeePct} onChange={(e) => setForm({ ...form, managementFeePct: parseFloat(e.target.value) || 0 })} fullWidth />
            <Input label="Min Invest $" type="number" value={form.minInvestment} onChange={(e) => setForm({ ...form, minInvestment: parseFloat(e.target.value) || 0 })} fullWidth />
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-sm text-purple-700 dark:text-purple-300">
            <strong>How PAMM works:</strong> The manager trades on this MT5 account. Profits and losses are distributed to investors by their share percentage at settlement time. No trades are replicated to investor accounts.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} fullWidth>Create Pool</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailModal} onClose={() => { setDetailModal(null); setDetailData(null) }} title="Pool Details">
        {detailLoading ? <div className="py-8 flex justify-center"><Loader /></div> : detailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-600 dark:text-purple-400">Pool Equity</div>
                <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{fmt(detailData.liveEquity)}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400">Total AUM</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(detailData.totalAum)}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600 dark:text-green-400">Total P&L Distributed</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(detailData.totalDistributedPnl)}</div>
              </div>
            </div>
            {detailData.livePositions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">Manager's Open Positions</h4>
                <div className="border rounded-lg overflow-hidden dark:border-dark-700">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Symbol</th><th className="p-2">Type</th><th className="p-2 text-right">Lots</th><th className="p-2 text-right">Profit</th></tr></thead>
                    <tbody>
                      {detailData.livePositions.map((pos, i) => (
                        <tr key={i} className="border-t dark:border-dark-700">
                          <td className="p-2 font-mono">{pos.symbol}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${pos.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{pos.type?.toUpperCase()}</span>
                          </td>
                          <td className="p-2 text-right">{pos.volume}</td>
                          <td className={`p-2 text-right font-semibold ${parseFloat(pos.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(pos.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detailData.settlements?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">Recent Settlements</h4>
                <div className="border rounded-lg overflow-hidden dark:border-dark-700">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Date</th><th className="p-2 text-right">Start Eq</th><th className="p-2 text-right">End Eq</th><th className="p-2 text-right">P&L</th><th className="p-2 text-right">Fees</th><th className="p-2 text-right">Net</th></tr></thead>
                    <tbody>
                      {detailData.settlements.slice(0, 10).map((s, i) => (
                        <tr key={i} className="border-t dark:border-dark-700">
                          <td className="p-2">{new Date(s.settlementDate).toLocaleDateString()}</td>
                          <td className="p-2 text-right">{fmt(s.startEquity)}</td>
                          <td className="p-2 text-right">{fmt(s.endEquity)}</td>
                          <td className={`p-2 text-right ${parseFloat(s.totalPnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.totalPnl)}</td>
                          <td className="p-2 text-right text-dark-500">{fmt(parseFloat(s.performanceFee || 0) + parseFloat(s.managementFee || 0))}</td>
                          <td className={`p-2 text-right font-semibold ${parseFloat(s.netPnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.netPnl)}</td>
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
      <Modal isOpen={!!investorsModal} onClose={() => { setInvestorsModal(null); setInvestors([]) }} title="Pool Investors">
        {investors.length === 0 ? (
          <p className="py-4 text-center text-dark-500">No investors yet</p>
        ) : (
          <div className="border rounded-lg overflow-hidden dark:border-dark-700">
            <table className="w-full text-sm">
              <thead><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Investor</th><th className="p-2 text-right">Invested</th><th className="p-2 text-right">Share %</th><th className="p-2 text-right">P&L</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {investors.map((inv, i) => (
                  <tr key={i} className="border-t dark:border-dark-700">
                    <td className="p-2">{inv.investor?.firstName} {inv.investor?.lastName}</td>
                    <td className="p-2 text-right">{fmt(inv.investedAmount)}</td>
                    <td className="p-2 text-right font-semibold text-purple-600">{parseFloat(inv.currentSharePct || 0).toFixed(1)}%</td>
                    <td className={`p-2 text-right font-semibold ${parseFloat(inv.profitLoss) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(inv.profitLoss)}</td>
                    <td className="p-2 text-center"><StatusBadge status={inv.status}>{inv.status?.toUpperCase()}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Settlements History Modal */}
      <Modal isOpen={settlementsModal} onClose={() => setSettlementsModal(false)} title="All PAMM Settlements">
        {settlements.length === 0 ? (
          <p className="py-4 text-center text-dark-500">No settlements yet</p>
        ) : (
          <div className="border rounded-lg overflow-hidden dark:border-dark-700 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0"><tr className="bg-dark-50 dark:bg-dark-800"><th className="p-2 text-left">Pool</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">P&L</th><th className="p-2 text-right">Fees</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Investors</th></tr></thead>
              <tbody>
                {settlements.map((s, i) => (
                  <tr key={i} className="border-t dark:border-dark-700">
                    <td className="p-2">{s.pool?.user?.firstName} {s.pool?.user?.lastName}</td>
                    <td className="p-2">{new Date(s.settlementDate).toLocaleDateString()}</td>
                    <td className={`p-2 text-right ${parseFloat(s.totalPnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.totalPnl)}</td>
                    <td className="p-2 text-right text-dark-500">{fmt(parseFloat(s.performanceFee || 0) + parseFloat(s.managementFee || 0))}</td>
                    <td className={`p-2 text-right font-semibold ${parseFloat(s.netPnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.netPnl)}</td>
                    <td className="p-2 text-right">{s.investorCount}</td>
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
