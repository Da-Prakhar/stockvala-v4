import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Server,
  RefreshCw,
  Users,
  TrendingUp,
  DollarSign,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Activity,
  Settings,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Save,
  Zap,
  Globe,
  Key,
  Shield,
  Database,
  BarChart3,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { StatusBadge } from '../components/ui/StatusBadge'
import { DataTable } from '../components/ui/DataTable'
import { Tabs } from '../components/ui/Tabs'
import { Modal } from '../components/ui/Modal'
import { Loader } from '../components/ui/Loader'
import { StatCard } from '../components/ui/StatCard'
import { formatCurrency } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

// ─── Configuration Tab Component ───────────────────────────────────
function ConfigurationTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [form, setForm] = useState({
    mt5_bridge_url: '',
    mt5_api_key: '',
    mt5_server: '',
    mt5_server_display_name: '',
    mt5_manager_login: '',
    mt5_manager_password: '',
    mt5_group_forex: '',
    mt5_group_comex: '',
    mt5_group_mcx_nse: '',
    mt5_group_cent: '',
    default_leverage: '100',
    demo_initial_balance: '10000',
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      // Load current config
      const configRes = await api.get('/admin/mt5/config')
      const c = configRes.data?.data || configRes.data || {}
      setConfig(c)

      // Load raw settings from DB to fill form
      const settingsRes = await api.get('/admin/settings/category/mt5').catch(() => ({ data: { data: { settings: {} } } }))
      const s = settingsRes.data?.data?.settings || {}

      // Also load trading category for group mappings
      const tradingRes = await api.get('/admin/settings/category/trading').catch(() => ({ data: { data: { settings: {} } } }))
      const t = tradingRes.data?.data?.settings || {}

      setForm({
        mt5_bridge_url: s.mt5_bridge_url || c.bridgeUrl || '',
        mt5_api_key: s.mt5_api_key || '',
        mt5_server: s.mt5_server || c.server || '',
        mt5_server_display_name: s.mt5_server_display_name || '',
        mt5_manager_login: s.mt5_manager_login || c.managerLogin || '',
        mt5_manager_password: s.mt5_manager_password || '',
        mt5_group_forex: s.mt5_group_forex || t.mt5_group_forex || c.mt5_group_forex || '',
        mt5_group_comex: s.mt5_group_comex || t.mt5_group_comex || c.mt5_group_comex || '',
        mt5_group_mcx_nse: s.mt5_group_mcx_nse || t.mt5_group_mcx_nse || c.mt5_group_mcx_nse || '',
        mt5_group_cent: s.mt5_group_cent || t.mt5_group_cent || c.mt5_group_cent || '',
        default_leverage: s.default_leverage || c.default_leverage || '100',
        demo_initial_balance: s.demo_initial_balance || c.demo_initial_balance || '10000',
      })
    } catch (err) {
      console.error('Failed to load MT5 config:', err)
      toast.error('Failed to load MT5 configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/admin/mt5/test-connection', {
        bridgeUrl: form.mt5_bridge_url || undefined,
        apiKey: form.mt5_api_key || undefined,
      })
      const data = res.data?.data || res.data
      setTestResult(data)
      if (data.connected) {
        toast.success(`Connected! Latency: ${data.latencyMs}ms`)
      } else {
        toast.error(data.error || 'Connection failed')
      }
    } catch (err) {
      setTestResult({ connected: false, error: err.response?.data?.message || err.message })
      toast.error('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build settings object — only include non-empty values
      const settings = {}
      Object.entries(form).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          settings[key] = value
        }
      })

      // Save MT5 bridge settings
      const mt5Settings = {}
      const tradingSettings = {}

      Object.entries(settings).forEach(([key, value]) => {
        if (key.startsWith('mt5_group_')) {
          // Group mappings go to both mt5 and trading categories
          mt5Settings[key] = value
          tradingSettings[key] = value
        } else {
          mt5Settings[key] = value
        }
      })

      // Save mt5 category (this auto-reloads the MT5 service config)
      await api.put('/admin/settings/bulk', {
        settings: mt5Settings,
        category: 'mt5',
      })

      // Also save group mappings to trading category (for account creation)
      if (Object.keys(tradingSettings).length > 0) {
        await api.put('/admin/settings/bulk', {
          settings: tradingSettings,
          category: 'trading',
        })
      }

      toast.success('MT5 configuration saved and applied!')
      loadConfig()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">White-Label Configuration</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Configure your MT5 bridge connection, server credentials, and trading groups here.
              Changes are saved to the database and applied immediately — no code changes or server restarts needed.
            </p>
          </div>
        </div>
      </div>

      {/* Bridge Connection */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50">Bridge Connection</h3>
            <p className="text-sm text-dark-500 dark:text-dark-400">Python MT5 bridge API endpoint and authentication</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Bridge URL"
            placeholder="http://localhost:5001 or http://mt5.yourdomain.com"
            value={form.mt5_bridge_url}
            onChange={(e) => handleChange('mt5_bridge_url', e.target.value)}
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={form.mt5_api_key}
                onChange={(e) => handleChange('mt5_api_key', e.target.value)}
                placeholder="Bridge API key"
                className="w-full px-3 py-2 pr-10 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Test Connection */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !form.mt5_bridge_url}
          >
            {testing ? (
              <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Testing...</>
            ) : (
              <><Wifi className="w-4 h-4 mr-1" /> Test Connection</>
            )}
          </Button>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.connected ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.connected ? (
                <><CheckCircle className="w-4 h-4" /> Connected ({testResult.latencyMs}ms)</>
              ) : (
                <><XCircle className="w-4 h-4" /> {testResult.error}</>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* MT5 Server Credentials */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50">MT5 Server Credentials</h3>
            <p className="text-sm text-dark-500 dark:text-dark-400">Manager API credentials for your MT5 server</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="MT5 Server Address"
            placeholder="86.104.251.248:443"
            value={form.mt5_server}
            onChange={(e) => handleChange('mt5_server', e.target.value)}
            fullWidth
          />
          <Input
            label="Server Display Name"
            placeholder="NeonFx-Server1"
            value={form.mt5_server_display_name}
            onChange={(e) => handleChange('mt5_server_display_name', e.target.value)}
            fullWidth
            helperText="Shown to users on account creation"
          />
          <Input
            label="Manager Login"
            placeholder="28000"
            value={form.mt5_manager_login}
            onChange={(e) => handleChange('mt5_manager_login', e.target.value)}
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Manager Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.mt5_manager_password}
                onChange={(e) => handleChange('mt5_manager_password', e.target.value)}
                placeholder={config?.managerPasswordSet ? '••••••• (already set)' : 'Manager password'}
                className="w-full px-3 py-2 pr-10 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {config?.managerPasswordSet && !form.mt5_manager_password && (
              <p className="text-xs text-green-600 mt-1">Password is set. Leave blank to keep current.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Trading Groups */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50">Trading Groups</h3>
            <p className="text-sm text-dark-500 dark:text-dark-400">MT5 group names for each market segment (must match your MT5 server)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Forex / Crypto Group
            </label>
            <input
              type="text"
              value={form.mt5_group_forex}
              onChange={(e) => handleChange('mt5_group_forex', e.target.value)}
              placeholder="IND\3001\FOREX\22300\VIP-contest"
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600 text-sm font-mono"
            />
            <p className="text-xs text-dark-500 mt-1">Used for Forex and Crypto accounts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Cent Account Group
            </label>
            <input
              type="text"
              value={form.mt5_group_cent}
              onChange={(e) => handleChange('mt5_group_cent', e.target.value)}
              placeholder="real\cent"
              className="w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
            <p className="text-xs text-dark-500 mt-1">Used exclusively for Cent accounts (micro lot trading)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              COMEX Group
            </label>
            <input
              type="text"
              value={form.mt5_group_comex}
              onChange={(e) => handleChange('mt5_group_comex', e.target.value)}
              placeholder="IND\3001\COMEX\22300\10 USD-demo1o1ot"
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600 text-sm font-mono"
            />
            <p className="text-xs text-dark-500 mt-1">Used for COMEX commodity accounts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              MCX / NSE Group
            </label>
            <input
              type="text"
              value={form.mt5_group_mcx_nse}
              onChange={(e) => handleChange('mt5_group_mcx_nse', e.target.value)}
              placeholder="IND\3001\LOT\22300\M250-F2000-demo1o1ot"
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600 text-sm font-mono"
            />
            <p className="text-xs text-dark-500 mt-1">Used for MCX and NSE accounts</p>
          </div>
        </div>
      </Card>

      {/* Default Account Settings */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50">Default Account Settings</h3>
            <p className="text-sm text-dark-500 dark:text-dark-400">Defaults applied when creating new MT5 accounts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Default Leverage"
            type="number"
            placeholder="100"
            value={form.default_leverage}
            onChange={(e) => handleChange('default_leverage', e.target.value)}
            fullWidth
          />
          <Input
            label="Demo Account Initial Balance"
            type="number"
            placeholder="10000"
            value={form.demo_initial_balance}
            onChange={(e) => handleChange('demo_initial_balance', e.target.value)}
            fullWidth
          />
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1 md:flex-none">
          {saving ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save &amp; Apply Configuration</>
          )}
        </Button>
        <Button variant="secondary" onClick={loadConfig} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reset
        </Button>
      </div>
    </div>
  )
}

