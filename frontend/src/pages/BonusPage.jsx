import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Clock, CheckCircle, Star, Zap, DollarSign, AlertCircle, X, ArrowRight } from 'lucide-react'
import { containerVariants, itemVariants } from '../utils/animations'
import { useAccountStore } from '../store/accountStore'
import api from '../utils/api'
import toast from 'react-hot-toast'

const typeGradients = {
  welcome: 'from-emerald-500 to-teal-600',
  deposit: 'from-blue-500 to-indigo-600',
  old_user: 'from-purple-500 to-pink-600',
}
const typeIcons = { welcome: Star, deposit: DollarSign, old_user: Gift }
const typeLabels = { welcome: 'Welcome Bonus', deposit: 'Deposit Bonus', old_user: 'Special Bonus' }
const statusConfig = {
  available: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/20', label: 'Available' },
  claimed: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/20', label: 'Claimed' },
  credited: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/20', label: 'Credited' },
  expired: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/20', label: 'Expired' },
  cancelled: { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/20', label: 'Cancelled' },
}

const BonusCoupon = ({ bonus, onClaim, claimed }) => {
  const TypeIcon = typeIcons[bonus.type] || Gift
  const gradient = typeGradients[bonus.type] || 'from-slate-500 to-slate-600'
  const displayAmount = bonus.amountType === 'percentage'
    ? `${bonus.percentage}%`
    : `$${parseFloat(bonus.amount || 0).toFixed(0)}`

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative group">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg transition-all duration-300">
        <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                <TypeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{bonus.name}</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">{typeLabels[bonus.type]}</span>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-extrabold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {displayAmount}
              </p>
              {bonus.amountType === 'percentage' && bonus.amount > 0 && (
                <p className="text-[10px] text-slate-400">max ${parseFloat(bonus.amount).toFixed(0)}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {bonus.requiredLots > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Required: <span className="text-slate-700 dark:text-slate-300 font-medium">{parseFloat(bonus.requiredLots).toFixed(2)} lots</span></span>
              </div>
            )}
            {bonus.expiryDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Expires: <span className="text-slate-700 dark:text-slate-300 font-medium">{new Date(bonus.expiryDate).toLocaleDateString()}</span></span>
              </div>
            )}
            {bonus.expiryDays && !bonus.expiryDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Valid for <span className="text-slate-700 dark:text-slate-300 font-medium">{bonus.expiryDays} days</span> after claim</span>
              </div>
            )}
            {bonus.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{bonus.description}</p>
            )}
          </div>

          <div className="border-t border-dashed border-slate-200 dark:border-slate-700 my-3 relative">
            <div className="absolute -left-7 -top-3 w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-900" />
            <div className="absolute -right-7 -top-3 w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-900" />
          </div>

          {claimed ? (
            <div className="flex items-center justify-center gap-2 py-2 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Already Claimed
            </div>
          ) : (
            <button
              onClick={() => onClaim(bonus)}
              className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md`}
            >
              Claim Bonus <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

const ClaimModal = ({ bonus, accounts, onClose, onConfirm }) => {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '')
  const gradient = typeGradients[bonus.type] || 'from-blue-500 to-indigo-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Claim Bonus</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className={`p-4 rounded-xl bg-gradient-to-r ${gradient} text-white`}>
            <p className="font-bold text-lg">{bonus.name}</p>
            <p className="text-sm text-white/80 mt-1">
              {bonus.amountType === 'percentage' ? `${bonus.percentage}% bonus` : `$${parseFloat(bonus.amount || 0).toFixed(2)} bonus`}
            </p>
            {bonus.requiredLots > 0 && (
              <p className="text-xs text-white/70 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Complete {parseFloat(bonus.requiredLots).toFixed(2)} lots to unlock
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select MT5 Account</label>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  #{acc.mt5Login} — {acc.accountType || 'Standard'}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Bonus credited as non-withdrawable MT5 credit.
          </p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(bonus.id, selectedAccount)}
            className={`px-5 py-2 rounded-xl bg-gradient-to-r ${gradient} text-white font-medium text-sm hover:opacity-90 shadow-md`}
          >
            Confirm Claim
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const BonusPage = () => {
  const [available, setAvailable] = useState([])
  const [myBonuses, setMyBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimModal, setClaimModal] = useState(null)
  const [activeTab, setActiveTab] = useState('available')
  const { accounts, fetchAccounts } = useAccountStore()

  const load = async () => {
    try {
      const res = await api.get('/bonuses')
      setAvailable(res.data?.data?.available || [])
      setMyBonuses(res.data?.data?.myBonuses || [])
    } catch (e) {
      console.error('Failed to load bonuses:', e)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetchAccounts()
  }, [])

  const claimedBonusIds = new Set(myBonuses.map(b => b.bonusId))

  const handleClaim = async (bonusId, mt5AccountId) => {
    try {
      await api.post('/bonuses/claim', { bonusId, mt5AccountId: parseInt(mt5AccountId) })
      toast.success('Bonus claimed successfully!')
      setClaimModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to claim bonus')
    }
  }

  const totalCredited = myBonuses.filter(b => b.status === 'credited').reduce((s, b) => s + parseFloat(b.amount || 0), 0)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Bonuses & Promotions</h1>
              <p className="text-sm text-white/80 mt-0.5">Claim exclusive bonuses and boost your trading</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Available', value: available.filter(b => !claimedBonusIds.has(b.id)).length, color: 'text-amber-600 dark:text-amber-400', icon: Gift },
          { label: 'Claimed', value: myBonuses.length, color: 'text-blue-600 dark:text-blue-400', icon: CheckCircle },
          { label: 'Credited', value: myBonuses.filter(b => b.status === 'credited').length, color: 'text-green-600 dark:text-green-400', icon: Zap },
          { label: 'Total Value', value: `$${totalCredited.toFixed(2)}`, color: 'text-orange-600 dark:text-orange-400', icon: DollarSign },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</p>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'available'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >Available Bonuses</button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'my'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >My Bonuses</button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'available' ? (
        <motion.div variants={itemVariants}>
          {available.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No bonuses available right now</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Check back later for new promotions!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {available.map(bonus => (
                <BonusCoupon
                  key={bonus.id}
                  bonus={bonus}
                  claimed={claimedBonusIds.has(bonus.id)}
                  onClaim={b => setClaimModal(b)}
                />
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          {myBonuses.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No bonuses claimed yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Go to Available Bonuses to claim your first bonus!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myBonuses.map(ub => {
                const sc = statusConfig[ub.status] || statusConfig.available
                return (
                  <motion.div
                    key={ub.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-lg ${sc.bg}`}>
                        {ub.status === 'credited' ? <CheckCircle className={`w-5 h-5 ${sc.color}`} /> :
                         ub.status === 'expired' ? <AlertCircle className={`w-5 h-5 ${sc.color}`} /> :
                         <Clock className={`w-5 h-5 ${sc.color}`} />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{ub.bonus?.name || 'Bonus'}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium">${parseFloat(ub.amount || 0).toFixed(2)}</span>
                          {ub.mt5Account && <span>MT5 #{ub.mt5Account}</span>}
                          {ub.claimedAt && <span>Claimed {new Date(ub.claimedAt).toLocaleDateString()}</span>}
                        </div>
                        {ub.requiredLots > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                              <span>Lot Progress</span>
                              <span>{parseFloat(ub.completedLots || 0).toFixed(2)} / {parseFloat(ub.requiredLots).toFixed(2)}</span>
                            </div>
                            <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (parseFloat(ub.completedLots || 0) / parseFloat(ub.requiredLots)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {claimModal && (
          <ClaimModal
            bonus={claimModal}
            accounts={accounts}
            onClose={() => setClaimModal(null)}
            onConfirm={handleClaim}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default BonusPage
