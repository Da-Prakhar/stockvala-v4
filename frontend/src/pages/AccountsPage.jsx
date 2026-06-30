import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  Coins,
  PlayCircle,
  Users,
  Copy,
  Search,
  KeyRound,
  RotateCcw,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody, CardFooter } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import { useAccountStore, ACCOUNT_TYPE_CONFIG } from '../store/accountStore'
import { useCompanyStore } from '../store/companyStore'
import { containerVariants, itemVariants } from '../utils/animations'
import toast from 'react-hot-toast'

const TYPE_ICONS = {
  live: TrendingUp,
  cent: Coins,
  demo: PlayCircle,
  copy_trading: Users,
  contest: TrendingUp,
}

const TYPE_COLORS = {
  live: {
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    accent: 'from-green-500 to-emerald-600',
    iconBg: 'bg-green-50 dark:bg-green-900/20',
  },
  cent: {
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    accent: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  demo: {
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    accent: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  copy_trading: {
    badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    accent: 'from-purple-500 to-pink-600',
    iconBg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  contest: {
    badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    accent: 'from-rose-500 to-red-600',
    iconBg: 'bg-rose-50 dark:bg-rose-900/20',
  },
}

const FILTERS = [
  { value: 'all', label: 'All Accounts' },
  { value: 'live', label: 'Live' },
  { value: 'cent', label: 'Cent' },
  { value: 'demo', label: 'Demo' },
  { value: 'copy_trading', label: 'Copy Trading' },
]

const AccountsPage = () => {
  const navigate = useNavigate()
  const { accounts, fetchAccounts, syncAccount, changePassword, isLoading } = useAccountStore()
  const { companyName } = useCompanyStore()
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [syncingId, setSyncingId] = useState(null)
  const [syncAllLoading, setSyncAllLoading] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState({})
  const [changingPasswordId, setChangingPasswordId] = useState(null)

  const togglePassword = (e, accountId) => {
    e.stopPropagation()
    setVisiblePasswords((prev) => ({ ...prev, [accountId]: !prev[accountId] }))
  }

  const handleChangePassword = async (e, accountId) => {
    e.stopPropagation()
    setChangingPasswordId(accountId)
    const result = await changePassword(accountId)
    if (result.success) {
      toast.success('New passwords generated!')
      setVisiblePasswords((prev) => ({ ...prev, [accountId]: true }))
    } else {
      toast.error(result.error || 'Failed to change password')
    }
    setChangingPasswordId(null)
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleSync = async (e, accountId) => {
    e.stopPropagation()
    setSyncingId(accountId)
    const result = await syncAccount(accountId)
    if (result.success) {
      toast.success('Account synced with MT5')
    } else {
      toast.error('Sync failed')
    }
    setSyncingId(null)
  }

  const handleSyncAll = async () => {
    setSyncAllLoading(true)
    try {
      await Promise.all(accounts.map((acc) => syncAccount(acc.id)))
      toast.success('All accounts synced')
    } catch {
      toast.error('Some accounts failed to sync')
    }
    setSyncAllLoading(false)
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(String(text)).then(() => {
      toast.success(`${label} copied!`)
    }).catch(() => {})
  }

  const filteredAccounts = (accounts || []).filter((acc) => {
    const typeMatch = filter === 'all' || acc.type === filter
    const searchMatch = !searchQuery ||
      String(acc.login).includes(searchQuery) ||
      (acc.type || '').toLowerCase().includes(searchQuery.toLowerCase())
    return typeMatch && searchMatch
  })

  // Count by type for filter badges
  const typeCounts = (accounts || []).reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1
    return acc
  }, {})

  const getTypeLabel = (type) => ACCOUNT_TYPE_CONFIG[type]?.label || type
  const getTypeColors = (type) => TYPE_COLORS[type] || TYPE_COLORS.live
  const getMarketLabel = (m) => ({ forex: 'Forex', forex_crypto: 'Forex', comex: 'Comex', mcx: 'MCX', nse: 'NSE', mcx_nse: 'MCX+NSE' }[m] || m || 'Forex')

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Accounts
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected to MT5
          </p>
        </div>
        <div className="flex items-center gap-3">
          {accounts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncAllLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncAllLoading ? 'animate-spin' : ''}`} />
              {syncAllLoading ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
          <Button
            onClick={() => navigate('/accounts/create')}
            variant="primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Account
          </Button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap flex-1">
          {FILTERS.map((f) => {
            const count = f.value === 'all' ? accounts.length : (typeCounts[f.value] || 0)
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  filter === f.value
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    filter === f.value
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by login..."
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredAccounts.length === 0 && (
        <Card variant="elevated">
          <CardBody>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {accounts.length === 0 ? 'No Accounts Yet' : 'No Matching Accounts'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {accounts.length === 0
                  ? 'Create your first trading account to get started'
                  : 'Try a different filter or search term'}
              </p>
              {accounts.length === 0 && (
                <Button variant="primary" onClick={() => navigate('/accounts/create')}>
                  <Plus className="h-5 w-5 mr-2" />
                  Create Account
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Accounts Grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {filteredAccounts.map((account) => {
          const colors = getTypeColors(account.type)
          const TypeIcon = TYPE_ICONS[account.type] || TrendingUp
          const isSyncing = syncingId === account.id

          return (
            <motion.div key={account.id} variants={itemVariants}>
              <Card
                variant="elevated"
                hoverable
                className="overflow-hidden"
                onClick={() => {
                  setSelectedAccount(account)
                  setShowDetails(true)
                }}
              >
                {/* Color accent bar */}
                <div className={`h-1.5 bg-gradient-to-r ${colors.accent}`} />

                <CardBody className="p-5">
                  {/* Top row: Type badge + Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors.badge}`}>
                        {getTypeLabel(account.type)}
                      </span>
                    </div>
                    <StatusBadge status={account.status} label={account.status} />
                  </div>

                  {/* MT5 Login */}
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">MT5 Login</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-mono font-bold text-slate-900 dark:text-white">
                        {account.login}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(account.login, 'Login') }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Trading Password */}
                  <div className="mb-4 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="h-3 w-3 text-slate-400" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Trading Password</p>
                      </div>
                      <button
                        onClick={(e) => handleChangePassword(e, account.id)}
                        disabled={changingPasswordId === account.id}
                        className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 disabled:opacity-50 transition-colors"
                        title="Generate new password"
                      >
                        <RotateCcw className={`h-3 w-3 ${changingPasswordId === account.id ? 'animate-spin' : ''}`} />
                        {changingPasswordId === account.id ? 'Changing...' : (account.tradingPassword ? 'Change' : 'Set Password')}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white flex-1 tracking-wider">
                        {account.tradingPassword
                          ? (visiblePasswords[account.id] ? account.tradingPassword : '••••••••')
                          : <span className="text-slate-400 dark:text-slate-500 text-xs font-normal tracking-normal">Not set — click Set Password</span>
                        }
                      </p>
                      {account.tradingPassword && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => togglePassword(e, account.id)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            {visiblePasswords[account.id]
                              ? <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                              : <Eye className="h-3.5 w-3.5 text-slate-500" />
                            }
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(account.tradingPassword, 'Trading password') }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Balance & Equity */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Balance</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Equity</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        ${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Leverage & Market */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>1:{account.leverage}</span>
                    <span>{getMarketLabel(account.market)}</span>
                    <span>{new Date(account.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardBody>

                <CardFooter>
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleSync(e, account.id)}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAccount(account)
                        setShowDetails(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Account Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Account Details"
        size="lg"
      >
        {selectedAccount && (
          <div className="space-y-5">
            {/* Type Header */}
            <div className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r ${getTypeColors(selectedAccount.type).accent} text-white`}>
              {(() => { const Icon = TYPE_ICONS[selectedAccount.type] || TrendingUp; return <Icon className="h-6 w-6" /> })()}
              <div>
                <p className="font-semibold text-lg">{getTypeLabel(selectedAccount.type)}</p>
                <p className="text-white/80 text-sm">Login: {selectedAccount.login}</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={selectedAccount.status} label={selectedAccount.status} />
              </div>
            </div>

            {/* Financial */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Balance</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  ${selectedAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Equity</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  ${selectedAccount.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Margin</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  ${(selectedAccount.margin || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Free Margin</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  ${(selectedAccount.freeMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Leverage</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  1:{selectedAccount.leverage}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Market</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {getMarketLabel(selectedAccount.market)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Server</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {selectedAccount.server || `${companyName}-Server1`}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Created</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {new Date(selectedAccount.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Credentials */}
            {(selectedAccount.tradingPassword || selectedAccount.investorPassword) && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-600">
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Account Credentials</p>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-600">
                  {[
                    { key: 'trading', label: 'Trading Password', value: selectedAccount.tradingPassword },
                    { key: 'investor', label: 'Investor Password', value: selectedAccount.investorPassword },
                  ].filter(row => row.value).map(row => (
                    <div key={row.key} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{row.label}</p>
                        <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tracking-wider truncate">
                          {visiblePasswords[`modal-${selectedAccount.id}-${row.key}`]
                            ? row.value
                            : '••••••••••••'}
                        </p>
                      </div>
                      <button
                        onClick={() => setVisiblePasswords((prev) => ({
                          ...prev,
                          [`modal-${selectedAccount.id}-${row.key}`]: !prev[`modal-${selectedAccount.id}-${row.key}`],
                        }))}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                      >
                        {visiblePasswords[`modal-${selectedAccount.id}-${row.key}`]
                          ? <EyeOff className="h-4 w-4 text-slate-500" />
                          : <Eye className="h-4 w-4 text-slate-500" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(row.value, row.label)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Copy className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setShowDetails(false)
                  navigate('/trade')
                }}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Trade Now
              </Button>
              <Button
                variant="ghost"
                onClick={(e) => {
                  handleSync(e, selectedAccount.id)
                }}
                disabled={syncingId === selectedAccount.id}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${syncingId === selectedAccount.id ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}

export default AccountsPage