// ─── Main MT5 Management Page ──────────────────────────────────────
export default function MT5ManagementPage() {
  const [health, setHealth] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [positions, setPositions] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchLogin, setSearchLogin] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [leverageInput, setLeverageInput] = useState('')

  // Create account form
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    group: '',
    leverage: 100,
    initialBalance: 0,
  })

  // Balance operation form
  const [balanceOp, setBalanceOp] = useState({ type: 'deposit', amount: '', comment: '' })

  useEffect(() => {
    loadMT5Data()
  }, [])

  const loadMT5Data = async () => {
    setLoading(true)
    try {
      const [healthRes, groupsRes] = await Promise.all([
        api.get('/admin/mt5/health').catch(() => ({ data: { status: 'error' } })),
        api.get('/admin/mt5/groups').catch(() => ({ data: { groups: [] } })),
      ])
      setHealth(healthRes.data?.data || healthRes.data)
      setGroups(groupsRes.data?.data?.groups || groupsRes.data?.groups || [])
    } catch (err) {
      console.error('Failed to load MT5 data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleHealthCheck = async () => {
    try {
      const res = await api.get('/admin/mt5/health')
      setHealth(res.data?.data || res.data)
      toast.success('MT5 bridge is healthy')
    } catch (err) {
      toast.error('MT5 bridge health check failed')
    }
  }

  const handleConnect = async () => {
    setActionLoading(true)
    try {
      await api.post('/admin/mt5/connect')
      toast.success('Connected to MT5 server')
      handleHealthCheck()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect to MT5')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSearchAccount = async () => {
    if (!searchLogin.trim()) return
    setActionLoading(true)
    try {
      const res = await api.get(`/admin/mt5/accounts/${searchLogin.trim()}`)
      const data = res.data?.data || res.data
      setSelectedAccount(data)
      setShowAccountModal(true)
    } catch (err) {
      toast.error(`Account ${searchLogin} not found`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleFetchPositions = async (login = null) => {
    setActionLoading(true)
    try {
      const endpoint = login ? `/admin/mt5/positions/${login}` : '/admin/mt5/positions'
      const res = await api.get(endpoint)
      const data = res.data?.data || res.data
      setPositions(data.positions || data || [])
      toast.success(`Loaded ${(data.positions || data || []).length} positions`)
    } catch (err) {
      toast.error('Failed to fetch positions')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    setActionLoading(true)
    try {
      const res = await api.post('/admin/mt5/accounts', createForm)
      const data = res.data?.data || res.data
      toast.success(`MT5 Account created! Login: ${data.login}`)
      setShowCreateModal(false)
      setCreateForm({
        firstName: '', lastName: '', email: '', phone: '',
        password: '', group: '', leverage: 100, initialBalance: 0,
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBalanceOperation = async () => {
    if (!selectedAccount || !balanceOp.amount) return
    setActionLoading(true)
    try {
      const endpoint = balanceOp.type === 'deposit' ? '/admin/mt5/deposit' : '/admin/mt5/withdraw'
      await api.post(endpoint, {
        login: String(selectedAccount.login),
        amount: parseFloat(balanceOp.amount),
        comment: balanceOp.comment || `Admin ${balanceOp.type}`,
      })
      toast.success(`${balanceOp.type === 'deposit' ? 'Deposited' : 'Withdrew'} $${balanceOp.amount} ${balanceOp.type === 'deposit' ? 'to' : 'from'} account ${selectedAccount.login}`)
      // Refresh account data
      const res = await api.get(`/admin/mt5/accounts/${selectedAccount.login}`)
      setSelectedAccount(res.data?.data || res.data)
      setBalanceOp({ type: 'deposit', amount: '', comment: '' })
    } catch (err) {
      toast.error(`${balanceOp.type} failed: ${err.response?.data?.message || err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleChangeLeverage = async (login, leverage) => {
    setActionLoading(true)
    try {
      await api.post('/admin/mt5/leverage', { login: String(login), leverage })
      toast.success(`Leverage changed to 1:${leverage}`)
    } catch (err) {
      toast.error('Failed to change leverage')
    } finally {
      setActionLoading(false)
    }
  }

  const positionColumns = [
    { key: 'ticket', label: 'Ticket', sortable: true },
    { key: 'login', label: 'Login', sortable: true },
    { key: 'symbol', label: 'Symbol', sortable: true },
    {
      key: 'type',
      label: 'Type',
      render: (v) => (
        <span className={`font-bold ${v === 0 || v === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
          {v === 0 || v === 'buy' ? 'BUY' : 'SELL'}
        </span>
      ),
    },
    { key: 'volume', label: 'Volume', sortable: true },
    { key: 'price_open', label: 'Open Price', render: (v) => (v || 0).toFixed(5) },
    { key: 'price_current', label: 'Current', render: (v) => (v || 0).toFixed(5) },
    {
      key: 'profit',
      label: 'Profit',
      sortable: true,
      render: (v) => (
        <span className={v >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          ${(v || 0).toFixed(2)}
        </span>
      ),
    },
  ]

  const isConnected = health?.status === 'ok' || health?.status === 'connected' || health?.connected

  const tabs = [
    {
      label: 'Configuration',
      content: <ConfigurationTab />,
    },
    {
      label: 'Server Status',
      content: (
        <div className="space-y-6">
          {/* Connection Status */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50">MT5 Bridge Connection</h3>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" onClick={handleHealthCheck}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Check Health
                </Button>
                <Button size="sm" variant="primary" onClick={handleConnect} disabled={actionLoading}>
                  <Server className="w-4 h-4 mr-1" /> Connect
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700">
                <p className="text-sm text-dark-500 dark:text-dark-400">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {isConnected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700">
                <p className="text-sm text-dark-500 dark:text-dark-400">Bridge URL</p>
                <p className="font-medium text-dark-900 dark:text-dark-50 mt-1 text-sm truncate">
                  {health?.bridge_url || 'Not configured'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700">
                <p className="text-sm text-dark-500 dark:text-dark-400">MT5 Server</p>
                <p className="font-medium text-dark-900 dark:text-dark-50 mt-1 text-sm">
                  {health?.server || 'Not configured'}
                </p>
              </div>
            </div>
          </Card>

          {/* Trading Groups */}
          <Card>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50 mb-4">Trading Groups</h3>
            {groups.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {groups.map((group, i) => (
                  <div key={i} className="p-3 rounded-lg bg-dark-50 dark:bg-dark-700 text-sm">
                    <p className="font-medium text-dark-900 dark:text-dark-50">{typeof group === 'string' ? group : group.name || group.group}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-500 dark:text-dark-400">No groups loaded — connect to MT5 first</p>
            )}
          </Card>
        </div>
      ),
    },
    {
      label: 'Account Lookup',
      content: (
        <div className="space-y-6">
          {/* Search */}
          <Card>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50 mb-4">Search MT5 Account</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter MT5 login number..."
                  value={searchLogin}
                  onChange={(e) => setSearchLogin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchAccount()}
                />
              </div>
              <Button variant="primary" onClick={handleSearchAccount} disabled={actionLoading}>
                <Search className="w-4 h-4 mr-1" /> Search
              </Button>
            </div>
          </Card>

          {/* Create Account */}
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50">Create MT5 Account</h3>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Account
              </Button>
            </div>
          </Card>
        </div>
      ),
    },
    {
      label: 'Live Positions',
      content: (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50">Open Positions</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Filter by login..."
                  value={searchLogin}
                  onChange={(e) => setSearchLogin(e.target.value)}
                  className="w-48"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleFetchPositions(searchLogin.trim() || null)}
                  disabled={actionLoading}
                >
                  <Activity className="w-4 h-4 mr-1" /> Load Positions
                </Button>
              </div>
            </div>
          </Card>
          <Card noPadding>
            {positions.length > 0 ? (
              <DataTable columns={positionColumns} data={positions} pageSize={20} />
            ) : (
              <div className="p-8 text-center text-dark-500 dark:text-dark-400">
                Click "Load Positions" to fetch live positions from MT5
              </div>
            )}
          </Card>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">MT5 Management</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Configure, monitor, and manage your MetaTrader 5 server</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-dark-600 dark:text-dark-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <Tabs tabs={tabs} />

      {/* Account Detail Modal */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => { setShowAccountModal(false); setSelectedAccount(null) }}
        title={`MT5 Account ${selectedAccount?.login || ''}`}
        size="lg"
      >
        {selectedAccount && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-dark-500">Login</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">{selectedAccount.login}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Name</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">
                  {selectedAccount.name || `${selectedAccount.first_name || ''} ${selectedAccount.last_name || ''}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Group</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">{selectedAccount.group || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Balance</p>
                <p className="font-semibold text-lg text-dark-900 dark:text-dark-50">${(selectedAccount.balance || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Equity</p>
                <p className="font-semibold text-lg text-dark-900 dark:text-dark-50">${(selectedAccount.equity || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Leverage</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">1:{selectedAccount.leverage || 100}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Margin</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">${(selectedAccount.margin || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Free Margin</p>
                <p className="font-semibold text-dark-900 dark:text-dark-50">${(selectedAccount.free_margin || selectedAccount.freeMargin || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-dark-500">Profit</p>
                <p className={`font-semibold ${(selectedAccount.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${(selectedAccount.profit || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Balance Operations */}
            <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
              <h4 className="font-semibold text-dark-900 dark:text-dark-50 mb-3">Balance Operation</h4>
              <div className="flex gap-3 items-end">
                <div>
                  <select
                    value={balanceOp.type}
                    onChange={(e) => setBalanceOp({ ...balanceOp, type: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdraw">Withdraw</option>
                  </select>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Amount"
                    type="number"
                    value={balanceOp.amount}
                    onChange={(e) => setBalanceOp({ ...balanceOp, amount: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Comment (optional)"
                    value={balanceOp.comment}
                    onChange={(e) => setBalanceOp({ ...balanceOp, comment: e.target.value })}
                  />
                </div>
                <Button
                  variant={balanceOp.type === 'deposit' ? 'success' : 'danger'}
                  onClick={handleBalanceOperation}
                  disabled={actionLoading || !balanceOp.amount}
                >
                  {balanceOp.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
              <h4 className="font-semibold text-dark-900 dark:text-dark-50 mb-3">Quick Actions</h4>
              <div className="flex gap-2 flex-wrap items-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleFetchPositions(selectedAccount.login)}
                >
                  View Positions
                </Button>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">New Leverage</label>
                    <input
                      type="number"
                      value={leverageInput}
                      onChange={(e) => setLeverageInput(e.target.value)}
                      placeholder="e.g. 200"
                      className="w-24 px-2 py-1.5 text-sm rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!leverageInput || isNaN(leverageInput)}
                    onClick={() => {
                      handleChangeLeverage(selectedAccount.login, parseInt(leverageInput))
                      setLeverageInput('')
                    }}
                  >
                    Change Leverage
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create MT5 Account"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="John"
              value={createForm.firstName}
              onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={createForm.lastName}
              onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
            <Input
              label="Phone"
              placeholder="+1234567890"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
          </div>
          <Input
            label="Password"
            type="password"
            placeholder="Account password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Group</label>
              <select
                value={createForm.group}
                onChange={(e) => setCreateForm({ ...createForm, group: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50"
              >
                <option value="">Select Group</option>
                {groups.map((g, i) => (
                  <option key={i} value={typeof g === 'string' ? g : g.name || g.group}>
                    {typeof g === 'string' ? g : g.name || g.group}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Leverage"
              type="number"
              value={createForm.leverage}
              onChange={(e) => setCreateForm({ ...createForm, leverage: parseInt(e.target.value) || 100 })}
            />
          </div>
          <Input
            label="Initial Balance"
            type="number"
            placeholder="0"
            value={createForm.initialBalance}
            onChange={(e) => setCreateForm({ ...createForm, initialBalance: parseFloat(e.target.value) || 0 })}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreateAccount}
              disabled={actionLoading || !createForm.firstName || !createForm.lastName || !createForm.email}
            >
              {actionLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
