import { create } from 'zustand'
import api from '../utils/api'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  addNotification: (notification) => {
    const newNotification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))

    return newNotification.id
  },

  markAsRead: async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      set((state) => {
        const notification = state.notifications.find((n) => n.id === notificationId)
        const wasUnread = notification && !notification.read

        return {
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
          unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
        }
      })
    } catch (error) {
      console.error('Mark as read error:', error.message)
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all')
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch (error) {
      console.error('Mark all as read error:', error.message)
    }
  },

  deleteNotification: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
    }))
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 })
  },

  fetchNotifications: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get('/notifications')
      const notifications = response.data?.data || []
      const unreadCount = notifications.filter((n) => !n.read).length
      set({
        notifications,
        unreadCount,
        isLoading: false,
      })
      return notifications
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch notifications'
      console.error('Fetch notifications error:', errorMessage)
      set({ error: errorMessage, isLoading: false, notifications: [] })
      return []
    }
  },
}))
