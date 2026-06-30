import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import { useNotificationStore } from '../store/notificationStore'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import { formatRelativeTime } from '../utils/formatters'

const NotificationsPage = () => {
  const { notifications, markAsRead, deleteNotification, markAllAsRead, fetchNotifications } =
    useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const typeColors = {
    success: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-l-4 border-green-500',
    warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-l-4 border-yellow-500',
    info: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-l-4 border-blue-500',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-l-4 border-red-500',
  }

  const typeIcons = {
    success: '✓',
    warning: '⚠',
    info: 'ℹ',
    error: '✕',
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            You have {notifications.filter((n) => !n.read).length} unread notifications
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <Button variant="secondary" size="sm" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {notifications.length === 0 ? (
          <Card variant="elevated">
            <CardBody>
              <p className="text-center text-slate-600 dark:text-slate-400 py-8">
                No notifications yet
              </p>
            </CardBody>
          </Card>
        ) : (
          notifications.map((notif) => (
            <motion.div key={notif.id} variants={itemVariants}>
              <Card
                variant="elevated"
                className={`${typeColors[notif.type] || typeColors.info} ${
                  !notif.read ? 'opacity-100' : 'opacity-75'
                }`}
              >
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="text-2xl flex-shrink-0">
                      {typeIcons[notif.type]}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{notif.title}</h3>
                          <p className="text-sm mt-1 opacity-90">{notif.message}</p>
                          <p className="text-xs mt-2 opacity-75">
                            {formatRelativeTime(notif.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
    </motion.div>
  )
}

export default NotificationsPage
