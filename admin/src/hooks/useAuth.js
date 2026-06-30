import { useAuthStore } from '../store/authStore'

export const useAuth = () => {
  const { user, isAuthenticated, role, permissions, token, login, logout, updateUser } = useAuthStore()

  return {
    user,
    isAuthenticated,
    role,
    permissions,
    token,
    login,
    logout,
    updateUser,
  }
}
