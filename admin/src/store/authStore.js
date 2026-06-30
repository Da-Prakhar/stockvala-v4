import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      role: null,
      permissions: [],
      token: null,

      login: async (email, password) => {
        try {
          const response = await api.post('/auth/admin/login', { email, password })
          // Backend returns { success, data: { user, accessToken, refreshToken } }
          const resData = response.data?.data || response.data
          const { user, accessToken, refreshToken } = resData

          // Store token for API calls
          if (accessToken) {
            localStorage.setItem('token', accessToken)
            localStorage.setItem('refreshToken', refreshToken)
          }

          set({
            user,
            isAuthenticated: true,
            role: user?.role || 'admin',
            permissions: user?.permissions || [],
            token: accessToken,
          })

          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.message || 'Login failed'
          throw new Error(message)
        }
      },

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          role: null,
          permissions: [],
          token: null,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: { ...state.user, ...userData },
        })),

      hasPermission: (permission) => {
        return useAuthStore.getState().permissions.includes(permission)
      },
    }),
    {
      name: 'auth-store',
    }
  )
)
