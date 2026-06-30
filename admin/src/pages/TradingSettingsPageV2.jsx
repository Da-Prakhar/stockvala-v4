import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import api from '../utils/api'
import toast from 'react-hot-toast'

// ─── Inline toggle switch ────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label, hint }) => (
  <div className="flex items-start gap-3">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`mt-0.5 relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        checked ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
    {(label || hint) && (
      <div>
        {label && <p className="text-sm font-medium text-dark-800 dark:text-dark-200">{label}</p>}
        {hint && <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">{hint}</p>}
      </div>
    )}
  </div>
)

// ─── Section header helper ───────────────────────────────────────────────────
const SectionTitle = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-5">
    <span className="text-xl">{icon}</span>
    <div>
      <h3 className="font-semibold text-dark-900 dark:text-dark-50">{title}</h3>
      {subtitle && <p className="text-xs text-dark-500 dark:text-dark-400">{subtitle}</p>}
    </div>
  </div>
)

// ─── Default form values ─────────────────────────────────────────────────────
const DEFAULT_TRADING = {
  minDeposit: 1000,
  tradingGroups: 'Standard,Premium,VIP',
}

const DEFAULT_MT5 = {
  mt5_login_series_enabled: false,
  mt5_login_series_next: 2000001,
}

const DEFAULT_PERMISSIONS = {
  // Market access
  market_forex_enabled: true,
  market_crypto_enabled: true,
  market_metals_enabled: true,
  market_indices_enabled: true,
  market_stocks_enabled: false,
  market_commodities_enabled: false,
  // Trading rules
  allow_ea_trading: true,
  allow_demo_accounts: true,
  kyc_required_to_trade: false,
  max_lot_size: 100,
  // Copy trading
  copy_allow_masters: true,
  copy_allow_followers: true,
  copy_max_followers_per_master: 500,
  copy_min_allocation: 100,
  copy_max_allocation: 100000,
  copy_min_performance_fee: 0,
  copy_max_performance_fee: 50,
  copy_lot_modes_allowed: 'ratio,fixed,equity_pct,balance_ratio,risk_pct',
  copy_user_can_modify_settings: true,
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function TradingSettingsPage() {
  const [tradingForm, setTradingForm] = useState(DEFAULT_TRADING)
  const [mt5Form, setMt5Form] = useState(DEFAULT_MT5)
  const [permForm, setPermForm] = useState(DEFAULT_PERMISSIONS)

  const [loadingTrading, setLoadingTrading] = useState(false)
  const [loadingMt5, setLoadingMt5] = useState(false)
  const [loadingPerm, setLoadingPerm] = useState(false)

  // ── Fetch all three categories on mount ──────────────────────────────────
  useEffect(() => {
    const load = async (path, setter, defaults) => {
      try {
        const res = await api.get(path)
        const data = res.data?.data?.settings || res.data?.data || res.data
        if (data && typeof data === 'object') {
          setter(prev => ({ ...defaults, ...prev, ...data }))
        }
      } catch (err) {
        console.warn(`Failed to load ${path}:`, err.message)
      }
    }
    load('/admin/settings/trading',     setTradingForm, DEFAULT_TRADING)
    load('/admin/settings/mt5',         setMt5Form,     DEFAULT_MT5)
    load('/admin/settings/permissions', setPermForm,    DEFAULT_PERMISSIONS)
  }, [])

  const set = (setter) => (field, value) => setter(prev => ({ ...prev, [field]: value }))
  const setT = set(setTradingForm)
  const setM = set(setMt5Form)
  const setP = set(setPermForm)

  // ── Save helpers ─────────────────────────────────────────────────────────
  const saveSection = async (path, data, setLoading, label) => {
    setLoading(true)
    try {
      await api.put(path, data)
      toast.success(`${label} saved`)
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to save ${label}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTrading = () =>
    saveSection('/admin/settings/trading', tradingForm, setLoadingTrading, 'Trading settings')
  const handleSaveMt5 = () =>
    saveSection('/admin/settings/mt5', mt5Form, setLoadingMt5, 'MT5 settings')
  const handleSavePerm = () =>
    saveSection('/admin/settings/permissions', permForm, setLoadingPerm, 'Permission settings')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* ─── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Trading Settings</h1>
        <p className="text-dark-600 dark:text-dark-400 mt-1">Configure trading parameters and user permissions</p>
      </div>

      {/* ── Deposit Settings ─────────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon="💰" title="Deposit Settings" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Minimum Deposit Amount (USD)"
            type="number"
            value={tradingForm.minDeposit}
            onChange={(e) => setT('minDeposit', e.target.value)}
            fullWidth
          />
        </div>
      </Card>

      {/* ── Trading Groups ───────────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon="👥" title="Available Trading Groups" />
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            Trading Groups
          </label>
          <textarea
            value={tradingForm.tradingGroups}
            onChange={(e) => setT('tradingGroups', e.target.value)}
            className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
            rows="2"
            placeholder="Standard,Premium,VIP"
          />
          <p className="text-xs text-dark-500 mt-1">Comma-separated values</p>
        </div>
      </Card>

      {/* Save — trading section */}
      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={() => setTradingForm(DEFAULT_TRADING)}>
          Reset
        </Button>
        <Button variant="primary" onClick={handleSaveTrading} loading={loadingTrading} fullWidth>
          Save Trading Settings
        </Button>
      </div>

      {/* ── MT5 Login ID Series ──────────────────────────────────────────── */}
      <Card>
        <SectionTitle
          icon="🔢"
          title="MT5 Login ID Series"
          subtitle="Assign predictable sequential login numbers to new MT5 accounts"
        />

        <div className="space-y-5">
          <div className="flex items-center justify-between p-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50">
            <div>
              <p className="font-medium text-dark-800 dark:text-dark-200">Enable Sequential Login IDs</p>
              <p className="text-xs text-dark-500 mt-0.5">
                When enabled, each new MT5 account gets the next number in the series instead of a system-generated ID
              </p>
            </div>
            <Toggle
              checked={!!mt5Form.mt5_login_series_enabled}
              onChange={(v) => setM('mt5_login_series_enabled', v)}
            />
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${mt5Form.mt5_login_series_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <Input
              label="Next Login Number"
              type="number"
              value={mt5Form.mt5_login_series_next}
              onChange={(e) => setM('mt5_login_series_next', e.target.value)}
              hint="The next account created will receive this login ID. Auto-increments after each account."
              fullWidth
            />
            <div className="flex flex-col justify-end pb-1">
              <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">💡 How it works</p>
                <ul className="text-xs text-dark-600 dark:text-dark-400 space-y-0.5 list-disc list-inside">
                  <li>Set a starting number (e.g. 2000001)</li>
                  <li>Each new live account gets the next ID</li>
                  <li>Counter auto-advances after each account</li>
                  <li>Disable to revert to MT5 auto-assignment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="primary" onClick={handleSaveMt5} loading={loadingMt5} fullWidth>
            Save MT5 Login Series
          </Button>
        </div>
      </Card>

      {/* ── Market Access ────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle
          icon="🌍"
          title="Market Access"
          subtitle="Control which asset classes users can trade"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'market_forex_enabled',       label: 'Forex',       hint: 'Currency pairs (EUR/USD, GBP/USD…)' },
            { key: 'market_crypto_enabled',      label: 'Crypto',      hint: 'BTC, ETH and other cryptocurrencies' },
            { key: 'market_metals_enabled',      label: 'Metals',      hint: 'Gold (XAU), Silver (XAG)' },
            { key: 'market_indices_enabled',     label: 'Indices',     hint: 'US30, SPX500, NAS100…' },
            { key: 'market_stocks_enabled',      label: 'Stocks',      hint: 'Individual company shares (CFD)' },
            { key: 'market_commodities_enabled', label: 'Commodities', hint: 'Oil, Gas, Agriculture' },
          ].map(({ key, label, hint }) => (
            <div key={key} className="p-3 rounded-lg border border-dark-200 dark:border-dark-700">
              <Toggle
                checked={!!permForm[key]}
                onChange={(v) => setP(key, v)}
                label={label}
                hint={hint}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Trading Rules ────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle
          icon="📋"
          title="Trading Rules & Restrictions"
          subtitle="Control what trading behaviours are permitted on your platform"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            {
              key: 'allow_ea_trading',
              label: 'Allow Expert Advisors (EAs)',
              hint: 'Permit automated/algorithmic trading via MT5 EAs',
            },
            {
              key: 'allow_demo_accounts',
              label: 'Allow Demo Accounts',
              hint: 'Let users create and use demo MT5 accounts',
            },
            {
              key: 'kyc_required_to_trade',
              label: 'Require KYC Before Trading',
              hint: 'Block live trading until KYC documents are verified',
            },
          ].map(({ key, label, hint }) => (
            <div key={key} className="p-4 rounded-lg border border-dark-200 dark:border-dark-700 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-dark-800 dark:text-dark-200">{label}</p>
                <p className="text-xs text-dark-500 mt-0.5">{hint}</p>
              </div>
              <Toggle checked={!!permForm[key]} onChange={(v) => setP(key, v)} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Max Lot Size per Trade"
            type="number"
            step="0.01"
            value={permForm.max_lot_size}
            onChange={(e) => setP('max_lot_size', e.target.value)}
            hint="Hard cap on lot size for any single order (0 = unlimited)"
            fullWidth
          />
        </div>
      </Card>

      {/* ── Copy Trading Permissions ─────────────────────────────────────── */}
      <Card>
        <SectionTitle
          icon="📡"
          title="Copy Trading Permissions"
          subtitle="Define what users can do in the copy trading system"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-dark-200 dark:border-dark-700 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-dark-800 dark:text-dark-200">Allow Users to Become Masters</p>
              <p className="text-xs text-dark-500 mt-0.5">Users can register as signal providers and earn performance fees</p>
            </div>
            <Toggle checked={!!permForm.copy_allow_masters} onChange={(v) => setP('copy_allow_masters', v)} />
          </div>
          <div className="p-4 rounded-lg border border-dark-200 dark:border-dark-700 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-dark-800 dark:text-dark-200">Allow Users to Follow Masters</p>
              <p className="text-xs text-dark-500 mt-0.5">Users can subscribe to copy a master trader's positions</p>
            </div>
            <Toggle checked={!!permForm.copy_allow_followers} onChange={(v) => setP('copy_allow_followers', v)} />
          </div>
          <div className="p-4 rounded-lg border border-dark-200 dark:border-dark-700 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-dark-800 dark:text-dark-200">Users Can Modify Their Copy Settings</p>
              <p className="text-xs text-dark-500 mt-0.5">If OFF, only admin can change follower copy ratio, lot mode, and allocation</p>
            </div>
            <Toggle checked={permForm.copy_user_can_modify_settings !== false} onChange={(v) => setP('copy_user_can_modify_settings', v)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Input
            label="Max Followers per Master"
            type="number"
            value={permForm.copy_max_followers_per_master}
            onChange={(e) => setP('copy_max_followers_per_master', e.target.value)}
            hint="0 = unlimited"
            fullWidth
          />
          <Input
            label="Min Allocation per Follower (USD)"
            type="number"
            value={permForm.copy_min_allocation}
            onChange={(e) => setP('copy_min_allocation', e.target.value)}
            hint="Minimum capital a follower must allocate"
            fullWidth
          />
          <Input
            label="Max Allocation per Follower (USD)"
            type="number"
            value={permForm.copy_max_allocation}
            onChange={(e) => setP('copy_max_allocation', e.target.value)}
            hint="Maximum capital a follower can allocate (0 = unlimited)"
            fullWidth
          />
          <Input
            label="Min Performance Fee (%)"
            type="number"
            step="0.5"
            value={permForm.copy_min_performance_fee}
            onChange={(e) => setP('copy_min_performance_fee', e.target.value)}
            hint="Minimum fee masters can charge on profits"
            fullWidth
          />
          <Input
            label="Max Performance Fee (%)"
            type="number"
            step="0.5"
            value={permForm.copy_max_performance_fee}
            onChange={(e) => setP('copy_max_performance_fee', e.target.value)}
            hint="Maximum fee masters can charge on profits"
            fullWidth
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            Allowed Lot Sizing Modes
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              { id: 'ratio',         label: 'Ratio',         hint: 'Scales by copy ratio' },
              { id: 'fixed',         label: 'Fixed Lot',     hint: 'Fixed lot per trade' },
              { id: 'equity_pct',    label: 'Equity %',      hint: '% of follower equity' },
              { id: 'balance_ratio', label: 'Balance Ratio', hint: 'Follower/master balance' },
              { id: 'risk_pct',      label: 'Risk %',        hint: '% of balance at risk' },
            ].map(({ id, label, hint }) => {
              const allowed = (permForm.copy_lot_modes_allowed || '').split(',').map(s => s.trim())
              const active = allowed.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? allowed.filter(m => m !== id).join(',')
                      : [...allowed.filter(Boolean), id].join(',')
                    setP('copy_lot_modes_allowed', next)
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    active
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-dark-400'
                  }`}
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs mt-0.5 opacity-75">{hint}</p>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-dark-500 mt-2">Click to enable/disable each sizing mode for followers</p>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" fullWidth onClick={() => setPermForm(DEFAULT_PERMISSIONS)}>
            Reset Permissions
          </Button>
          <Button variant="primary" onClick={handleSavePerm} loading={loadingPerm} fullWidth>
            Save Permission Settings
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
