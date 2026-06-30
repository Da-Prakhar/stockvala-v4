import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Card, { CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Loader from '../components/ui/Loader'
import { pageTransitionVariants } from '../utils/animations'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'

const TicketDetailPage = () => {
  const { id } = useParams()
  const { user } = useAuthStore()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyMessage, setReplyMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchTicketData()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchTicketData = async () => {
    try {
      setIsLoading(true)
      const res = await api.get(`/support/tickets/${id}`)
      setTicket(res.data?.data)
      setMessages(res.data?.data?.messages || [])
    } catch (err) {
      toast.error('Failed to load ticket')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyMessage.trim()) return

    setIsSending(true)
    try {
      const res = await api.post(`/support/tickets/${id}/messages`, {
        message: replyMessage
      })
      setMessages([...messages, res.data?.data])
      setReplyMessage('')
    } catch (err) {
      toast.error('Failed to send message')
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center h-96 items-center"><Loader /></div>
  }

  if (!ticket) {
    return <div className="text-center mt-10">Ticket not found</div>
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Ticket Info */}
      <Card variant="elevated">
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Subject</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{ticket.subject}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
              <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 mt-1 uppercase">
                {ticket.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Priority</p>
              <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 mt-1 uppercase">
                {ticket.priority}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Created</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chat */}
      <Card variant="elevated">
        <CardBody>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Conversation
          </h3>

          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {messages.map((msg) => {
              const isUser = msg.senderType === 'user'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm p-4 rounded-lg ${
                      isUser
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-slate-900 dark:text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">{isUser ? 'You' : 'Support Team'}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs mt-2 opacity-75">{new Date(msg.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <form onSubmit={handleReply} className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Reply
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={3}
                  required
                  placeholder="Type your message..."
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="submit" variant="primary" loading={isSending} disabled={!replyMessage.trim()}>
                  Send Reply
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default TicketDetailPage
