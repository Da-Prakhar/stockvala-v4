import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Plus, RefreshCw } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import { SearchInput } from '../components/ui/SearchInput'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatPhoneNumber, formatDate, formatCurrency } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'


const columns = [
  { key: 'id', label: 'ID', sortable: true, render: (v) => <span className="text-xs font-mono text-dark-500 dark:text-dark-400">#{v}</span> },
  {
    key: 'name',
    label: 'Client',
    sortable: true,
    render: (value, row) => {
      const name = `${row.firstName || ''} ${row.lastName || row.name || ''}`.trim() || 'N/A'
      return (
        <div>
          <p className="font-semibold text-dark-900 dark:text-dark-50">{name}</p>
          <p className="text-xs text-dark-500 dark:text-dark-400">{row.email || ''}</p>
        </div>
      )
    },
  },
  {
    key: 'country',
    label: 'Country',
    sortable: true,
    render: (v) => v || <span className="text-dark-400">—</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => value ? <StatusBadge status={value}>{value.toUpperCase()}</StatusBadge> : <span className="text-slate-400">—</span>,
  },
  {
    key: 'mt5Logins',
    label: 'MT5 Logins',
    render: (value) => {
      if (!value || !value.length) return <span className="text-dark-400 text-xs">No accounts</span>
      return (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((login) => (
            <span key={login} className="inline-block px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-mono">
              {login}
            </span>
          ))}
          {value.length > 3 && <span className="text-xs text-dark-400">+{value.length - 3}</span>}
        </div>
      )
    },
  },
  {
    key: 'mt5Accounts',
    label: 'Accounts',
    sortable: true,
    render: (value) => <span className="font-semibold">{value ?? 0}</span>,
  },
  {
    key: 'totalBalance',
    label: 'Balance (Live)',
    sortable: true,
    render: (value, row) => (
      <div>
        <span className="font-semibold">{formatCurrency(value || 0, 'USD')}</span>
        {row.isLive && <span className="ml-1 text-[10px] text-green-500">LIVE</span>}
      </div>
    ),
  },
  {
    key: 'kycStatus',
    label: 'KYC',
    render: (value, row) => {
      const kycVal = row.kyc?.status || value || 'unknown'
      return <StatusBadge status={kycVal}>{kycVal.toUpperCase()}</StatusBadge>
    },
  },
  {
    key: 'createdAt',
    label: 'Joined',
    sortable: true,
    render: (value) => value ? <span className="text-xs text-dark-500 dark:text-dark-400">{formatDate(value)}</span> : '—',
  },
]


