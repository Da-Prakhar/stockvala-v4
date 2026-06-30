import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * Handles token handoff from the landing page (localhost:3000)
 * to the user CRM (localhost:3001).
 * Tokens are passed via URL params since different ports have separate localStorage.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser, setTokens } = useAuthStore()

  useEffect(() => {
    const authToken = searchParams.get('authToken')
    const refreshToken = searchParams.get('refreshToken')
    const userParam = searchParams.get('user')

    if (authToken) {
      // Store tokens in this domain's localStorage
      setTokens(authToken, refreshToken)

      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam))
          localStorage.setItem('user', JSON.stringify(user))
          setUser(user)
        } catch (e) {
          console.error('Failed to parse user data:', e)
        }
      }

      // Clean URL and redirect to dashboard
      navigate('/dashboard', { replace: true })
    } else {
      // No tokens — redirect to login
      navigate('/login', { replace: true })
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg">Signing you in...</div>
    </div>
  )
}
