import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Copy, Share2, TrendingUp, Users, DollarSign, BarChart3, ChevronLeft, ChevronRight, UserCheck, Clock } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import { USER_CRM_URL } from '../utils/domainConfig'
import Loader from '../components/ui/Loader'
import { containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { useCompanyStore } from '../store/companyStore'

const IBPage = () => {
  const [ibData, setIbData] = useState(null)
  const [commissions, setCommissions] = useState([])
  const [stats, setStats] = useState(null)
  const { companyName } = useCompanyStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Referrals (paginated separately)
  const [referrals, setReferrals] = useState([])
  const [referralTotal, setReferralTotal] = useState(0)
  const [referralPage, setReferralPage] = useState(1)
  const [referralLoading, setReferralLoading] = useState(false)
  const REFERRAL_LIMIT = 10

  const fetchReferrals = useCallback(async (page = 1) => {
    try {
      setReferralLoading(true)
      const res = await api.get(`/ib/referrals?page=${page}&limit=${REFERRAL_LIMIT}`)
      const d = res.data?.data
      setReferrals(d?.rows || d || [])
      setReferralTotal(d?.count ?? (d?.rows?.length ?? 0))
      setReferralPage(page)
    } catch (e) {
      console.error('Referrals fetch error:', e.message)
    } finally {
      setReferralLoading(false)
    }
  }, [])

  useEffect(() => {
    const fetchIBData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // Fetch tree first (creates IB entry if none exists), then commissions/stats/referrals
        const treeRes = await api.get('/ib/tree')
        setIbData(treeRes.data?.data || treeRes.data || {})

        // These can fail independently without killing the page
        const [commissionsRes, statsRes] = await Promise.allSettled([
          api.get('/ib/commissions'),
          api.get('/ib/stats'),
        ])

        if (commissionsRes.status === 'fulfilled') {
          setCommissions(commissionsRes.value.data?.data?.rows || commissionsRes.value.data?.data || [])
        }
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data?.data || statsRes.value.data || {})
        }

        // Fetch referrals (paginated, always shown)
        await fetchReferrals(1)
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch IB data'
        console.error('Fetch IB data error:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchIBData()
  }, [fetchReferrals])

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300">Error: {error}</p>
      </div>
    )
  }

  const referralCode = ibData?.referralCode || ibData?.ibCode || 'N/A'
  const referralLink = ibData?.referralLink || `${USER_CRM_URL}/register?ref=${referralCode}`

  const statCards = [
    { label: 'Total Referrals', value: stats?.totalReferrals || 0, icon: Users, color: 'text-blue-500' },
    { label: 'Your Level', value: `Level ${stats?.currentLevel || 1}`, icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Total Commission', value: `$${parseFloat(stats?.totalCommissions || 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-500' },
    { label: 'Commission Trades', value: stats?.commissionCount || 0, icon: BarChart3, color: 'text-orange-500' },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          IB / Referral Program
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Earn commissions by referring traders to {companyName}
        </p>
      </div>

      {/* Referral Code Card */}
      <motion.div variants={itemVariants}>
        <Card variant="elevated" className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
          <CardBody>
            <h3 className="text-lg font-semibold mb-4">Your Referral Code</h3>
            <div className="bg-white/20 backdrop-blur rounded-lg p-4 flex items-center justify-between">
              <div className="font-mono text-xl font-bold tracking-wider">{referralCode}</div>
              <Button variant="secondary" size="sm" onClick={() => handleCopy(referralCode)} className="bg-white/20 hover:bg-white/30 border-0 text-white">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4">
              <p className="text-sm text-primary-100 mb-2">Referral Link</p>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 flex items-center justify-between gap-2">
                <p className="text-sm truncate font-mono">{referralLink}</p>
                <Button variant="secondary" size="sm" onClick={() => handleCopy(referralLink)} className="bg-white/20 hover:bg-white/30 border-0 text-white flex-shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-primary-100 mt-4">
              Share your code or link — when someone registers using it, you earn commissions on their deposits and trades.
            </p>
          </CardBody>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {statCards.map((stat, idx) => (
          <motion.div key={idx} variants={itemVariants}>
            <Card variant="elevated">
              <CardBody className="flex flex-col items-start">
                <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-700 mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {stat.value}
                </p>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Commission Levels */}
      {stats?.levels && stats.levels.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card variant="elevated">
            <CardBody>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Commission Tiers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.levels.map((lvl) => (
                  <div
                    key={lvl.level}
                    className={`p-4 rounded-lg border ${
                      (stats.currentLevel || 1) >= lvl.level
                        ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900 dark:text-white">Level {lvl.level}</span>
                      {(stats.currentLevel || 1) >= lvl.level && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Unlocked</span>
                      )}
                    </div>
                    <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                      <p>Deposit: <span className="font-medium text-slate-900 dark:text-white">{parseFloat(lvl.depositCommissionPercent || lvl.deposit_commission_percent || 0)}%</span></p>
                      <p>Trading: <span className="font-medium text-slate-900 dark:text-white">{parseFloat(lvl.tradingCommissionPercent || lvl.trading_commission_percent || 0)}%</span></p>
                      <p>Referral Bonus: <span className="font-medium text-slate-900 dark:text-white">{parseFloat(lvl.referralBonusPercent || lvl.referral_bonus_percent || 0)}%</span></p>
                      {(lvl.minReferralsRequired || lvl.min_referrals_required || 0) > 0 && (
                        <p className="text-xs text-slate-500">Requires {lvl.minReferralsRequired || lvl.min_referrals_required} referrals</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Referrals List — always shown */}
      <motion.div variants={itemVariants}>
        <Card variant="elevated">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Your Referrals
                {referralTotal > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">({referralTotal} total)</span>
                )}
              </h3>
            </div>

            {referralLoading ? (
              <div className="flex justify-center py-8"><Loader /></div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No referrals yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Share your referral link above to start building your network.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {referrals.map((ref, idx) => (
                        <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 text-slate-400 dark:text-slate-500">
                            {(referralPage - 1) * REFERRAL_LIMIT + idx + 1}
                          </td>
                          <td className="py-3 font-medium text-slate-900 dark:text-white">
                            {ref.firstName} {ref.lastName}
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{ref.email}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                              ref.status === 'active'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : ref.status === 'suspended'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {ref.status === 'active' ? <UserCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {ref.status || 'pending'}
                            </span>
                          </td>
                          <td className="py-3 text-slate-500 dark:text-slate-400">
                            {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {referralTotal > REFERRAL_LIMIT && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Page {referralPage} of {Math.ceil(referralTotal / REFERRAL_LIMIT)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchReferrals(referralPage - 1)}
                        disabled={referralPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => fetchReferrals(referralPage + 1)}
                        disabled={referralPage >= Math.ceil(referralTotal / REFERRAL_LIMIT)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Commission History */}
      <motion.div variants={itemVariants}>
        <Card variant="elevated">
          <CardBody>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Commission History
            </h3>
            {commissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Base Amount</th>
                      <th className="pb-2 font-medium">Rate</th>
                      <th className="pb-2 font-medium">Commission</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {commissions.map((com) => (
                      <tr key={com.id}>
                        <td className="py-3 capitalize text-slate-900 dark:text-white">{com.commissionType || com.commission_type}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">${parseFloat(com.baseAmount || com.base_amount || 0).toFixed(2)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">{parseFloat(com.commissionPercent || com.commission_percent || 0)}%</td>
                        <td className="py-3 font-semibold text-green-600 dark:text-green-400">+${parseFloat(com.commissionAmount || com.commission_amount || 0).toFixed(2)}</td>
                        <td className="py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            (com.status === 'paid') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : (com.status === 'approved') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : (com.status === 'forfeited') ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {com.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">{com.createdAt ? new Date(com.createdAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Share2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                  No commissions yet. Share your referral code to start earning!
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default IBPage
