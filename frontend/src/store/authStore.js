import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      authToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (authToken, refreshToken) => {
        localStorage.setItem('authToken', authToken)
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }
        set({ authToken, refreshToken })
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const resData = response.data?.data || response.data

          // 2FA challenge — backend returns requires2FA=true instead of tokens
          if (resData?.requires2FA) {
            set({ isLoading: false })
            return {
              success: false,
              requires2FA: true,
              method: resData.method,
              maskedEmail: resData.maskedEmail,
              pre2faToken: resData.pre2faToken,
            }
          }

          const { user, accessToken, refreshToken } = resData
          localStorage.setItem('authToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('user', JSON.stringify(user))

          set({
            user,
            authToken: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message || 'Login failed'
          console.error('Login error:', errorMessage)
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      verify2FA: async (pre2faToken, code) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/2fa/verify', { pre2faToken, code })
          const resData = response.data?.data || response.data
          const { user, accessToken, refreshToken } = resData

          localStorage.setItem('authToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('user', JSON.stringify(user))

          set({
            user,
            authToken: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message || 'Verification failed'
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      register: async (firstName, lastName, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/register', {
            firstName,
            lastName,
            email,
            password,
          })
          // Backend returns { success, data: { user, accessToken, refreshToken } }
          const resData = response.data?.data || response.data
          const { user, accessToken, refreshToken } = resData

          localStorage.setItem('authToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('user', JSON.stringify(user))

          set({
            user,
            authToken: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message || 'Registration failed'
          console.error('Registration error:', errorMessage)
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      logout: () => {
        localStorage.removeItem('authToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        set({
          user: null,
          authToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        })
      },

      refreshAuth: async () => {
        // Don't call API if no token exists
        const token = localStorage.getItem('authToken')
        if (!token) {
          // Try to restore user from localStorage without API call
          const savedUser = localStorage.getItem('user')
          if (savedUser) {
            try {
              const user = JSON.parse(savedUser)
              set({ user, isAuthenticated: true, authToken: token })
              return true
            } catch (e) { /* invalid JSON, continue to clear */ }
          }
          set({ user: null, authToken: null, refreshToken: null, isAuthenticated: false })
          return false
        }

        try {
          const response = await api.get('/auth/me')
          const user = response.data?.data || response.data

          localStorage.setItem('user', JSON.stringify(user))
          set({
            user,
            isAuthenticated: true,
          })
          return true
        } catch (error) {
          console.error('Refresh auth error:', error.message)
          localStorage.removeItem('authToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          set({
            user: null,
            authToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
          return false
        }
      },

      updateProfile: (updates) => {
        const current = get()
        const updatedUser = { ...current.user, ...updates }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        set({ user: updatedUser })
      },

      updateBalance: (newBalance) => {
        const current = get()
        const updatedUser = { ...current.user, balance: newBalance }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        set({ user: updatedUser })
      },
    }),
    {
      name: 'auth-store',
      version: 1,
    }
  )
)
