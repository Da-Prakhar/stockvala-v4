import io from 'socket.io-client'
import { WS_URL } from './domainConfig'

const SOCKET_URL = WS_URL

let socket = null

export const initSocket = (token) => {
  if (socket?.connected) {
    return socket
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })

  return socket
}

export const getSocket = () => {
  return socket
}

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect()
    socket = null
  }
}

export const subscribeToChannel = (channel, callback) => {
  if (!socket) return

  socket.on(channel, callback)

  return () => {
    socket.off(channel, callback)
  }
}

export const emit = (event, data) => {
  if (!socket) return

  socket.emit(event, data)
}
