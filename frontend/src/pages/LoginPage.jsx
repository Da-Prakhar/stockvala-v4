import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCompanyStore, getUploadUrl } from '../store/companyStore'
import { Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react'
import { USER_CRM_URL as LANDING_PAGE_URL } from '../utils/domainConfig'

// ── 6-digit OTP input ──────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([])

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const handleChange = (e, idx) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    const arr = value.split('')
    arr[idx] = v
    const next = arr.join('').padEnd(6, ' ').split('').slice(0, 6).join('').trimEnd()
    onChange(next)
    if (v && idx < 5) inputs.current[idx + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) onChange(pasted)
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          className="w-11 h-12 text-center text-xl font-bold bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      ))}
    </div>
  )
}

// ── Main Login Page ────────────────────────────────────────────────────────
export default function LoginPage() {
  const [step, setStep] = useState('credentials') // 'credentials' | '2fa'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // 2FA state
  const [twoFaMethod, setTwoFaMethod] = useState('email')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [pre2faToken, setPre2faToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const { login, verify2FA, isLoading } = useAuthStore()
  const { companyName, logoUrl, isLoaded } = useCompanyStore()
  const navigate = useNavigate()
  const location = useLocation()
  const registeredMsg = location.state?.registered

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleCredentials = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    const result = await login(email, password)
    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else if (result.requires2FA) {
      setTwoFaMethod(result.method)
      setMaskedEmail(result.maskedEmail || '')
      setPre2faToken(result.pre2faToken)
      setResendCooldown(60)
      setStep('2fa')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  const handleVerify2FA = async (e) => {
    e.preventDefault()
    setError('')
    const code = otpCode.replace(/\s/g, '')
    if (code.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    const result = await verify2FA(pre2faToken, code)
    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.error || 'Invalid code')
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setResending(true)
    try {
      const { default: api } = await import('../utils/api')
      await api.post('/auth/2fa/resend-otp', { pre2faToken })
      setResendCooldown(60)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            {logoUrl ? (
              <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-12 object-contain" />
            ) : isLoaded ? (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">{companyName.substring(0, 2).toUpperCase()}</span>
              </div>
            ) : null}
            <span className="text-2xl font-bold text-white truncate max-w-[200px]">{companyName}</span>
          </div>
          <p className="text-slate-400">
            {step === 'credentials' ? 'Sign in to your trading dashboard' : 'Two-Factor Verification'}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          {/* ── Step 1: Email + Password ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-5">
              {registeredMsg && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
                  Account created! Please sign in below.
                </div>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500" />
                  <span className="text-sm text-slate-400">Remember me</span>
                </label>
                <a href={`${LANDING_PAGE_URL}/forgot-password`} className="text-sm text-blue-400 hover:text-blue-300">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Step 2: 2FA Verification ── */}
          {step === '2fa' && (
            <form onSubmit={handleVerify2FA} className="space-y-5">
              {/* Shield icon */}
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-blue-400" />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {twoFaMethod === 'email' ? (
                <p className="text-slate-400 text-sm text-center">
                  We sent a 6-digit code to <span className="text-white font-medium">{maskedEmail}</span>. Enter it below.
                </p>
              ) : (
                <p className="text-slate-400 text-sm text-center">
                  Enter the 6-digit code from your <span className="text-white font-medium">authenticator app</span>.
                </p>
              )}

              <OtpInput value={otpCode} onChange={setOtpCode} />

              <button
                type="submit"
                disabled={isLoading || otpCode.replace(/\s/g, '').length < 6}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              {twoFaMethod === 'email' && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending || resendCooldown > 0}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:text-slate-500 flex items-center gap-1.5 mx-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtpCode(''); setError('') }}
                className="w-full text-sm text-slate-400 hover:text-white text-center py-1"
              >
                ← Back to login
              </button>
            </form>
          )}

          {step === 'credentials' && (
            <div className="mt-6 text-center">
              <p className="mt-6 text-center text-slate-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                  Create account
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-slate-500 text-xs">Register on the main site first, then sign in here</p>
        </div>
      </div>
    </div>
  )
}
