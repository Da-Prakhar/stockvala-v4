import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Send } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function TicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchTicket()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchTicket = async () => {
    try {
      setPageLoading(true)
      const res = await api.get(`/admin/support/${id}`)
      const data = res.data?.data || res.data
      setTicket(data)
      setMessages(data?.messages || [])
    } catch (err) {
      console.error('Error fetching ticket:', err)
      toast.error('Failed to load ticket')
    } finally {
      setPageLoading(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    setLoading(true)
    try {
      const res = await api.post(`/admin/support/${id}/respond`, {
        message: replyText,
        senderType: 'admin',
      })
      const newMsg = res.data?.data || res.data
      setMessages((prev) => [...prev, newMsg])
      toast.success('Reply sent to client')
      setReplyText('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true)
    try {
      await api.put(`/admin/support/${id}`, { status: newStatus })
      setTicket((prev) => ({ ...prev, status: newStatus }))
      toast.success('Status updated')
    } catch (err) {
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handlePriorityChange = async (newPriority) => {
    try {
      await api.put(`/admin/support/${id}`, { priority: newPriority })
      setTicket((prev) => ({ ...prev, priority: newPriority }))
      toast.success('Priority updated')
    } catch (err) {
      toast.error('Failed to update priority')
    }
  }

  const priorityColor = {
    urgent: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'info',
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-800 dark:text-red-200">
        Ticket not found
      </div>
    )
  }

  const clientName = ticket.user
    ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim()
    : ticket.client || 'Unknown'
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/support')}
          className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">{ticket.subject}</h1>
          <p className="text-dark-600 dark:text-dark-400">#{ticket.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Messages */}
          <Card>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-dark-500 dark:text-dark-400 text-center py-8">No messages yet</p>
              ) : (
                messages.map((msg) => {
                  const isAdmin = msg.senderType === 'admin' || msg.sender === 'admin'
                  const senderName = isAdmin
                    ? (msg.adminName || 'Support Team')
                    : clientName
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-sm px-4 py-2 rounded-lg ${
                          isAdmin
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-900 dark:text-dark-50'
                        }`}
                      >
                        <p className="text-sm font-semibold">{senderName}</p>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatDate(msg.createdAt || msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </Card>

          {/* Reply Box */}
          {!isResolved && (
            <Card>
              <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Send Reply</h3>
              <div className="space-y-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
                  rows="4"
                />
                <Button
                  icon={Send}
                  onClick={handleSendReply}
                  loading={loading}
                  fullWidth
                >
                  Send Reply
                </Button>
              </div>
            </Card>
          )}

          {isResolved && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200 text-sm">
              This ticket is {ticket.status}. Reopen it by changing the status to continue replying.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Client Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-600 dark:text-dark-400">Name</p>
                <p className="font-medium text-dark-900 dark:text-dark-50">{clientName}</p>
              </div>
              <div>
                <p className="text-sm text-dark-600 dark:text-dark-400">Email</p>
                <p className="font-medium text-dark-900 dark:text-dark-50">{ticket.user?.email || ticket.email || '-'}</p>
              </div>
            </div>
          </Card>

          {/* Ticket Info */}
          <Card>
            <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Ticket Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-600 dark:text-dark-400 mb-1">Status</p>
                <Select
                  options={[
                    { label: 'Open', value: 'open' },
                    { label: 'In Progress', value: 'in_progress' },
                    { label: 'Resolved', value: 'resolved' },
                    { label: 'Closed', value: 'closed' },
                  ]}
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                />
              </div>
              <div>
                <p className="text-sm text-dark-600 dark:text-dark-400 mb-1">Priority</p>
                <Select
                  options={[
                    { label: 'Urgent', value: 'urgent' },
                    { label: 'High', value: 'high' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Low', value: 'low' },
                  ]}
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                />
              </div>
              <div>
                <p className="text-sm text-dark-600 dark:text-dark-400">Created</p>
                <p className="font-medium text-dark-900 dark:text-dark-50">
                  {formatDate(ticket.createdAt || ticket.created)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
