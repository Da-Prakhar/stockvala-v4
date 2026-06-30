import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { SearchInput } from '../components/ui/SearchInput'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'


export default function SupportManagerPage() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assigned: 'all',
  })

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/support?limit=100')
      setTickets(response.data.data || [])
    } catch (err) {
      console.error('Error fetching support tickets:', err)
      toast.error('Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    return (tickets || []).filter(ticket => {
      const subject = ticket.subject || ''
      const client = ticket.user ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() : (ticket.client || '')
      const id = String(ticket.id || '')
      const matchesSearch = subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = filters.status === 'all' || (ticket.status || '') === filters.status
      const matchesPriority = filters.priority === 'all' || (ticket.priority || '') === filters.priority
      const matchesAssigned = filters.assigned === 'all'

      return matchesSearch && matchesStatus && matchesPriority && matchesAssigned
    })
  }, [searchQuery, filters, tickets])

  const priorityColor = {
    urgent: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'info',
  }

  const statusColor = {
    open: 'danger',
    in_progress: 'warning',
    resolved: 'success',
    closed: 'info',
  }

  const columns = [
    { key: 'id', label: 'Ticket ID', sortable: true },
    {
      key: 'client',
      label: 'Client',
      sortable: true,
      render: (value, row) => row.user ? `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || value : value,
    },
    { key: 'subject', label: 'Subject', sortable: true },
    {
      key: 'priority',
      label: 'Priority',
      render: (v) => v ? <StatusBadge status={priorityColor[v] || 'info'}>{v.toUpperCase()}</StatusBadge> : <span>-</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => v ? <StatusBadge status={statusColor[v] || 'info'}>{v.toUpperCase().replace('_', ' ')}</StatusBadge> : <span>-</span>,
    },
    { key: 'assigned', label: 'Assigned To', sortable: true, render: (v) => v || 'Unassigned' },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v) => v ? formatDate(v) : '-' },
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Support Tickets</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Manage customer support tickets ({filteredData.length})</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            onSearch={setSearchQuery}
            placeholder="Search tickets..."
          />
          <Select
            label="Status"
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Open', value: 'open' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Resolved', value: 'resolved' },
            ]}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          />
          <Select
            label="Priority"
            options={[
              { label: 'All Priorities', value: 'all' },
              { label: 'Urgent', value: 'urgent' },
              { label: 'High', value: 'high' },
              { label: 'Medium', value: 'medium' },
              { label: 'Low', value: 'low' },
            ]}
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          />
          <Select
            label="Assigned To"
            options={[
              { label: 'All', value: 'all' },
              { label: 'Unassigned', value: 'Unassigned' },
            ]}
            value={filters.assigned}
            onChange={(e) => setFilters({ ...filters, assigned: e.target.value })}
          />
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          {filteredData.length === 0 ? (
            <div className="p-4 text-dark-600 dark:text-dark-400">No support tickets found</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredData}
              onRowClick={(row) => navigate(`/support/${row.id}`)}
              pageSize={15}
            />
          )}
        </div>
      </Card>
    </motion.div>
  )
}
