import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export const useAuth = () => {
  const store = useAuthStore()

  useEffect(() => {
    // Initialize auth from localStorage on mount
    const hasAuth = store.refreshAuth()
    if (!hasAuth && !store.isAuthenticated) {
      // User is not authenticated
    }
  }, [])

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login: store.login,
    logout: store.logout,
    updateProfile: store.updateProfile,
    updateBalance: store.updateBalance,
  }
}