export default function ClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [liveBalances, setLiveBalances] = useState({}) // keyed by mt5Login
  const [loading, setLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    kycStatus: 'all',
    country: 'all',
  })
  const [clientModal, setClientModal] = useState(false)
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '', country: 'India', password: '' })
  const [creating, setCreating] = useState(false)

  // Fetch live MT5 balances for all logins
  const fetchLiveBalances = useCallback(async (clientsList) => {
    const allLogins = []
    clientsList.forEach(c => {
      (c.mt5Logins || []).forEach(login => allLogins.push(login))
    })
    if (!allLogins.length) return

    setLiveLoading(true)
    const balances = {}
    // Fetch in parallel batches of 10
    const batchSize = 10
    for (let i = 0; i < allLogins.length; i += batchSize) {
      const batch = allLogins.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(login =>
          api.get(`/admin/mt5/accounts/${login}`).then(r => ({ login, data: r.data?.data || r.data }))
        )
      )
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.data) {
          const { login, data } = r.value
          balances[login] = {
            balance: parseFloat(data.balance) || 0,
            equity: parseFloat(data.equity) || 0,
          }
        }
      })
    }
    setLiveBalances(balances)
    setLiveLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/clients?limit=100')
      const data = response.data.data || []
      setClients(data)
      // After loading clients, fetch live MT5 balances
      fetchLiveBalances(data)
    } catch (err) {
      console.error('Error fetching clients:', err)
      setError('Failed to load clients')
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  // Merge live balances into client data
  const clientsWithLive = useMemo(() => {
    return (clients || []).map(client => {
      const logins = client.mt5Logins || []
      let liveBal = 0
      let liveEq = 0
      let hasLive = false
      logins.forEach(login => {
        if (liveBalances[login]) {
          hasLive = true
          liveBal += liveBalances[login].balance
          liveEq += liveBalances[login].equity
        }
      })
      return {
        ...client,
        totalBalance: hasLive ? liveBal : (client.totalBalance || 0),
        totalEquity: hasLive ? liveEq : (client.totalEquity || 0),
        isLive: hasLive,
      }
    })
  }, [clients, liveBalances])

  const filteredData = useMemo(() => {
    return clientsWithLive.filter((client) => {
      const name = `${client.firstName || ''} ${client.lastName || client.name || ''}`.trim()
      const email = client.email || ''
      const id = String(client.id || '')
      const mt5LoginsStr = (client.mt5Logins || []).join(' ')
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mt5LoginsStr.includes(searchQuery)

      const clientStatus = client.status || ''
      const kycStatus = client.kyc?.status || client.kycStatus || ''
      const country = client.country || ''

      const matchesStatus = filters.status === 'all' || clientStatus === filters.status
      const matchesKYC = filters.kycStatus === 'all' || kycStatus === filters.kycStatus
      const matchesCountry = filters.country === 'all' || country === filters.country

      return matchesSearch && matchesStatus && matchesKYC && matchesCountry
    })
  }, [searchQuery, filters, clientsWithLive])

  const handleExport = () => {
    const csv = [
      ['ID', 'Name', 'Email', 'Phone', 'Country', 'Status', 'MT5 Logins', 'MT5 Accounts', 'Total Balance', 'KYC Status', 'Joined Date'],
      ...filteredData.map((c) => [
        c.id,
        `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        c.email,
        c.phone || c.phoneNumber || '',
        c.country,
        c.status,
        (c.mt5Logins || []).join('; '),
        c.mt5Accounts || 0,
        c.totalBalance || 0,
        c.kycStatus,
        c.createdAt ? formatDate(c.createdAt) : '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients.csv'
    a.click()
  }

  // Derive country options from actual data
  const countryOptions = useMemo(() => {
    const countries = [...new Set((clients || []).map(c => c.country).filter(Boolean))].sort()
    return [
      { label: 'All Countries', value: 'all' },
      ...countries.map(c => ({ label: c, value: c })),
    ]
  }, [clients])

  const handleAddClient = async () => {
    if (!newClient.firstName || !newClient.email || !newClient.password) {
      toast.error('First name, email and password are required')
      return
    }
    setCreating(true)
    try {
      await api.post('/auth/register', {
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        email: newClient.email,
        phone: newClient.phone,
        country: newClient.country,
        password: newClient.password,
      })
      toast.success('Client created successfully')
      setClientModal(false)
      setNewClient({ firstName: '', lastName: '', email: '', phone: '', country: 'India', password: '' })
      fetchClients()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create client')
    } finally {
      setCreating(false)
    }
  }

  // Summary stats
  const totalClients = filteredData.length
  const activeClients = filteredData.filter(c => c.status === 'active').length
  const totalMt5 = filteredData.reduce((sum, c) => sum + (c.mt5Accounts || 0), 0)
  const totalBal = filteredData.reduce((sum, c) => sum + (c.totalBalance || 0), 0)

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Clients</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Manage all clients and their accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            icon={RefreshCw}
            variant="secondary"
            onClick={() => fetchLiveBalances(clients)}
            isLoading={liveLoading}
          >
            Refresh Live
          </Button>
          <Button icon={Download} variant="secondary" onClick={handleExport}>
            Export
          </Button>
          <Button icon={Plus} variant="primary" onClick={() => setClientModal(true)}>
            New Client
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
            <p className="text-xs text-dark-500 dark:text-dark-400">Total Clients</p>
            <p className="text-2xl font-bold text-dark-900 dark:text-dark-50">{totalClients}</p>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
            <p className="text-xs text-dark-500 dark:text-dark-400">Active</p>
            <p className="text-2xl font-bold text-green-600">{activeClients}</p>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
            <p className="text-xs text-dark-500 dark:text-dark-400">MT5 Accounts</p>
            <p className="text-2xl font-bold text-primary-600">{totalMt5}</p>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
            <p className="text-xs text-dark-500 dark:text-dark-400">Total Balance {Object.keys(liveBalances).length > 0 && <span className="text-green-500">(Live)</span>}</p>
            <p className="text-2xl font-bold text-dark-900 dark:text-dark-50">{formatCurrency(totalBal, 'USD')}</p>
            {liveLoading && <p className="text-[10px] text-primary-500 mt-1 animate-pulse">Fetching live data...</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            onSearch={setSearchQuery}
            placeholder="Search name, email, ID or MT5 login..."
          />
          <Select
            label="Status"
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Inactive', value: 'inactive' },
            ]}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          />
          <Select
            label="KYC Status"
            options={[
              { label: 'All', value: 'all' },
              { label: 'Approved', value: 'approved' },
              { label: 'Pending', value: 'pending' },
              { label: 'Rejected', value: 'rejected' },
            ]}
            value={filters.kycStatus}
            onChange={(e) => setFilters({ ...filters, kycStatus: e.target.value })}
          />
          <Select
            label="Country"
            options={countryOptions}
            value={filters.country}
            onChange={(e) => setFilters({ ...filters, country: e.target.value })}
          />
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={filteredData}
              onRowClick={(row) => navigate(`/clients/${row.id}`)}
              pageSize={15}
            />
          </div>
        )}
      </Card>
      {/* Create Client Modal */}
      <Modal
        isOpen={clientModal}
        onClose={() => setClientModal(false)}
        title="Create New Client"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={newClient.firstName} onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })} placeholder="John" fullWidth />
            <Input label="Last Name" value={newClient.lastName} onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })} placeholder="Doe" fullWidth />
          </div>
          <Input label="Email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="john@example.com" fullWidth />
          <Input label="Phone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+91 9876543210" fullWidth />
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Country</label>
            <select value={newClient.country} onChange={(e) => setNewClient({ ...newClient, country: e.target.value })} className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50">
              <option value="India">India</option><option value="USA">USA</option><option value="UK">UK</option><option value="UAE">UAE</option><option value="Singapore">Singapore</option><option value="Australia">Australia</option><option value="Germany">Germany</option><option value="Canada">Canada</option><option value="France">France</option><option value="Japan">Japan</option>
            </select>
          </div>
          <Input label="Password" type="password" value={newClient.password} onChange={(e) => setNewClient({ ...newClient, password: e.target.value })} placeholder="Min 8 characters" fullWidth />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setClientModal(false)} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleAddClient} isLoading={creating} fullWidth>Create Client</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
