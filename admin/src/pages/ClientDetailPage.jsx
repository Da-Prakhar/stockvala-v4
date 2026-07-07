import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Key, Eye, EyeOff, Copy, Check, XCircle, FileText } from 'lucide-react'
import { API_URL } from '../utils/domainConfig'

const kycApiBase = API_URL.replace(/\/api\/?$/, '')
function getKycDocUrl(v) {
  if (!v) return null
  if (v.startsWith('http')) return v
  const uploadsIdx = v.indexOf('uploads/')
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : `uploads/${v.replace(/^\//, '')}`
  return `${kycApiBase}/${relativePath}`
}

import UserStatementTab from '../components/statement/UserStatementTab'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Tabs } from '../components/ui/Tabs'
import { DataTable } from '../components/ui/DataTable'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Loader } from '../components/ui/Loader'
import { formatCurrency, formatDate, formatPhoneNumber, formatMT5Login } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null })
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState(null)
  // Live MT5 data
  const [liveAccounts, setLiveAccounts] = useState({}) // { login: { balance, equity, margin, ... } }
  const [livePositions, setLivePositions] = useState({}) // { login: [positions] }
  const [liveDeals, setLiveDeals] = useState({}) // { login: [deals] }
  const [mt5Loading, setMt5Loading] = useState(false)
  const [mt5OpModal, setMt5OpModal] = useState({ isOpen: false, type: null, login: null })
  const [mt5OpAmount, setMt5OpAmount] = useState('')
  // MT5 Password change state
  const [pwdModal, setPwdModal] = useState({ isOpen: false, login: null, type: 'trader' })
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  // Show stored MT5 password state
  const [showPwdModal, setShowPwdModal] = useState({ isOpen: false, login: null })
  const [storedPasswords, setStoredPasswords] = useState(null) // { tradingPassword, investorPassword }
  const [showPwdLoading, setShowPwdLoading] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState({})
  // CRM password reset state
  const [crmPwdModal, setCrmPwdModal] = useState(false)
  const [crmNewPassword, setCrmNewPassword] = useState('')
  const [showCrmPassword, setShowCrmPassword] = useState(false)
  const [crmPwdLoading, setCrmPwdLoading] = useState(false)
  const [crmPwdResult, setCrmPwdResult] = useState(null) // holds { password } after success
  // Copied login
  const [copiedLogin, setCopiedLogin] = useState(null)
  // Close position state
  const [closePositionModal, setClosePositionModal] = useState({ isOpen: false, login: null, ticket: null, symbol: '' })
  const [closePositionLoading, setClosePositionLoading] = useState(false)

  useEffect(() => {
    fetchClientDetail()
  }, [id])

  const fetchClientDetail = async () => {
    try {
      setPageLoading(true)
      const response = await api.get(`/admin/clients/${id}`)
      const data = response.data?.data
      setClient(data)
      // After getting client with MT5 login list, fetch live data for each
      if (data?.mt5Accounts?.length) {
        fetchAllLiveMT5Data(data.mt5Accounts)
      }
    } catch (err) {
      console.error('Error fetching client:', err)
      setError('Failed to load client details')
      toast.error('Failed to load client details')
    } finally {
      setPageLoading(false)
    }
  }

  const fetchAllLiveMT5Data = async (accounts) => {
    setMt5Loading(true)
    const logins = accounts.map(a => a.login)
    // Fetch live data in parallel for all accounts
    await Promise.allSettled(logins.map(login => fetchLiveAccountData(login)))
    await Promise.allSettled(logins.map(login => fetchLivePositions(login)))
    await Promise.allSettled(logins.map(login => fetchLiveDeals(login)))
    setMt5Loading(false)
  }

  const fetchLiveAccountData = async (login) => {
    try {
      const response = await api.get(`/admin/mt5/accounts/${login}`)
      const data = response.data?.data || response.data
      setLiveAccounts(prev => ({ ...prev, [login]: data }))
    } catch (err) {
      console.error(`Live account fetch error for ${login}:`, err)
    }
  }

  const fetchLivePositions = async (login) => {
    try {
      const response = await api.get(`/admin/mt5/positions/${login}`)
      const data = response.data?.data || response.data
      // Controller now returns { positions: [...] }
      const positions = data?.positions || (Array.isArray(data) ? data : [])
      setLivePositions(prev => ({ ...prev, [login]: positions }))
    } catch (err) {
      console.error(`Live positions fetch error for ${login}:`, err)
      setLivePositions(prev => ({ ...prev, [login]: [] }))
    }
  }

  const fetchLiveDeals = async (login) => {
    try {
      const response = await api.get(`/admin/mt5/deals/${login}`)
      const data = response.data?.data || response.data
      const deals = data?.deals || (Array.isArray(data) ? data : [])
      setLiveDeals(prev => ({ ...prev, [login]: deals }))
    } catch (err) {
      console.error(`Live deals fetch error for ${login}:`, err)
      setLiveDeals(prev => ({ ...prev, [login]: [] }))
    }
  }

  const handleSyncAccount = async (login) => {
    setMt5Loading(true)
    await Promise.allSettled([
      fetchLiveAccountData(login),
      fetchLivePositions(login),
    ])
    setMt5Loading(false)
    toast.success(`Account ${login} synced from MT5`)
  }

  const handleMT5Deposit = async (login, amount) => {
    try {
      await api.post('/admin/mt5/deposit', { login: String(login), amount, comment: `Admin deposit for client ${id}` })
      toast.success(`Deposited $${amount} to account ${login}`)
      fetchLiveAccountData(login)
    } catch (err) {
      toast.error('Deposit failed')
    }
  }

  const handleMT5Withdraw = async (login, amount) => {
    try {
      await api.post('/admin/mt5/withdraw', { login: String(login), amount, comment: `Admin withdrawal for client ${id}` })
      toast.success(`Withdrew $${amount} from account ${login}`)
      fetchLiveAccountData(login)
    } catch (err) {
      toast.error('Withdrawal failed')
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setPwdLoading(true)
    try {
      await api.put(`/admin/mt5/accounts/${pwdModal.login}/password`, {
        password: newPassword,
        type: pwdModal.type,
      })
      toast.success(`${pwdModal.type === 'investor' ? 'Investor' : 'Trader'} password changed for account ${pwdModal.login}`)
      setPwdModal({ isOpen: false, login: null, type: 'trader' })
      setNewPassword('')
      setShowPassword(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setPwdLoading(false)
    }
  }

  const handleShowPassword = async (login) => {
    setShowPwdModal({ isOpen: true, login })
    setStoredPasswords(null)
    setRevealedPasswords({})
    setShowPwdLoading(true)
    try {
      const res = await api.get(`/admin/mt5/accounts/${login}/password`)
      const data = res.data?.data || res.data
      setStoredPasswords(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch stored password')
      setStoredPasswords({ tradingPassword: null, investorPassword: null })
    } finally {
      setShowPwdLoading(false)
    }
  }

  const generateRandomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghjkmnpqrstuvwxyz'
    const digits = '23456789'
    const special = '!@#$%'
    const all = upper + lower + digits + special
    let pwd = upper[Math.floor(Math.random() * upper.length)]
           + lower[Math.floor(Math.random() * lower.length)]
           + digits[Math.floor(Math.random() * digits.length)]
           + special[Math.floor(Math.random() * special.length)]
    for (let i = 0; i < 6; i++) pwd += all[Math.floor(Math.random() * all.length)]
    return pwd.split('').sort(() => Math.random() - 0.5).join('')
  }

  const handleCrmResetPassword = async () => {
    if (!crmNewPassword || crmNewPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setCrmPwdLoading(true)
    try {
      const res = await api.post(`/admin/clients/${id}/reset-password`, { newPassword: crmNewPassword })
      const resultPwd = res.data?.data?.temporaryPassword || crmNewPassword
      setCrmPwdResult(resultPwd)
      toast.success('CRM password updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setCrmPwdLoading(false)
    }
  }

  const closeCrmPwdModal = () => {
    setCrmPwdModal(false)
    setCrmNewPassword('')
    setShowCrmPassword(false)
    setCrmPwdResult(null)
  }

  const handleAction = async (action) => {
    setLoading(true)
    try {
      if (action === 'suspend') {
        await api.put(`/admin/clients/${id}/status`, { status: 'suspended' })
        setClient({ ...client, status: 'suspended' })
        toast.success('Client suspended successfully')
      } else if (action === 'activate') {
        await api.put(`/admin/clients/${id}/status`, { status: 'active' })
        setClient({ ...client, status: 'active' })
        toast.success('Client activated successfully')
      }
    } catch (err) {
      console.error('Error performing action:', err)
      toast.error('Action failed. Please try again.')
    } finally {
      setLoading(false)
      setConfirmModal({ isOpen: false, action: null })
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedLogin(text)
    setTimeout(() => setCopiedLogin(null), 2000)
  }

  const handleClosePosition = async () => {
    const { login, ticket, symbol } = closePositionModal
    setClosePositionLoading(true)
    try {
      await api.post(`/admin/mt5/positions/${login}/${ticket}/close`, { symbol, comment: 'Admin CRM Close' })
      toast.success(`Position #${ticket} closed successfully`)
      setClosePositionModal({ isOpen: false, login: null, ticket: null, symbol: '' })
      await fetchLivePositions(login)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close position')
    } finally {
      setClosePositionLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200">
        {error || 'Client not found'}
      </div>
    )
  }

  // Build combined live data for display
  const allMt5Accounts = (client.mt5Accounts || []).map(acc => {
    const live = liveAccounts[acc.login] || {}
    return {
      ...acc,
      balance: live.balance ?? acc.balance ?? 0,
      equity: live.equity ?? acc.equity ?? 0,
      margin: live.margin ?? acc.margin ?? 0,
      freeMargin: live.margin_free ?? live.freeMargin ?? acc.freeMargin ?? 0,
      leverage: live.leverage ?? acc.leverage,
      group: live.group ?? acc.mt5Group,
      profit: live.profit ?? 0,
    }
  })

  // Collect all open positions across all accounts
  const allPositions = []
  Object.entries(livePositions).forEach(([login, positions]) => {
    (positions || []).forEach(p => allPositions.push({ ...p, mt5Login: login }))
  })

  const totalBalance = allMt5Accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0)
  const totalEquity = allMt5Accounts.reduce((sum, a) => sum + (parseFloat(a.equity) || 0), 0)
  const totalPnL = allPositions.reduce((sum, p) => sum + (parseFloat(p.profit) || parseFloat(p.pnl) || 0), 0)
  const totalOpenPositions = allPositions.length

  // Deposit/withdrawal columns — these can stay from DB since they're platform transactions
  const depositColumns = [
    { key: 'id', label: 'Deposit ID', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, render: (v) => formatCurrency(v, 'USD') },
    { key: 'method', label: 'Method', sortable: true, render: (v) => v || '-' },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v) => v ? formatDate(v) : '-' },
    { key: 'status', label: 'Status', render: (v) => v ? <StatusBadge status={v}>{v.toUpperCase()}</StatusBadge> : '-' },
  ]

  const withdrawalColumns = [
    { key: 'id', label: 'Withdrawal ID', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, render: (v) => formatCurrency(v, 'USD') },
    { key: 'method', label: 'Method', sortable: true, render: (v) => v || '-' },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v) => v ? formatDate(v) : '-' },
    { key: 'status', label: 'Status', render: (v) => v ? <StatusBadge status={v}>{v.toUpperCase()}</StatusBadge> : '-' },
  ]

  // Open positions columns — LIVE from MT5
  const positionColumns = [
    { key: 'position', label: 'Ticket', sortable: true, render: (v, row) => v || row.Position || row.ticket || '-' },
    { key: 'mt5Login', label: 'Account', sortable: true, render: (v) => v ? <span className="font-mono text-xs">{v}</span> : '-' },
    { key: 'symbol', label: 'Symbol', sortable: true, render: (v, row) => <span className="font-semibold">{v || row.Symbol || '-'}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (v, row) => {
      const action = v ?? row.action ?? row.Action ?? 0
      const isBuy = action === 0 || String(action).toLowerCase() === 'buy'
      return <span className={isBuy ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{isBuy ? 'BUY' : 'SELL'}</span>
    }},
    { key: 'volume', label: 'Volume', sortable: true, render: (v, row) => {
      const vol = v ?? row.Volume ?? 0
      return (vol >= 10000 ? (vol / 10000).toFixed(2) : parseFloat(vol).toFixed(2))
    }},
    { key: 'price_open', label: 'Open Price', sortable: true, render: (v, row) => {
      const price = v ?? row.PriceOpen ?? row.priceOpen ?? row.open_price ?? 0
      return price ? parseFloat(price).toFixed(5) : '-'
    }},
    { key: 'price_current', label: 'Current Price', sortable: true, render: (v, row) => {
      const price = v ?? row.PriceCurrent ?? row.priceCurrent ?? 0
      return price ? parseFloat(price).toFixed(5) : '-'
    }},
    { key: 'profit', label: 'P&L', sortable: true, render: (v, row) => {
      const pnl = parseFloat(v ?? row.Profit ?? row.pnl ?? 0)
      return <span className={pnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{pnl > 0 ? '+' : ''}{formatCurrency(pnl, 'USD')}</span>
    }},
    { key: 'swap', label: 'Swap', sortable: true, render: (v, row) => {
      const swap = parseFloat(v ?? row.Storage ?? row.Swap ?? 0)
      return swap !== 0 ? formatCurrency(swap, 'USD') : '$0.00'
    }},
    { key: '_action', label: 'Action', render: (v, row) => {
      const ticket = row.position ?? row.Position ?? row.ticket
      const login = row.mt5Login
      const symbol = row.symbol ?? row.Symbol ?? ''
      return (
        <button
          onClick={() => setClosePositionModal({ isOpen: true, login, ticket, symbol })}
          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" /> Close
        </button>
      )
    }},
  ]

  const tabs = [
    {
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">MT5 Accounts</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{allMt5Accounts.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Balance (Live)</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalBalance, 'USD')}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Equity (Live)</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(totalEquity, 'USD')}</p>
            </div>
            <div className={`${totalPnL >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'} rounded-xl p-4`}>
              <p className={`text-xs font-medium ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Open P&L ({totalOpenPositions} positions)
              </p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL, 'USD')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Personal Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">Email</p>
                  <p className="font-medium text-dark-900 dark:text-dark-50">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">Phone</p>
                  <p className="font-medium text-dark-900 dark:text-dark-50">{formatPhoneNumber(client.phone || client.phoneNumber)}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">Country</p>
                  <p className="font-medium text-dark-900 dark:text-dark-50">{client.country || client.profile?.country || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">City</p>
                  <p className="font-medium text-dark-900 dark:text-dark-50">{client.city || client.profile?.city || '—'}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Account Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">Status</p>
                  <StatusBadge status={client.status || 'active'}>{(client.status || 'active').toUpperCase()}</StatusBadge>
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">KYC Status</p>
                  {(() => {
                    const kycVal = client.kyc?.status || client.kycStatus || 'unknown'
                    return <StatusBadge status={kycVal}>{kycVal.toUpperCase()}</StatusBadge>
                  })()}
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">Joined Date</p>
                  <p className="font-medium text-dark-900 dark:text-dark-50">{formatDate(client.createdAt || client.joinedDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-600 dark:text-dark-400">MT5 Login IDs</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {allMt5Accounts.length > 0 ? allMt5Accounts.map((acc) => (
                      <button
                        key={acc.login}
                        onClick={() => copyToClipboard(String(acc.login))}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md text-sm font-mono hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                        title="Click to copy"
                      >
                        {formatMT5Login(acc.login)}
                        {copiedLogin === String(acc.login) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-50" />}
                      </button>
                    )) : <span className="text-dark-400">No accounts</span>}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
    {
      label: 'KYC Documents',
      content: (() => {
        const kyc = client.kycDocument
        const kycDocFields = [
          { key: 'frontImage', label: 'ID Proof (Front)' },
          { key: 'backImage', label: 'ID Proof (Back)' },
          { key: 'selfieImage', label: 'Selfie with ID' },
          { key: 'addressProof', label: 'Address Proof' },
          { key: 'bankStatement', label: 'Bank Statement' },
        ]
        const docTypeMap = { passport: 'Passport', national_id: 'National ID', driving_license: 'Driving License', drivers_license: 'Driving License', voter_id: 'Voter ID', residence_permit: 'Residence Permit' }
        return (
          <Card>
            {!kyc ? (
              <p className="text-dark-500 dark:text-dark-400 text-center py-8">No KYC submission found for this client</p>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Status</p>
                    <StatusBadge status={kyc.status}>{(kyc.status || '').toUpperCase()}</StatusBadge>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Document Type</p>
                    <p className="font-medium text-dark-900 dark:text-dark-50">{docTypeMap[kyc.documentType] || kyc.documentType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Document Number</p>
                    <p className="font-mono font-medium text-dark-900 dark:text-dark-50">{kyc.documentNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Submitted</p>
                    <p className="font-medium text-dark-900 dark:text-dark-50">{kyc.submittedAt ? formatDate(kyc.submittedAt) : '—'}</p>
                  </div>
                  {kyc.reviewedAt && (
                    <div>
                      <p className="text-dark-500 dark:text-dark-400">Reviewed</p>
                      <p className="font-medium text-dark-900 dark:text-dark-50">{formatDate(kyc.reviewedAt)}</p>
                    </div>
                  )}
                  {kyc.issueCountry && (
                    <div>
                      <p className="text-dark-500 dark:text-dark-400">Issue Country</p>
                      <p className="font-medium text-dark-900 dark:text-dark-50">{kyc.issueCountry}</p>
                    </div>
                  )}
                </div>
                {kyc.status === 'rejected' && kyc.rejectionReason && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300"><strong>Rejection Reason:</strong> {kyc.rejectionReason}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">Uploaded Documents</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {kycDocFields.map(({ key, label }) => {
                      const val = kyc[key]
                      const url = getKycDocUrl(val)
                      return (
                        <div key={key} className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                          <div className="p-2 bg-dark-50 dark:bg-dark-700 border-b border-dark-200 dark:border-dark-600">
                            <p className="text-xs font-medium text-dark-600 dark:text-dark-300">{label}</p>
                          </div>
                          {val && url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="w-full h-32 flex items-center justify-center bg-dark-100 dark:bg-dark-800 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors cursor-pointer block">
                              {url.match(/\.pdf$/i) ? (
                                <FileText className="w-10 h-10 text-red-400" />
                              ) : (
                                <img src={url} alt={label} className="max-h-28 max-w-full object-contain p-1" onError={e => { e.target.style.display='none'; e.target.parentElement.innerHTML='<div class="p-2 text-xs text-center text-dark-400">Unable to load</div>' }} />
                              )}
                            </a>
                          ) : (
                            <div className="h-32 flex items-center justify-center bg-dark-50 dark:bg-dark-800">
                              <p className="text-xs text-dark-400 italic">Not uploaded</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })(),
    },
    {
      label: `MT5 Accounts (${allMt5Accounts.length})`,
      content: (
        <div className="space-y-4">
          {allMt5Accounts.map((account) => {
            const accPositions = livePositions[account.login] || []
            const accPnL = accPositions.reduce((sum, p) => sum + (parseFloat(p.profit) || parseFloat(p.Profit) || 0), 0)
            return (
              <Card key={account.login}>
                {/* Account Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-dark-900 dark:text-dark-50 font-mono">
                        {formatMT5Login(account.login)}
                      </h3>
                      <button
                        onClick={() => copyToClipboard(String(account.login))}
                        className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                        title="Copy login"
                      >
                        {copiedLogin === String(account.login) ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-dark-400" />}
                      </button>
                      <span className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300">
                        {account.accountType || 'live'}
                      </span>
                      {account.leverage && (
                        <span className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300">
                          1:{account.leverage}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                      Login: {account.login} {account.group ? `| Group: ${account.group}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncAccount(account.login)}
                      disabled={mt5Loading}
                      className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                      title="Sync live from MT5"
                    >
                      <RefreshCw className={`w-4 h-4 text-dark-500 ${mt5Loading ? 'animate-spin' : ''}`} />
                    </button>
                    <StatusBadge status={account.status || 'active'}>{(account.status || 'active').toUpperCase()}</StatusBadge>
                  </div>
                </div>

                {/* Live Account Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Balance</p>
                    <p className="font-bold text-dark-900 dark:text-dark-50 text-lg">{formatCurrency(account.balance, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Equity</p>
                    <p className="font-bold text-dark-900 dark:text-dark-50 text-lg">{formatCurrency(account.equity, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Margin</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(account.margin, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Free Margin</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(account.freeMargin, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 dark:text-dark-400">Open P&L ({accPositions.length})</p>
                    <p className={`font-bold text-lg ${accPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {accPnL >= 0 ? '+' : ''}{formatCurrency(accPnL, 'USD')}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-dark-200 dark:border-dark-700">
                  <Button size="sm" variant="success" onClick={() => { setMt5OpModal({ isOpen: true, type: 'deposit', login: account.login }); setMt5OpAmount(''); }}>
                    Deposit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => { setMt5OpModal({ isOpen: true, type: 'withdraw', login: account.login }); setMt5OpAmount(''); }}>
                    Withdraw
                  </Button>
                  <Button size="sm" variant="secondary" icon={Key} onClick={() => { setPwdModal({ isOpen: true, login: account.login, type: 'trader' }); setNewPassword(''); setShowPassword(false); }}>
                    Change Trader Password
                  </Button>
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => { setPwdModal({ isOpen: true, login: account.login, type: 'investor' }); setNewPassword(''); setShowPassword(false); }}>
                    Change Investor Password
                  </Button>
                  <Button size="sm" variant="secondary" icon={Key} onClick={() => handleShowPassword(account.login)}>
                    Show Password
                  </Button>
                </div>
              </Card>
            )
          })}
          {allMt5Accounts.length === 0 && (
            <Card>
              <p className="text-dark-500 dark:text-dark-400 text-center py-8">No MT5 accounts found for this client</p>
            </Card>
          )}
        </div>
      ),
    },
    {
      label: `Open Positions (${totalOpenPositions})`,
      content: (
        <Card noPadding>
          {mt5Loading ? (
            <div className="flex items-center justify-center p-8"><Loader /></div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable columns={positionColumns} data={allPositions} pageSize={15} />
            </div>
          )}
          {!mt5Loading && allPositions.length === 0 && (
            <p className="text-dark-500 dark:text-dark-400 text-center py-8">No open positions</p>
          )}
        </Card>
      ),
    },
    {
      label: 'Deposits',
      content: (
        <Card noPadding>
          <div className="overflow-x-auto">
            <DataTable columns={depositColumns} data={client.deposits || []} pageSize={10} />
          </div>
        </Card>
      ),
    },
    {
      label: 'Withdrawals',
      content: (
        <Card noPadding>
          <div className="overflow-x-auto">
            <DataTable columns={withdrawalColumns} data={client.withdrawals || []} pageSize={10} />
          </div>
        </Card>
      ),
    },
    {
      label: 'Statement',
      content: (
        <UserStatementTab
          client={client}
          liveDeals={liveDeals}
          liveAccounts={liveAccounts}
          mt5Loading={mt5Loading}
        />
      ),
    },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-2">
        <button onClick={() => navigate('/clients')} className="p-2 mt-1 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-dark-600 dark:text-dark-300" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">
              {`${client.firstName || ''} ${client.lastName || client.name || ''}`.trim() || client.email}
            </h1>
            <StatusBadge status={client.status || 'active'}>{(client.status || 'active').toUpperCase()}</StatusBadge>
            {mt5Loading && <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-dark-600 dark:text-dark-400 flex-wrap">
            <span>{client.email}</span>
            <span>ID: {client.id}</span>
            {allMt5Accounts.length > 0 && (
              <span className="flex items-center gap-1">
                MT5: {allMt5Accounts.map(a => a.login).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {client.status === 'active' ? (
          <Button variant="danger" onClick={() => setConfirmModal({ isOpen: true, action: 'suspend' })}>Suspend Client</Button>
        ) : (
          <Button variant="success" onClick={() => setConfirmModal({ isOpen: true, action: 'activate' })}>Activate Client</Button>
        )}
        <Button variant="secondary" onClick={() => { setCrmPwdModal(true); setCrmNewPassword(''); setCrmPwdResult(null); }}>Reset CRM Password</Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} />

      {/* Close Position Confirm Modal */}
      <ConfirmModal
        isOpen={closePositionModal.isOpen}
        onClose={() => setClosePositionModal({ isOpen: false, login: null, ticket: null, symbol: '' })}
        onConfirm={handleClosePosition}
        title="Close Position"
        message={`Close position #${closePositionModal.ticket} (${closePositionModal.symbol || 'N/A'}) on account ${closePositionModal.login}? This action cannot be undone.`}
        confirmText="Close Position"
        variant="danger"
        loading={closePositionLoading}
      />

      {/* Confirmation Modal (suspend / activate only) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null })}
        onConfirm={() => handleAction(confirmModal.action)}
        title={confirmModal.action === 'suspend' ? 'Suspend Client' : 'Activate Client'}
        message={confirmModal.action === 'suspend' ? 'This client will be suspended and unable to trade. Confirm?' : 'This client will be activated and can resume trading. Confirm?'}
        confirmText={confirmModal.action === 'suspend' ? 'Suspend' : 'Activate'}
        variant={confirmModal.action === 'suspend' ? 'danger' : 'primary'}
        loading={loading}
      />

      {/* MT5 Balance Operation Modal */}
      <Modal
        isOpen={mt5OpModal.isOpen}
        onClose={() => setMt5OpModal({ isOpen: false, type: null, login: null })}
        title={`MT5 ${mt5OpModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'} — Account ${mt5OpModal.login}`}
      >
        <div className="space-y-4">
          <Input label="Amount (USD)" type="number" value={mt5OpAmount} onChange={(e) => setMt5OpAmount(e.target.value)} placeholder="0.00" />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setMt5OpModal({ isOpen: false, type: null, login: null })}>Cancel</Button>
            <Button
              variant={mt5OpModal.type === 'deposit' ? 'success' : 'danger'}
              className="flex-1"
              onClick={async () => {
                const amount = parseFloat(mt5OpAmount)
                if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
                if (mt5OpModal.type === 'deposit') { await handleMT5Deposit(mt5OpModal.login, amount) }
                else { await handleMT5Withdraw(mt5OpModal.login, amount) }
                setMt5OpModal({ isOpen: false, type: null, login: null })
              }}
            >
              {mt5OpModal.type === 'deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CRM Password Reset Modal */}
      <Modal
        isOpen={crmPwdModal}
        onClose={closeCrmPwdModal}
        title={`Reset CRM Password — ${client?.firstName} ${client?.lastName}`}
      >
        {crmPwdResult ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Password updated successfully!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mb-3">New password for <strong>{client?.email}</strong>:</p>
              <div className="flex items-center gap-2 bg-white dark:bg-dark-700 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2">
                <span className="font-mono text-sm flex-1 text-dark-900 dark:text-white tracking-widest">{crmPwdResult}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(crmPwdResult); toast.success('Copied!') }}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">An email has been sent to the client with the new password.</p>
            </div>
            <Button variant="primary" className="w-full" onClick={closeCrmPwdModal}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-dark-600 dark:text-dark-400">
              Set a new CRM login password for <strong>{client?.firstName} {client?.lastName}</strong> ({client?.email}).
              The client will also receive an email with the new password.
            </p>
            <div className="relative">
              <Input
                label="New Password"
                type={showCrmPassword ? 'text' : 'password'}
                value={crmNewPassword}
                onChange={(e) => setCrmNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                fullWidth
              />
              <button
                type="button"
                onClick={() => setShowCrmPassword(!showCrmPassword)}
                className="absolute right-3 top-9 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
              >
                {showCrmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { const p = generateRandomPassword(); setCrmNewPassword(p); setShowCrmPassword(true); }}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Generate random password
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeCrmPwdModal}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleCrmResetPassword} isLoading={crmPwdLoading}>Set Password</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MT5 Password Change Modal */}
      <Modal
        isOpen={pwdModal.isOpen}
        onClose={() => { setPwdModal({ isOpen: false, login: null, type: 'trader' }); setNewPassword(''); setShowPassword(false); }}
        title={`Change ${pwdModal.type === 'investor' ? 'Investor' : 'Trader'} Password — Account ${pwdModal.login}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            {pwdModal.type === 'investor'
              ? 'Investor password allows read-only access to the MT5 account (view positions, history, etc.)'
              : 'Trader password allows full trading access to the MT5 account.'}
          </p>
          <div className="relative">
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              fullWidth
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => { const p = generateRandomPassword(); setNewPassword(p); setShowPassword(true); }}
          >
            Generate Random Password
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setPwdModal({ isOpen: false, login: null, type: 'trader' }); setNewPassword(''); }}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleChangePassword} isLoading={pwdLoading}>Change Password</Button>
          </div>
        </div>
      </Modal>

      {/* Show Stored MT5 Password Modal */}
      <Modal
        isOpen={showPwdModal.isOpen}
        onClose={() => { setShowPwdModal({ isOpen: false, login: null }); setStoredPasswords(null); setRevealedPasswords({}); }}
        title={`Stored Passwords — Account ${showPwdModal.login}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            MT5 has no password-retrieval API — these are the last passwords our system set for this account. If a password was never set through this platform, it will show as unavailable.
          </p>
          {showPwdLoading ? (
            <div className="flex items-center justify-center py-6"><Loader /></div>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'tradingPassword', label: 'Trading Password' },
                { key: 'investorPassword', label: 'Investor Password' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-dark-200 dark:border-dark-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
                    {storedPasswords?.[key] ? (
                      <p className="font-mono text-sm font-semibold text-dark-900 dark:text-dark-50 tracking-wider truncate">
                        {revealedPasswords[key] ? storedPasswords[key] : '••••••••••'}
                      </p>
                    ) : (
                      <p className="text-sm text-dark-400 dark:text-dark-500">Not available — password was never captured by this system.</p>
                    )}
                  </div>
                  {storedPasswords?.[key] && (
                    <button
                      type="button"
                      onClick={() => setRevealedPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="p-1.5 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors flex-shrink-0"
                    >
                      {revealedPasswords[key] ? <EyeOff className="w-4 h-4 text-dark-500" /> : <Eye className="w-4 h-4 text-dark-500" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={() => { setShowPwdModal({ isOpen: false, login: null }); setStoredPasswords(null); setRevealedPasswords({}); }}>Close</Button>
        </div>
      </Modal>
    </motion.div>
  )
}
