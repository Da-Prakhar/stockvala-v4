import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, TrendingUp, Users, BarChart3, User as UserIcon, Crown, Copy, Pause, Play, X, Settings, DollarSign, ChevronRight, RefreshCw, Activity, Eye } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Loader from '../components/ui/Loader'
import { containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'

const CopyTradingPage = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('leaderboard') // leaderboard | followings | trades
  const [masters, setMasters] = useState([])
  const [followings, setFollowings] = useState([])
  const [copyTrades, setCopyTrades] = useState([])
  const [masterProfile, setMasterProfile] = useState(null)
  const [mt5Accounts, setMt5Accounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [canModifySettings, setCanModifySettings] = useState(true)

  // Live positions for followed masters
  const [livePositions, setLivePositions] = useState({}) // { masterId: { positions: [], equity: 0, balance: 0 } }
  const [expandedFollowing, setExpandedFollowing] = useState(null) // following id to show live positions

  // Follow modal state
  const [showFollowModal, setShowFollowModal] = useState(false)
  const [selectedMaster, setSelectedMaster] = useState(null)
  const [followForm, setFollowForm] = useState({
    allocationAmount: '', followerMt5AccountId: '',
    lotMode: 'ratio', copyRatio: '1.0', fixedLot: '0.01', equityPct: '10', maxLotPerTrade: ''
  })

  // Apply as master modal state
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ displayName: '', description: '', tradingStyle: '', mt5AccountId: '', minInvestment: '100' })

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsFollowing, setSettingsFollowing] = useState(null)
  const [settingsForm, setSettingsForm] = useState({
    lotMode: 'ratio', copyRatio: '1.0', fixedLot: '0.01', equityPct: '10', maxLotPerTrade: '',
    allocationAmount: ''
  })

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      setError(null)
      const [mastersRes, followingsRes, masterProfileRes, accountsRes, copyTradesRes, configRes] = await Promise.allSettled([
        api.get('/copy-trading/masters'),
        api.get('/copy-trading/followings'),
        api.get('/copy-trading/my-master-profile'),
        api.get('/accounts'),
        api.get('/copy-trading/copy-trades'),
        api.get('/copy-trading/config'),
      ])

      if (mastersRes.status === 'fulfilled') {
        const d = mastersRes.value.data?.data?.rows || mastersRes.value.data?.data || []
        setMasters(Array.isArray(d) ? d : [])
      }
      if (followingsRes.status === 'fulfilled') {
        const d = followingsRes.value.data?.data?.rows || followingsRes.value.data?.data || []
        setFollowings(Array.isArray(d) ? d : [])
      }
      if (masterProfileRes.status === 'fulfilled') {
        setMasterProfile(masterProfileRes.value.data?.data || null)
      }
      if (accountsRes.status === 'fulfilled') {
        const d = accountsRes.value.data?.data || accountsRes.value.data || []
        setMt5Accounts(Array.isArray(d) ? d : [])
      }
      if (copyTradesRes.status === 'fulfilled') {
        const d = copyTradesRes.value.data?.data?.rows || copyTradesRes.value.data?.data || []
        setCopyTrades(Array.isArray(d) ? d : [])
      }
      if (configRes.status === 'fulfilled') {
        const cfg = configRes.value.data?.data || {}
        setCanModifySettings(cfg.copy_user_can_modify_settings !== false)
      }
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch live positions for a specific master (used in followings tab)
  const fetchLivePositions = useCallback(async (masterId) => {
    try {
      const res = await api.get(`/copy-trading/masters/${masterId}/live-positions`)
      const data = res.data?.data || {}
      setLivePositions(prev => ({
        ...prev,
        [masterId]: {
          positions: data.positions || [],
          equity: data.equity || 0,
          balance: data.balance || 0,
        }
      }))
    } catch (err) {
      console.error(`Failed to fetch live positions for master ${masterId}:`, err)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 15s for leaderboard (live MT5 data) and 10s for followings
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true) // silent refresh
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  // When followings tab is active and a following is expanded, poll its live positions
  useEffect(() => {
    if (activeTab !== 'followings' || !expandedFollowing) return
    const following = followings.find(f => f.id === expandedFollowing)
    if (!following) return

    fetchLivePositions(following.masterId)
    const interval = setInterval(() => {
      fetchLivePositions(following.masterId)
    }, 10000)
    return () => clearInterval(interval)
  }, [activeTab, expandedFollowing, followings, fetchLivePositions])

  // Check if following a master
  const isFollowing = (masterId) => {
    return followings.some(f => String(f.masterId) === String(masterId) && f.status === 'active')
  }

  // Open follow modal
  const handleFollowClick = (master) => {
    setSelectedMaster(master)
    const s = master.followerSettings || {}
    const defaultMode = s.allowCopyRatio !== false ? 'ratio' : s.allowFixedLot ? 'fixed' : s.allowEquityPct ? 'equity_pct' : 'ratio'
    setFollowForm({
      allocationAmount:    String(master.minInvestment || 100),
      followerMt5AccountId: mt5Accounts[0]?.id || '',
      lotMode:     defaultMode,
      copyRatio:   String(s.defaultCopyRatio ?? 1.0),
      fixedLot:    String(s.fixedLotMin ?? 0.01),
      equityPct:   String(s.equityPctMin ?? 10),
      maxLotPerTrade: ''
    })
    setShowFollowModal(true)
  }

  // Submit follow
  const handleFollow = async () => {
    try {
      if (!followForm.allocationAmount || parseFloat(followForm.allocationAmount) <= 0) {
        return toast.error('Enter a valid allocation amount')
      }
      const payload = {
        allocationAmount:      parseFloat(followForm.allocationAmount),
        followerMt5AccountId:  followForm.followerMt5AccountId || undefined,
        lotMode:               followForm.lotMode || 'ratio',
        copyRatio:             parseFloat(followForm.copyRatio) || 1.0,
        fixedLot:              followForm.lotMode === 'fixed'      ? parseFloat(followForm.fixedLot)   || null : null,
        equityPct:             followForm.lotMode === 'equity_pct' ? parseFloat(followForm.equityPct)  || null : null,
        maxLotPerTrade:        followForm.maxLotPerTrade ? parseFloat(followForm.maxLotPerTrade) : null,
      }
      await api.post(`/copy-trading/follow/${selectedMaster.id}`, payload)
      toast.success('Now following this master trader!')
      setShowFollowModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to follow')
    }
  }

  // Unfollow
  const handleUnfollow = async (masterId) => {
    if (!confirm('Stop following this master? Open copy trades will remain open.')) return
    try {
      await api.delete(`/copy-trading/unfollow/${masterId}`)
      toast.success('Unfollowed master')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unfollow')
    }
  }

  // Pause / Resume
  const handlePauseResume = async (following) => {
    try {
      if (following.status === 'active') {
        await api.put(`/copy-trading/followings/${following.id}/pause`)
        toast.success('Following paused')
      } else {
        await api.put(`/copy-trading/followings/${following.id}/resume`)
        toast.success('Following resumed')
      }
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  // Apply as master
  const handleApply = async () => {
    try {
      if (!applyForm.displayName.trim()) return toast.error('Display name is required')
      await api.post('/copy-trading/apply-master', {
        ...applyForm,
        mt5AccountId: applyForm.mt5AccountId || undefined,
        minInvestment: parseFloat(applyForm.minInvestment) || 100
      })
      toast.success('Application submitted! Awaiting admin approval.')
      setShowApplyModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Application failed')
    }
  }

  // Update following settings
  const handleUpdateSettings = async () => {
    try {
      const payload = {
        lotMode:        settingsForm.lotMode,
        copyRatio:      parseFloat(settingsForm.copyRatio) || 1.0,
        fixedLot:       settingsForm.lotMode === 'fixed'      ? parseFloat(settingsForm.fixedLot)  || null : null,
        equityPct:      settingsForm.lotMode === 'equity_pct' ? parseFloat(settingsForm.equityPct) || null : null,
        maxLotPerTrade: settingsForm.maxLotPerTrade ? parseFloat(settingsForm.maxLotPerTrade) : null,
        allocationAmount: settingsForm.allocationAmount ? parseFloat(settingsForm.allocationAmount) : undefined,
      }
      await api.put(`/copy-trading/followings/${settingsFollowing.id}/settings`, payload)
      toast.success('Settings updated')
      setShowSettingsModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings')
    }
  }

  const openSettings = (following) => {
    setSettingsFollowing(following)
    // Determine default mode: use existing lotMode if set, else default based on broker settings
    const master = following.master || {}
    const s = master.followerSettings || {}
    const existingMode = following.lotMode || (s.allowCopyRatio !== false ? 'ratio' : s.allowFixedLot ? 'fixed' : s.allowEquityPct ? 'equity_pct' : 'ratio')
    setSettingsForm({
      lotMode:        existingMode,
      copyRatio:      String(following.copyRatio || s.defaultCopyRatio || 1.0),
      fixedLot:       String(following.fixedLot  || s.fixedLotMin  || 0.01),
      equityPct:      String(following.equityPct || s.equityPctMin || 10),
      maxLotPerTrade: String(following.maxLotPerTrade || ''),
      allocationAmount: String(following.allocationAmount || ''),
    })
    setShowSettingsModal(true)
  }

  // Helpers
  const getMasterName = (master) => {
    if (master?.user) return `${master.user.firstName || ''} ${master.user.lastName || ''}`.trim() || master.displayName || 'Trader'
    return master?.displayName || 'Trader'
  }

  const getInitials = (master) => {
    if (master?.user) {
      const f = master.user.firstName?.[0] || ''
      const l = master.user.lastName?.[0] || ''
      return (f + l).toUpperCase() || '?'
    }
    return (master?.displayName?.[0] || '?').toUpperCase()
  }

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      stopped: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    )
  }

  const formatMoney = (val) => {
    const num = parseFloat(val || 0)
    return num >= 0 ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader /></div>
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300">Error: {error}</p>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Copy Trading</h2>
          <p className="text-slate-600 dark:text-slate-400">Follow top traders and mirror their trades automatically</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            LIVE
            {lastRefresh && (
              <span className="ml-1">· {lastRefresh.toLocaleTimeString()}</span>
            )}
          </div>
          {!masterProfile ? (
            <Button variant="secondary" onClick={() => { setApplyForm({ displayName: '', description: '', tradingStyle: '', mt5AccountId: mt5Accounts[0]?.id || '', minInvestment: '100' }); setShowApplyModal(true) }}>
              <Crown className="h-4 w-4 mr-1" /> Become a Master
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Master:</span>
              {statusBadge(masterProfile.status)}
            </div>
          )}
        </div>
      </div>

      {/* Master profile rejection notice */}
      {masterProfile?.status === 'rejected' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm font-medium">Your master application was rejected.</p>
          {masterProfile.rejectionReason && <p className="text-red-600 dark:text-red-400 text-sm mt-1">Reason: {masterProfile.rejectionReason}</p>}
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setApplyForm({ displayName: masterProfile.displayName || '', description: masterProfile.description || '', tradingStyle: masterProfile.tradingStyle || '', mt5AccountId: '', minInvestment: String(masterProfile.minInvestment || 100) }); setShowApplyModal(true) }}>
            Re-apply
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {[
          { key: 'leaderboard', label: 'Leaderboard', icon: TrendingUp },
          { key: 'followings', label: `My Followings (${followings.filter(f => f.status !== 'stopped').length})`, icon: Users },
          { key: 'trades', label: `Copy Trades (${copyTrades.length})`, icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== LEADERBOARD TAB ==================== */}
      {activeTab === 'leaderboard' && (
        <>
          {masters.length === 0 ? (
            <Card variant="elevated">
              <CardBody>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Master Traders Available</h3>
                  <p className="text-slate-500 dark:text-slate-400">Check back later for available traders to copy.</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masters.map((master) => {
                // Use live MT5 data when available, fall back to DB values
                const equity = master.liveEquity || master.equity || 0
                const totalProfit = master.liveTotalProfit != null ? master.liveTotalProfit : (master.totalProfit || 0)
                const winRate = master.liveWinRate != null ? master.liveWinRate : (master.winRate || 0)
                const totalTrades = master.liveTotalTrades || master.totalTrades || 0
                const openPositions = master.openPositionsCount || 0

                return (
                  <motion.div key={master.id} variants={itemVariants}>
                    <Card variant="elevated" className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
                      {/* Gradient Header */}
                      <div className="h-24 bg-gradient-to-r from-primary-500 to-primary-600 relative">
                        <div className="absolute bottom-0 left-6 transform translate-y-1/2 w-16 h-16 rounded-full border-4 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-200">
                          {getInitials(master)}
                        </div>
                        {master.tradingStyle && (
                          <span className="absolute top-3 right-3 px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs rounded-full">
                            {master.tradingStyle}
                          </span>
                        )}
                        {/* Live badge */}
                        {openPositions > 0 && (
                          <span className="absolute top-3 left-3 px-2 py-0.5 bg-green-500/90 backdrop-blur text-white text-xs rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                            {openPositions} open
                          </span>
                        )}
                      </div>

                      <CardBody className="pt-10 flex-1 flex flex-col">
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{getMasterName(master)}</h3>
                          {master.displayName && master.user && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{master.displayName}</p>
                          )}
                          {(master.account?.mt5Login || master.mt5Account?.mt5Login) && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">MT5: {master.account?.mt5Login || master.mt5Account?.mt5Login}</p>
                          )}
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                          {master.description || 'No description provided'}
                        </p>

                        {/* Live Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Equity</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{formatMoney(equity)}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Profit</p>
                            <p className={`text-sm font-bold ${parseFloat(totalProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(totalProfit)}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Win Rate</p>
                            <p className="text-sm font-bold text-blue-600">{parseFloat(winRate).toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4 flex-grow">
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Trades</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{totalTrades}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Drawdown</p>
                            <p className="text-sm font-bold text-orange-600">{parseFloat(master.maxDrawdown || 0).toFixed(1)}%</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Followers</p>
                            <p className="text-sm font-bold text-purple-600">{master.totalFollowers || 0}</p>
                          </div>
                        </div>

                        {/* Fee + Min Investment info */}
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
                          <span>Fee: {master.performanceFeePct || 0}%</span>
                          <span>Min: ${master.minInvestment || 0}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/copy-trading/${master.id}`)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Live Details
                          </Button>
                          {isFollowing(master.id) ? (
                            <Button variant="success" size="sm" className="flex-1" onClick={() => handleUnfollow(master.id)}>
                              ✓ Following
                            </Button>
                          ) : (
                            <Button variant="primary" size="sm" className="flex-1" onClick={() => handleFollowClick(master)}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </>
      )}

      {/* ==================== FOLLOWINGS TAB ==================== */}
      {activeTab === 'followings' && (
        <>
          {followings.filter(f => f.status !== 'stopped').length === 0 ? (
            <Card variant="elevated">
              <CardBody>
                <div className="text-center py-12">
                  <Copy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Active Followings</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">Browse the leaderboard and start copying a master trader.</p>
                  <Button variant="primary" onClick={() => setActiveTab('leaderboard')}>Browse Masters</Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {followings.filter(f => f.status !== 'stopped').map((following) => {
                const masterLive = livePositions[following.masterId]
                const isExpanded = expandedFollowing === following.id

                return (
                  <Card key={following.id} variant="elevated">
                    <CardBody>
                      {/* Main following row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                            {getInitials(following.master)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              {getMasterName(following.master)}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {statusBadge(following.status)}
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                MT5: <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{following.followerAccount?.mt5Login || '—'}</span>
                              </span>
                              <span className="text-xs text-slate-400">·</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                ${parseFloat(following.allocationAmount || 0).toLocaleString()} · {following.copyRatio || 1}x
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Copied P&L</p>
                            <p className={`font-bold ${parseFloat(following.totalCopiedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(following.totalCopiedProfit || 0)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* View live positions */}
                            <button
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedFollowing(null)
                                } else {
                                  setExpandedFollowing(following.id)
                                  fetchLivePositions(following.masterId)
                                }
                              }}
                              className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${isExpanded ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                              title="View master's live positions"
                            >
                              <Activity className="h-4 w-4" />
                            </button>
                            {canModifySettings && (
                              <button
                                onClick={() => openSettings(following)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Settings"
                              >
                                <Settings className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handlePauseResume(following)}
                              className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${following.status === 'active' ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
                              title={following.status === 'active' ? 'Pause' : 'Resume'}
                            >
                              {following.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => navigate(`/copy-trading/${following.masterId}`)}
                              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="View master details"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleUnfollow(following.masterId)}
                              className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Unfollow"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded: Master's live positions */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Activity className="h-4 w-4 text-primary-500" />
                              Master's Live Positions
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                            </h5>
                            {masterLive && (
                              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                <span>Equity: <strong className="text-slate-700 dark:text-slate-200">{formatMoney(masterLive.equity)}</strong></span>
                                <span>Balance: <strong className="text-slate-700 dark:text-slate-200">{formatMoney(masterLive.balance)}</strong></span>
                              </div>
                            )}
                          </div>

                          {!masterLive ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader />
                              <span className="ml-2 text-sm text-slate-500">Loading live positions...</span>
                            </div>
                          ) : masterLive.positions.length === 0 ? (
                            <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                              No open positions — master is not trading right now
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Symbol</th>
                                    <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Type</th>
                                    <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Volume</th>
                                    <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Open Price</th>
                                    <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Current</th>
                                    <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Swap</th>
                                    <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Profit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {masterLive.positions.map((pos, idx) => (
                                    <tr key={pos.ticket || idx} className="border-b border-slate-100 dark:border-slate-800">
                                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{pos.symbol}</td>
                                      <td className="py-2 px-3">
                                        <span className={`font-semibold ${pos.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                                          {pos.type?.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{pos.volume}</td>
                                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{parseFloat(pos.openPrice || 0).toFixed(5)}</td>
                                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{parseFloat(pos.currentPrice || 0).toFixed(5)}</td>
                                      <td className="py-2 px-3 text-right text-slate-500">{parseFloat(pos.swap || 0).toFixed(2)}</td>
                                      <td className={`py-2 px-3 text-right font-bold ${parseFloat(pos.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatMoney(pos.profit)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                                    <td colSpan={6} className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">Total P&L:</td>
                                    <td className={`py-2 px-3 text-right font-bold ${masterLive.positions.reduce((s, p) => s + parseFloat(p.profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatMoney(masterLive.positions.reduce((s, p) => s + parseFloat(p.profit || 0), 0))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                              <p className="text-[10px] text-slate-400 mt-2 text-right">Auto-refreshes every 10s · Trades are copied to your account within 3 seconds</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ==================== COPY TRADES TAB ==================== */}
      {activeTab === 'trades' && (
        <Card variant="elevated">
          <CardBody>
            {copyTrades.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Copy Trades Yet</h3>
                <p className="text-slate-500 dark:text-slate-400">Trades will appear here once your followed masters start trading.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Master</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Symbol</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Action</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Lots</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Open Price</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Close Price</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">P&L</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copyTrades.map(trade => (
                      <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{trade.master?.displayName || `#${trade.masterId}`}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{trade.symbol}</td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold ${trade.action === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.action?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{trade.followerLots}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{trade.openPrice || '—'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{trade.closePrice || '—'}</td>
                        <td className="py-3 px-4">
                          {trade.status === 'closed' ? (
                            <span className={`font-bold ${parseFloat(trade.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(trade.profit)}
                            </span>
                          ) : trade.status === 'open' ? (
                            <span className="text-blue-500 text-xs font-medium">Running...</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4">{statusBadge(trade.status)}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">
                          {trade.openedAt ? new Date(trade.openedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ==================== FOLLOW MODAL ==================== */}
      {showFollowModal && selectedMaster && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFollowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Copy Trader</h3>
              <button onClick={() => setShowFollowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-bold text-primary-600">
                {getInitials(selectedMaster)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{getMasterName(selectedMaster)}</p>
                <p className="text-xs text-slate-500">Min Investment: ${selectedMaster.minInvestment || 100} · Fee: {selectedMaster.performanceFeePct || 0}%</p>
              </div>
            </div>

            {/* Auto-copy explanation */}
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>Live Auto-Copy:</strong> When this master opens or closes a trade, your account will automatically mirror it within 3 seconds. Lot sizes are proportionally adjusted based on your allocation.
              </p>
            </div>

            {(() => {
              const s = selectedMaster.followerSettings || {}
              const canRatio    = s.allowCopyRatio      !== false
              const canFixed    = s.allowFixedLot       === true
              const canEquity   = s.allowEquityPct      === true
              const canMaxLot   = s.allowMaxLotPerTrade === true
              const inp = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm'
              const lbl = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'
              return (
                <div className="space-y-4">
                  {/* MT5 Account */}
                  <div>
                    <label className={lbl}>MT5 Account</label>
                    <select value={followForm.followerMt5AccountId}
                      onChange={e => setFollowForm({ ...followForm, followerMt5AccountId: e.target.value })}
                      className={inp}>
                      {mt5Accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.mt5Login} ({acc.accountType})</option>
                      ))}
                    </select>
                  </div>

                  {/* Allocation */}
                  <div>
                    <label className={lbl}>Allocation Amount ($)</label>
                    <input type="number" className={inp}
                      value={followForm.allocationAmount}
                      onChange={e => setFollowForm({ ...followForm, allocationAmount: e.target.value })}
                      min={selectedMaster.minInvestment || 100}
                      placeholder={`Min $${selectedMaster.minInvestment || 100}`} />
                  </div>

                  {/* Lot Mode selector — only show if broker allows >1 mode */}
                  {(canRatio && canFixed) || (canRatio && canEquity) || (canFixed && canEquity) ? (
                    <div>
                      <label className={lbl}>Copy Mode</label>
                      <div className="flex gap-2">
                        {canRatio  && <button type="button" onClick={() => setFollowForm({ ...followForm, lotMode: 'ratio' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${followForm.lotMode === 'ratio' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Ratio</button>}
                        {canFixed  && <button type="button" onClick={() => setFollowForm({ ...followForm, lotMode: 'fixed' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${followForm.lotMode === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Fixed Lot</button>}
                        {canEquity && <button type="button" onClick={() => setFollowForm({ ...followForm, lotMode: 'equity_pct' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${followForm.lotMode === 'equity_pct' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Equity %</button>}
                      </div>
                    </div>
                  ) : null}

                  {/* Ratio input */}
                  {followForm.lotMode === 'ratio' && canRatio && (
                    <div>
                      <label className={lbl}>
                        Copy Ratio
                        <span className="text-slate-400 font-normal ml-1">({s.copyRatioMin ?? 0.01} – {s.copyRatioMax ?? 10})</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={followForm.copyRatio}
                        onChange={e => setFollowForm({ ...followForm, copyRatio: e.target.value })}
                        min={s.copyRatioMin ?? 0.01} max={s.copyRatioMax ?? 10} />
                      <p className="text-xs text-slate-500 mt-1">1.0 = same size · 0.5 = half · 2.0 = double</p>
                    </div>
                  )}

                  {/* Fixed lot input */}
                  {followForm.lotMode === 'fixed' && canFixed && (
                    <div>
                      <label className={lbl}>
                        Fixed Lot Size
                        <span className="text-slate-400 font-normal ml-1">({s.fixedLotMin ?? 0.01} – {s.fixedLotMax ?? 100})</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={followForm.fixedLot}
                        onChange={e => setFollowForm({ ...followForm, fixedLot: e.target.value })}
                        min={s.fixedLotMin ?? 0.01} max={s.fixedLotMax ?? 100} />
                      <p className="text-xs text-slate-500 mt-1">Every trade will be copied with exactly this lot size</p>
                    </div>
                  )}

                  {/* Equity % input */}
                  {followForm.lotMode === 'equity_pct' && canEquity && (
                    <div>
                      <label className={lbl}>
                        Equity % per Trade
                        <span className="text-slate-400 font-normal ml-1">({s.equityPctMin ?? 1}% – {s.equityPctMax ?? 100}%)</span>
                      </label>
                      <input type="number" step="1" className={inp}
                        value={followForm.equityPct}
                        onChange={e => setFollowForm({ ...followForm, equityPct: e.target.value })}
                        min={s.equityPctMin ?? 1} max={s.equityPctMax ?? 100} />
                      <p className="text-xs text-slate-500 mt-1">Lot size auto-calculated as % of your equity per trade</p>
                    </div>
                  )}

                  {/* Max lot per trade (optional cap) */}
                  {canMaxLot && (
                    <div>
                      <label className={lbl}>
                        Max Lot per Trade <span className="text-slate-400 font-normal">(optional cap)</span>
                        <span className="text-slate-400 font-normal ml-1">max {s.maxLotPerTradeMax ?? 50}</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={followForm.maxLotPerTrade}
                        onChange={e => setFollowForm({ ...followForm, maxLotPerTrade: e.target.value })}
                        placeholder="Leave blank for no cap"
                        min="0.01" max={s.maxLotPerTradeMax ?? 50} />
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowFollowModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleFollow}>Start Copying</Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== APPLY AS MASTER MODAL ==================== */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                <Crown className="h-5 w-5 inline mr-2 text-yellow-500" />
                Become a Master Trader
              </h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={applyForm.displayName}
                  onChange={e => setApplyForm({ ...applyForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="e.g., Gold Scalper Pro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trading Style</label>
                <select
                  value={applyForm.tradingStyle}
                  onChange={e => setApplyForm({ ...applyForm, tradingStyle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">Select style...</option>
                  <option value="Scalping">Scalping</option>
                  <option value="Day Trading">Day Trading</option>
                  <option value="Swing Trading">Swing Trading</option>
                  <option value="Position Trading">Position Trading</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={applyForm.description}
                  onChange={e => setApplyForm({ ...applyForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  rows={3}
                  placeholder="Describe your trading strategy..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">MT5 Account (your master account)</label>
                <select
                  value={applyForm.mt5AccountId}
                  onChange={e => setApplyForm({ ...applyForm, mt5AccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">Auto-select</option>
                  {mt5Accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.mt5Login} ({acc.accountType})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">This is the account you'll trade on — followers will copy your trades from this ID.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minimum Investment ($)</label>
                <input
                  type="number"
                  value={applyForm.minInvestment}
                  onChange={e => setApplyForm({ ...applyForm, minInvestment: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  min="10"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowApplyModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleApply}>Submit Application</Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SETTINGS MODAL ==================== */}
      {showSettingsModal && settingsFollowing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Copy Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {(() => {
              const master = settingsFollowing.master || {}
              const s = master.followerSettings || {}
              const canRatio  = s.allowCopyRatio      !== false
              const canFixed  = s.allowFixedLot       === true
              const canEquity = s.allowEquityPct      === true
              const canMaxLot = s.allowMaxLotPerTrade === true
              const inp = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm'
              const lbl = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'
              return (
                <div className="space-y-4">
                  {/* Allocation */}
                  <div>
                    <label className={lbl}>Allocation Amount ($)</label>
                    <input type="number" className={inp}
                      value={settingsForm.allocationAmount}
                      onChange={e => setSettingsForm({ ...settingsForm, allocationAmount: e.target.value })}
                      min={master.minInvestment || 100}
                      placeholder={`Min $${master.minInvestment || 100}`} />
                  </div>

                  {/* Lot Mode selector — only show if broker allows >1 mode */}
                  {((canRatio && canFixed) || (canRatio && canEquity) || (canFixed && canEquity)) && (
                    <div>
                      <label className={lbl}>Copy Mode</label>
                      <div className="flex gap-2">
                        {canRatio  && <button type="button" onClick={() => setSettingsForm({ ...settingsForm, lotMode: 'ratio' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${settingsForm.lotMode === 'ratio' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Ratio</button>}
                        {canFixed  && <button type="button" onClick={() => setSettingsForm({ ...settingsForm, lotMode: 'fixed' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${settingsForm.lotMode === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Fixed Lot</button>}
                        {canEquity && <button type="button" onClick={() => setSettingsForm({ ...settingsForm, lotMode: 'equity_pct' })}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${settingsForm.lotMode === 'equity_pct' ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          Equity %</button>}
                      </div>
                    </div>
                  )}

                  {/* Ratio input */}
                  {settingsForm.lotMode === 'ratio' && canRatio && (
                    <div>
                      <label className={lbl}>
                        Copy Ratio
                        <span className="text-slate-400 font-normal ml-1">({s.copyRatioMin ?? 0.01} – {s.copyRatioMax ?? 10})</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={settingsForm.copyRatio}
                        onChange={e => setSettingsForm({ ...settingsForm, copyRatio: e.target.value })}
                        min={s.copyRatioMin ?? 0.01} max={s.copyRatioMax ?? 10} />
                      <p className="text-xs text-slate-500 mt-1">1.0 = same size · 0.5 = half · 2.0 = double</p>
                    </div>
                  )}

                  {/* Fixed lot input */}
                  {settingsForm.lotMode === 'fixed' && canFixed && (
                    <div>
                      <label className={lbl}>
                        Fixed Lot Size
                        <span className="text-slate-400 font-normal ml-1">({s.fixedLotMin ?? 0.01} – {s.fixedLotMax ?? 100})</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={settingsForm.fixedLot}
                        onChange={e => setSettingsForm({ ...settingsForm, fixedLot: e.target.value })}
                        min={s.fixedLotMin ?? 0.01} max={s.fixedLotMax ?? 100} />
                      <p className="text-xs text-slate-500 mt-1">Every trade will be copied with exactly this lot size</p>
                    </div>
                  )}

                  {/* Equity % input */}
                  {settingsForm.lotMode === 'equity_pct' && canEquity && (
                    <div>
                      <label className={lbl}>
                        Equity % per Trade
                        <span className="text-slate-400 font-normal ml-1">({s.equityPctMin ?? 1}% – {s.equityPctMax ?? 100}%)</span>
                      </label>
                      <input type="number" step="1" className={inp}
                        value={settingsForm.equityPct}
                        onChange={e => setSettingsForm({ ...settingsForm, equityPct: e.target.value })}
                        min={s.equityPctMin ?? 1} max={s.equityPctMax ?? 100} />
                      <p className="text-xs text-slate-500 mt-1">Lot size auto-calculated as % of your equity per trade</p>
                    </div>
                  )}

                  {/* Max lot per trade (optional cap) */}
                  {canMaxLot && (
                    <div>
                      <label className={lbl}>
                        Max Lot per Trade <span className="text-slate-400 font-normal">(optional cap, max {s.maxLotPerTradeMax ?? 50})</span>
                      </label>
                      <input type="number" step="0.01" className={inp}
                        value={settingsForm.maxLotPerTrade}
                        onChange={e => setSettingsForm({ ...settingsForm, maxLotPerTrade: e.target.value })}
                        placeholder="Leave blank for no cap"
                        min="0.01" max={s.maxLotPerTradeMax ?? 50} />
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowSettingsModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleUpdateSettings}>Save Settings</Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default CopyTradingPage
