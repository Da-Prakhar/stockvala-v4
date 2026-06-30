import { useEffect, useCallback } from 'react'
import { initSocket, getSocket, disconnectSocket, subscribeToChannel as socketSubscribe } from '../utils/socket'
import { useAuthStore } from '../store/authStore'

export const useSocket = () => {
  const { authToken } = useAuthStore()

  useEffect(() => {
    if (authToken) {
      initSocket(authToken)
    }

    return () => {
      // Don't disconnect on unmount to keep real-time updates
      // disconnectSocket()
    }
  }, [authToken])

  const subscribe = useCallback((channel, callback) => {
    return socketSubscribe(channel, callback)
  }, [])

  const emit = useCallback((event, data) => {
    const socket = getSocket()
    if (socket) {
      socket.emit(event, data)
    }
  }, [])

  const isConnected = getSocket()?.connected || false

  return {
    isConnected,
    subscribe,
    emit,
  }
}
