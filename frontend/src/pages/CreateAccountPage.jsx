import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Coins,
  PlayCircle,
  Users,
  Shield,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import { pageTransitionVariants } from '../utils/animations'
import { useAccountStore, ACCOUNT_TYPE_CONFIG } from '../store/accountStore'
import { useCompanyStore } from '../store/companyStore'
import api from '../utils/api'

const ACCOUNT_TYPES = [
  {
    value: 'live',
    label: 'Live Trading',
    icon: TrendingUp,
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50 dark:bg-green-900/20',
    borderActive: 'border-green-500',
    description: 'Trade with real money on live markets',
    features: ['Real market execution', 'Standard lot sizes', 'Full leverage options', 'Real profits & losses'],
    warning: 'Trading involves risk. Only trade with funds you can afford to lose.',
  },
  {
    value: 'cent',
    label: 'Cent Account',
    icon: Coins,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    bgLight: 'bg-blue-50 dark:bg-blue-900/20',
    borderActive: 'border-blue-500',
    description: 'Micro lot trading — perfect for beginners',
    features: ['1 lot = 0.01 standard lot', 'Low risk trading', 'Real market conditions', 'Great for testing strategies'],
    warning: null,
  },
  {
    value: 'demo',
    label: 'Demo Account',
    icon: PlayCircle,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 dark:bg-amber-900/20',
    borderActive: 'border-amber-500',
    description: 'Practice with $10,000 virtual funds',
    features: ['$10,000 virtual balance', 'Risk-free practice', 'Real market data', 'Test any strategy'],
    warning: null,
  },
  {
    value: 'copy_trading',
    label: 'Copy Trading',
    icon: Users,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
    bgLight: 'bg-purple-50 dark:bg-purple-900/20',
    borderActive: 'border-purple-500',
    description: 'Automatically copy expert traders',
    features: ['Follow top performers', 'Automatic trade copying', 'Adjustable copy ratio', 'Stop anytime'],
    warning: 'Past performance does not guarantee future results.',
  },
]

const LEVERAGE_OPTIONS = [
  { value: 1, label: '1:1' },
  { value: 10, label: '1:10' },
  { value: 25, label: '1:25' },
  { value: 50, label: '1:50' },
  { value: 100, label: '1:100' },
  { value: 200, label: '1:200' },
  { value: 500, label: '1:500' },
]

const ALL_MARKET_OPTIONS = [
  { value: 'forex', label: 'Forex + Crypto', icon: '💱', description: 'Trade currency pairs, crypto & global indices', permKey: 'account_create_forex' },
  { value: 'comex', label: 'Comex', icon: '🛢️', description: 'Commodities Exchange — Metals, Energy', permKey: 'account_create_comex' },
  { value: 'mcx_nse', label: 'MCX + NSE', icon: '🇮🇳', description: 'MCX & NSE — Commodities & Stocks', permKey: 'account_create_mcx_nse' },
]

