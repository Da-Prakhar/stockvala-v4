import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Pencil, Trash2, Save, X, Gift, DollarSign, Users,
  CreditCard, ArrowUpCircle, ArrowDownCircle, Search, Clock,
  CheckCircle, AlertCircle, Zap
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const typeColors = {
  welcome: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  deposit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  old_user: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}
const typeLabels = { welcome: 'Welcome Bonus', deposit: 'Deposit Bonus', old_user: 'Old User Bonus' }
const statusColors = {
  available: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  claimed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  credited: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-dark-100 text-dark-700 dark:bg-dark-700 dark:text-dark-400',
}

const tabs = ['Bonus Templates', 'User Claims', 'Credit / Debit']

// ─── Bonus Modal ───
const BonusModal = ({ bonus, onClose, onSave }) => {
  const isEdit = !!bonus?.id
  const [form, setForm] = useState({
    name: bonus?.name || '',
    type: bonus?.type || 'welcome',
    amount: bonus?.amount || '',
    percentage: bonus?.percentage || '',
    amountType: bonus?.amountType || 'fixed',
    requiredLots: bonus?.requiredLots || '0',
    startDate: bonus?.startDate ? bonus.startDate.split('T')[0] : '',
    expiryDate: bonus?.expiryDate ? bonus.expiryDate.split('T')[0] : '',
    expiryDays: bonus?.expiryDays || '',
    maxClaims: bonus?.maxClaims || '0',
    description: bonus?.description || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name) return toast.error('Name is required')
    setSaving(true)
    try {
      await onSave(form, isEdit ? bonus.id : null)
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || e.message)
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none'
  const labelCls = 'block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-bold text-dark-900 dark:text-white">{isEdit ? 'Edit Bonus' : 'Create Bonus'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welcome Bonus $50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="welcome">Welcome (Signup)</option>
                <option value="deposit">Deposit Bonus</option>
                <option value="old_user">Old User / Existing</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount Type</label>
              <select className={inputCls} value={form.amountType} onChange={e => setForm({ ...form, amountType: e.target.value })}>
                <option value="fixed">Fixed Amount ($)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{form.amountType === 'percentage' ? 'Max Amount ($)' : 'Amount ($)'}</label>
              <input className={inputCls} type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="100" />
            </div>
            {form.amountType === 'percentage' && (
              <div>
                <label className={labelCls}>Percentage (%)</label>
                <input className={inputCls} type="number" step="0.01" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} placeholder="50" />
              </div>
            )}
            <div>
              <label className={labelCls}>Required Lots</label>
              <input className={inputCls} type="number" step="0.01" value={form.requiredLots} onChange={e => setForm({ ...form, requiredLots: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input className={inputCls} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input className={inputCls} type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Expiry Days (after claim)</label>
              <input className={inputCls} type="number" value={form.expiryDays} onChange={e => setForm({ ...form, expiryDays: e.target.value })} placeholder="30" />
            </div>
            <div>
              <label className={labelCls}>Max Claims (0 = unlimited)</label>
              <input className={inputCls} type="number" value={form.maxClaims} onChange={e => setForm({ ...form, maxClaims: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Bonus details..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-200 dark:border-dark-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-dark-300 dark:border-dark-600 text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 text-sm flex items-center gap-2">
            <Save className="w-4 h-4" />{saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Credit/Debit Panel ───
const CreditDebitPanel = () => {
  const [form, setForm] = useState({ userId: '', mt5Login: '', amount: '', comment: '', target: 'mt5' })
  const [loading, setLoading] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [foundUser, setFoundUser] = useState(null)

  const searchUser = async () => {
    if (!searchEmail) return
    try {
      const res = await api.get(`/admin/clients?search=${encodeURIComponent(searchEmail)}&limit=1`)
      const clients = res.data?.data?.rows || res.data?.data || []
      if (clients.length > 0) {
        setFoundUser(clients[0])
        setForm(f => ({ ...f, userId: String(clients[0].id) }))
        toast.success(`Found: ${clients[0].firstName || ''} ${clients[0].lastName || ''} (${clients[0].email})`)
      } else {
        toast.error('No user found')
      }
    } catch { toast.error('Search failed') }
  }

  const handleAction = async (action) => {
    if (!form.userId || !form.amount || parseFloat(form.amount) <= 0) return toast.error('User and amount are required')
    setLoading(true)
    try {
      const payload = {
        userId: parseInt(form.userId),
        amount: parseFloat(form.amount),
        comment: form.comment || undefined,
        ...(form.target === 'mt5' && form.mt5Login ? { mt5Login: form.mt5Login } : {})
      }
      const res = await api.post(`/admin/bonuses/${action}`, payload)
      toast.success(res.data?.message || `${action} successful`)
      setForm({ userId: form.userId, mt5Login: '', amount: '', comment: '', target: 'mt5' })
    } catch (e) {
      toast.error(e.response?.data?.message || e.message)
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none'

  return (
    <div className="space-y-6">
      {/* User Search */}
      <div className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700">
        <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Find User</h3>
        <div className="flex gap-3">
          <input className={inputCls} placeholder="Search by email or name..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUser()} />
          <button onClick={searchUser} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm whitespace-nowrap">Search</button>
        </div>
        {foundUser && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
            <p className="font-medium text-green-800 dark:text-green-300">
              {foundUser.firstName} {foundUser.lastName} — {foundUser.email} (ID: {foundUser.id})
            </p>
            {foundUser.accounts?.length > 0 && (
              <p className="text-green-700 dark:text-green-400 text-xs mt-1">
                MT5: {foundUser.accounts.map(a => a.mt5Login || a.mt5_login).filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Credit / Debit Form */}
      <div className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700">
        <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Credit / Debit Amount</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1">Target</label>
            <select className={inputCls} value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
              <option value="mt5">MT5 Credit (non-withdrawable)</option>
              <option value="wallet">Wallet Balance</option>
            </select>
          </div>
          {form.target === 'mt5' && (
            <div>
              <label className="block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1">MT5 Login</label>
              <input className={inputCls} value={form.mt5Login} onChange={e => setForm({ ...form, mt5Login: e.target.value })} placeholder="e.g. 50001" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1">Amount ($)</label>
            <input className={inputCls} type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1">Comment</label>
            <input className={inputCls} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="Reason for credit/debit" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => handleAction('credit')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            <ArrowUpCircle className="w-4 h-4" /> Credit
          </button>
          <button
            onClick={() => handleAction('debit')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            <ArrowDownCircle className="w-4 h-4" /> Debit
          </button>
        </div>
        {form.target === 'mt5' && (
          <p className="text-xs text-dark-400 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> MT5 Credit goes to the credit field, not balance — users cannot withdraw it.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───
const BonusManagerPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [bonuses, setBonuses] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBonus, setEditingBonus] = useState(null)

  const fetchBonuses = async () => {
    try {
      const res = await api.get('/admin/bonuses')
      setBonuses(res.data?.data || [])
    } catch { toast.error('Failed to load bonuses') }
  }

  const fetchClaims = async () => {
    try {
      const res = await api.get('/admin/bonuses/claims?limit=100')
      setClaims(res.data?.data || [])
    } catch { toast.error('Failed to load claims') }
  }

  useEffect(() => {
    Promise.all([fetchBonuses(), fetchClaims()]).finally(() => setLoading(false))
  }, [])

  const handleSave = async (form, id) => {
    if (id) {
      await api.put(`/admin/bonuses/${id}`, form)
      toast.success('Bonus updated')
    } else {
      await api.post('/admin/bonuses', form)
      toast.success('Bonus created')
    }
    fetchBonuses()
  }

  const handleDelete = async (bonus) => {
    if (!confirm(`Deactivate "${bonus.name}"?`)) return
    try {
      await api.delete(`/admin/bonuses/${bonus.id}`)
      toast.success('Bonus deactivated')
      fetchBonuses()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
  }

  const totalCreated = bonuses.length
  const activeBonuses = bonuses.filter(b => b.isActive).length
  const totalClaimed = claims.length
  const totalCreditedAmount = claims.filter(c => c.status === 'credited').reduce((s, c) => s + parseFloat(c.amount || 0), 0)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white"><Gift className="w-6 h-6" /></div>
            Bonus Manager
          </h1>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">Create bonuses, manage claims, credit/debit user accounts</p>
        </div>
        <button
          onClick={() => { setEditingBonus(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Create Bonus
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-dark-200 dark:border-dark-700">
          <p className="text-xs text-dark-500 dark:text-dark-400">Total Bonuses</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1">{totalCreated}</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-dark-200 dark:border-dark-700">
          <p className="text-xs text-dark-500 dark:text-dark-400">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeBonuses}</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-dark-200 dark:border-dark-700">
          <p className="text-xs text-dark-500 dark:text-dark-400">Total Claims</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalClaimed}</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-dark-200 dark:border-dark-700">
          <p className="text-xs text-dark-500 dark:text-dark-400">Total Credited</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">${totalCreditedAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-100 dark:bg-dark-700/50 rounded-xl p-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === i ? 'bg-white dark:bg-dark-800 text-dark-900 dark:text-white shadow-sm' : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
            }`}
          >{tab}</button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 0 && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-dark-500">Loading...</div>
          ) : bonuses.length === 0 ? (
            <div className="p-8 text-center text-dark-500 dark:text-dark-400">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No bonuses created yet. Click "Create Bonus" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-50 dark:bg-dark-700/50">
                  <tr className="text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Req. Lots</th>
                    <th className="px-4 py-3">Claims</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map(bonus => (
                    <tr key={bonus.id} className="border-t border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/30">
                      <td className="px-4 py-3 font-medium text-dark-900 dark:text-dark-100">{bonus.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[bonus.type]}`}>{typeLabels[bonus.type]}</span>
                      </td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">
                        {bonus.amountType === 'percentage' ? `${bonus.percentage}% (max $${bonus.amount})` : `$${parseFloat(bonus.amount || 0).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{parseFloat(bonus.requiredLots || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{bonus.totalClaimed || 0}{bonus.maxClaims > 0 ? ` / ${bonus.maxClaims}` : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bonus.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {bonus.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingBonus(bonus); setShowModal(true) }} className="p-1.5 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg">
                            <Pencil className="w-4 h-4 text-primary-600" />
                          </button>
                          <button onClick={() => handleDelete(bonus)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 1 && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
          {claims.length === 0 ? (
            <div className="p-8 text-center text-dark-500 dark:text-dark-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No bonus claims yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-50 dark:bg-dark-700/50">
                  <tr className="text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Bonus</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">MT5</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Claimed</th>
                    <th className="px-4 py-3">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map(claim => (
                    <tr key={claim.id} className="border-t border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/30">
                      <td className="px-4 py-3 text-dark-900 dark:text-dark-100">
                        {claim.user ? `${claim.user.firstName || ''} ${claim.user.lastName || ''}`.trim() || claim.user.email : `User #${claim.userId}`}
                      </td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{claim.bonus?.name || `#${claim.bonusId}`}</td>
                      <td className="px-4 py-3 font-medium text-dark-900 dark:text-dark-100">${parseFloat(claim.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300">{claim.mt5Account || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[claim.status] || ''}`}>{claim.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark-500">{claim.claimedAt ? new Date(claim.claimedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-xs text-dark-500">{claim.expiresAt ? new Date(claim.expiresAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 2 && <CreditDebitPanel />}

      <AnimatePresence>
        {showModal && <BonusModal bonus={editingBonus} onClose={() => setShowModal(false)} onSave={handleSave} />}
      </AnimatePresence>
    </motion.div>
  )
}

export default BonusManagerPage
