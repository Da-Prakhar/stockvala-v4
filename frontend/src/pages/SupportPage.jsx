import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, MessageSquare } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'

const SupportPage = () => {
  const navigate = useNavigate()
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await api.get('/support/tickets')
        setTickets(response.data?.data || [])
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch tickets'
        console.error('Fetch tickets error:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()
  }, [])

  const handleCreateTicket = async (formData) => {
    setIsCreating(true)
    try {
      const response = await api.post('/support/tickets', {
        subject: formData.title,
        category: 'general',
        description: formData.message,
        priority: formData.priority,
      })
      setTickets([response.data?.data, ...tickets])
      setShowCreateTicket(false)
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create ticket'
      console.error('Create ticket error:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    }
    return colors[status] || colors.open
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-slate-600 dark:text-slate-400',
      medium: 'text-orange-600 dark:text-orange-400',
      high: 'text-red-600 dark:text-red-400',
      urgent: 'text-red-700 dark:text-red-300 font-bold',
    }
    return colors[priority] || colors.low
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader />
      </div>
    )
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Support Tickets
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your support requests
          </p>
        </div>
        <Button
          onClick={() => setShowCreateTicket(true)}
          variant="primary"
          className="w-full md:w-auto"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Ticket
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">Error: {error}</p>
        </div>
      )}

      {/* Tickets List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {tickets.length > 0 ? (
          tickets.map((ticket, idx) => (
          <motion.div key={ticket.id} variants={itemVariants}>
            <Card
              variant="elevated"
              hoverable
              onClick={() => navigate(`/support/${ticket.id}`)}
              className="cursor-pointer"
            >
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-5 w-5 text-primary-500" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {ticket.subject || ticket.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                        {(ticket.priority || 'medium').toUpperCase()}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ticket.date}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 ml-4">
                    {ticket.messages ? ticket.messages.length : 0} messages
                  </span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
          ))
        ) : (
          <Card variant="elevated">
            <CardBody className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                No support tickets yet
              </p>
            </CardBody>
          </Card>
        )}
      </motion.div>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={showCreateTicket}
        onClose={() => setShowCreateTicket(false)}
        title="Create Support Ticket"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.target)
            handleCreateTicket({
              title: formData.get('title'),
              priority: formData.get('priority'),
              message: formData.get('message'),
            })
          }}
          className="space-y-4"
        >
          <Input
            label="Subject"
            placeholder="Describe your issue"
            name="title"
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Priority
            </label>
            <select
              name="priority"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Message
            </label>
            <textarea
              name="message"
              rows={4}
              placeholder="Describe your issue in detail..."
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowCreateTicket(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}

export default SupportPage