const CreateAccountPage = () => {
  const navigate = useNavigate()
  const { createAccount, fetchCopyMasters, copyMasters, copyMastersLoading } = useAccountStore()
  const { companyName } = useCompanyStore()

  // Admin-controlled market permissions
  const [marketPerms, setMarketPerms] = useState({
    account_create_forex: true,
    account_create_comex: true,
    account_create_mcx_nse: true,
  })

  useEffect(() => {
    api.get('/public/settings/company').then(res => {
      const d = res.data?.data || res.data || {}
      setMarketPerms(prev => ({
        account_create_forex:   d.account_create_forex   ?? prev.account_create_forex,
        account_create_comex:   d.account_create_comex   ?? prev.account_create_comex,
        account_create_mcx_nse: d.account_create_mcx_nse ?? prev.account_create_mcx_nse,
      }))
    }).catch(() => { /* keep defaults */ })
  }, [])

  // Derive which market options are enabled by admin
  const MARKET_OPTIONS = ALL_MARKET_OPTIONS.filter(opt => marketPerms[opt.permKey] !== false)

  // Step management
  const [step, setStep] = useState(1) // 1 = type select, 2 = configure, 3 = success
  const [selectedType, setSelectedType] = useState(null)

  // Form state
  const [leverage, setLeverage] = useState(100)
  const [market, setMarket] = useState('forex')
  const [selectedMaster, setSelectedMaster] = useState(null)
  const [copyRatio, setCopyRatio] = useState(1)
  const [allocationAmount, setAllocationAmount] = useState(500)
  const [agreedTerms, setAgreedTerms] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTradingPass, setShowTradingPass] = useState(false)
  const [showInvestorPass, setShowInvestorPass] = useState(false)
  const [newAccount, setNewAccount] = useState(null)

  // Fetch copy masters when copy_trading is selected
  useEffect(() => {
    if (selectedType === 'copy_trading') {
      fetchCopyMasters()
    }
  }, [selectedType])

  // Reset market to first available if current becomes disabled
  useEffect(() => {
    if (MARKET_OPTIONS.length > 0 && !MARKET_OPTIONS.find(o => o.value === market)) {
      setMarket(MARKET_OPTIONS[0].value)
    }
  }, [MARKET_OPTIONS, market])

  const typeConfig = ACCOUNT_TYPES.find((t) => t.value === selectedType)

  const handleTypeSelect = (type) => {
    setSelectedType(type)
    setStep(2)
    setAgreedTerms(false)
    // Reset copy trading specific
    setSelectedMaster(null)
    setCopyRatio(1)
    setAllocationAmount(500)
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setSelectedType(null)
    }
  }

  const handleSubmit = async () => {
    if (!agreedTerms) {
      toast.error('Please agree to the terms and conditions')
      return
    }

    if (selectedType === 'copy_trading' && !selectedMaster) {
      toast.error('Please select a master trader to copy')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        accountType: selectedType,
        leverage,
        market,
      }

      if (selectedType === 'copy_trading' && selectedMaster) {
        payload.masterTraderId = selectedMaster.id
        payload.copyRatio = copyRatio
        payload.allocationAmount = parseFloat(allocationAmount) || 500
      }

      const result = await createAccount(payload)

      if (result.success) {
        setNewAccount({
          ...result.account,
          tradingPassword: result.tradingPassword,
          investorPassword: result.investorPassword,
        })
        setStep(3)
        toast.success('Account created successfully!')
      } else {
        toast.error(result.error || 'Failed to create account')
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied!`)
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  // ──────────────────────────────────────────────
  // STEP 1: Account Type Selection
  // ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="max-w-4xl mx-auto"
      >
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create New Account
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Choose the type of trading account you want to open
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ACCOUNT_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <motion.div
                key={type.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <button
                  onClick={() => handleTypeSelect(type.value)}
                  className="w-full text-left"
                >
                  <Card variant="elevated" hoverable className="overflow-hidden h-full">
                    {/* Color bar */}
                    <div className={`h-2 bg-gradient-to-r ${type.gradient}`} />
                    <CardBody className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${type.bgLight} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-6 w-6 text-${type.color}-600 dark:text-${type.color}-400`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                              {type.label}
                            </h3>
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {type.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {type.features.slice(0, 2).map((f, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </button>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    )
  }

  // ──────────────────────────────────────────────
  // STEP 3: Success
  // ──────────────────────────────────────────────
  if (step === 3 && newAccount) {
    return (
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="max-w-2xl mx-auto"
      >
        <Card variant="elevated">
          <div className={`h-2 bg-gradient-to-r ${typeConfig?.gradient || 'from-blue-500 to-cyan-600'}`} />
          <CardBody className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Account Created!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Your {typeConfig?.label || 'trading'} account is ready
              </p>
            </div>

            {/* Credentials */}
            <div className="space-y-4 mb-6">
              {/* MT5 Login */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">MT5 Login</p>
                  <p className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                    {newAccount.login}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(String(newAccount.login), 'Login')}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <Copy className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Trading Password */}
              {newAccount.tradingPassword && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Trading Password</p>
                    <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {showTradingPass ? newAccount.tradingPassword : '••••••••••'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowTradingPass(!showTradingPass)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      {showTradingPass ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(newAccount.tradingPassword, 'Trading password')}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <Copy className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Investor Password */}
              {newAccount.investorPassword && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Investor Password</p>
                    <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1">
                      {showInvestorPass ? newAccount.investorPassword : '••••••••••'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowInvestorPass(!showInvestorPass)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      {showInvestorPass ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(newAccount.investorPassword, 'Investor password')}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <Copy className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Account Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Server</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    {newAccount.serverName || newAccount.server || `${companyName}-Server1`}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Leverage</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    1:{newAccount.leverage}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Market</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    {MARKET_OPTIONS.find(m => m.value === (newAccount.market || market))?.label || market}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-6">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Save these credentials securely. You will need them to log into your MT5 trading terminal.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => navigate('/accounts')} className="flex-1">
                Go to Accounts
              </Button>
              <Button variant="ghost" onClick={() => { setStep(1); setSelectedType(null); setNewAccount(null) }}>
                Create Another
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  // ──────────────────────────────────────────────
  // STEP 2: Configure Account
  // ──────────────────────────────────────────────
  const TypeIcon = typeConfig?.icon || TrendingUp

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back to account types</span>
      </button>

      <Card variant="elevated" className="overflow-hidden">
        {/* Header bar */}
        <div className={`bg-gradient-to-r ${typeConfig?.gradient || 'from-blue-500 to-cyan-600'} p-6`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TypeIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {typeConfig?.label || 'Trading Account'}
              </h2>
              <p className="text-white/80 text-sm mt-0.5">
                {typeConfig?.description}
              </p>
            </div>
          </div>
        </div>

        <CardBody className="p-6">
          <div className="space-y-6">
            {/* Features list */}
            <div className="grid grid-cols-2 gap-2">
              {typeConfig?.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Leverage Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Leverage
              </label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {LEVERAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLeverage(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      leverage === opt.value
                        ? `bg-gradient-to-r ${typeConfig?.gradient || 'from-blue-500 to-cyan-600'} text-white shadow-md`
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Market / Segment
              </label>
              {MARKET_OPTIONS.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <Lock className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">No markets are currently available. Please contact support.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ALL_MARKET_OPTIONS.map((opt) => {
                    const allowed = marketPerms[opt.permKey] !== false
                    return (
                      <button
                        key={opt.value}
                        onClick={() => allowed && setMarket(opt.value)}
                        disabled={!allowed}
                        title={!allowed ? 'This market is not available' : undefined}
                        className={`p-4 rounded-xl text-left transition-all border-2 relative ${
                          !allowed
                            ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
                            : market === opt.value
                              ? `${typeConfig?.borderActive || 'border-blue-500'} ${typeConfig?.bgLight || 'bg-blue-50 dark:bg-blue-900/20'}`
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {!allowed && (
                          <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span className="text-2xl">{opt.icon}</span>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2">{opt.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Copy Trading: Master Trader Selection */}
            {selectedType === 'copy_trading' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Select Master Trader
                </label>
                {copyMastersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    <span className="ml-2 text-sm text-slate-500">Loading traders...</span>
                  </div>
                ) : copyMasters.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center">
                    <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No master traders available right now. Check back later.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {copyMasters.map((master) => {
                      const name = master.displayName || master.user?.firstName
                        ? `${master.user?.firstName || ''} ${master.user?.lastName || ''}`.trim()
                        : `Trader #${master.id}`
                      return (
                        <button
                          key={master.id}
                          onClick={() => setSelectedMaster(master)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                            selectedMaster?.id === master.id
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold text-sm">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{name}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>Win: {parseFloat(master.winRate || 0).toFixed(1)}%</span>
                              <span>P&L: ${parseFloat(master.totalProfit || 0).toLocaleString()}</span>
                              <span>{master.totalFollowers || 0} followers</span>
                            </div>
                          </div>
                          {selectedMaster?.id === master.id && (
                            <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Allocation + Copy Ratio */}
                {selectedMaster && (
                  <div className="mt-4 space-y-4">
                    {/* Allocation Amount */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Allocation Amount ($)
                      </label>
                      <input
                        type="number"
                        min={selectedMaster.minInvestment || 100}
                        step="100"
                        value={allocationAmount}
                        onChange={e => {
                          setAllocationAmount(e.target.value)
                        }}
                        onBlur={() => {
                          const min = selectedMaster.minInvestment || 100
                          if (parseFloat(allocationAmount) < min) setAllocationAmount(min)
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder={`Min $${selectedMaster.minInvestment || 100}`}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Minimum: ${selectedMaster.minInvestment || 100}
                      </p>
                    </div>

                    {/* Copy Ratio */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Copy Ratio
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.1"
                          value={copyRatio}
                          onChange={(e) => setCopyRatio(parseFloat(e.target.value))}
                          className="flex-1 accent-purple-500"
                        />
                        <span className="text-lg font-bold text-slate-900 dark:text-white w-16 text-center">
                          {copyRatio}x
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        1x = same lot size as master. 2x = double the lot size.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning for live/copy_trading */}
            {typeConfig?.warning && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {typeConfig.warning}
                </p>
              </div>
            )}

            {/* Terms */}
            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  I agree to the terms and conditions
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  By creating this account, you agree to our trading terms, risk disclosure, and privacy policy
                </p>
              </div>
            </label>

            {/* Submit */}
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || !agreedTerms || (selectedType === 'copy_trading' && !selectedMaster)}
              className="w-full"
            >
              {isSubmitting ? 'Creating Account...' : `Create ${typeConfig?.label || 'Account'}`}
            </Button>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default CreateAccountPage
