import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCompanyStore, getUploadUrl } from '../store/companyStore'
import { useAuthStore } from '../store/authStore'
import { Eye, EyeOff, ChevronRight, ChevronLeft, Check, Mail, Lock, Phone, Globe, KeyRound } from 'lucide-react'
import api from '../utils/api'

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Chad','Chile','China',
  'Colombia','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark',
  'Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','Fiji',
  'Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Guinea',
  'Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos',
  'Latvia','Lebanon','Libya','Liechtenstein','Lithuania','Luxembourg','Malaysia',
  'Maldives','Mali','Malta','Mauritius','Mexico','Moldova','Monaco','Mongolia',
  'Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','Norway','Oman','Pakistan','Palestine',
  'Panama','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Somalia','South Africa','South Korea','Spain','Sri Lanka',
  'Sudan','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand',
  'Togo','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]

function ProgressBar({ step }) {
  return (
    <div className="mb-8">
      <div className="flex gap-2 mb-2">
        {[1, 2, 3].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            n < step ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
            n === step ? 'bg-blue-500' :
            'bg-slate-700'
          }`} />
        ))}
      </div>
      <p className="text-xs text-slate-400 text-center">Step {step} of 3</p>
    </div>
  )
}

export default function RegisterPage() {
  const { companyName, logoUrl, isLoaded } = useCompanyStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser, setTokens } = useAuthStore()

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    referralCode: '',
    acceptTerms: false,
    acceptMarketing: false,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) set('referralCode', ref.toUpperCase())
  }, [])

  const validateStep1 = () => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address'); return false
    }
    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters'); return false
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match'); return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!form.firstName.trim()) { setError('First name is required'); return false }
    if (!form.lastName.trim()) { setError('Last name is required'); return false }
    if (!form.phone.trim()) { setError('Phone number is required'); return false }
    if (!form.country) { setError('Please select your country'); return false }
    return true
  }

  const nextStep = () => {
    setError('')
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.acceptTerms) { setError('You must accept the Terms & Conditions to continue'); return }
    setIsLoading(true)
    try {
      const response = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        country: form.country,
        referralCode: form.referralCode || undefined,
      })
      const resData = response.data?.data || response.data
      const { user, accessToken, refreshToken } = resData || {}

      if (accessToken) {
        // Auto-login — backend already issued tokens on register, no need to
        // send the user back through the login form
        setTokens(accessToken, refreshToken)
        setUser(user)
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { state: { registered: true } })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputBase = 'w-full bg-slate-800/80 border border-slate-600/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm'
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5'

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d1117 0%, #0f1a2e 50%, #0d1117 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-5">
            {logoUrl ? (
              <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-10 object-contain" />
            ) : isLoaded ? (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">{(companyName || 'SV').substring(0, 2).toUpperCase()}</span>
              </div>
            ) : null}
            {companyName && <span className="text-xl font-bold text-white">{companyName}</span>}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Create Account</h1>
          <p className="text-slate-400 text-sm">Join 500K+ traders worldwide</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-7">
          <ProgressBar step={step} />

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className={labelCls}>Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    className={inputBase + ' pl-10 pr-4 py-3'}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={inputBase + ' pl-10 pr-10 py-3'}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="flex gap-1 mt-2">
                    {[form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password)].map((ok, i) => (
                      <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${ok ? 'bg-blue-500' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={inputBase + ' pl-10 pr-10 py-3'}
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button onClick={nextStep}
                className="w-full py-3 mt-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 text-sm">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input type="text" className={inputBase + ' px-4 py-3'} placeholder="John"
                    value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input type="text" className={inputBase + ' px-4 py-3'} placeholder="Doe"
                    value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="tel" className={inputBase + ' pl-10 pr-4 py-3'} placeholder="+1 234 567 8900"
                    value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Country</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select className={inputBase + ' pl-10 pr-4 py-3 appearance-none cursor-pointer'}
                    value={form.country} onChange={e => set('country', e.target.value)}
                    style={{ background: 'rgba(15,23,42,0.8)' }}>
                    <option value="">Select your country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setStep(1); setError('') }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-1 text-sm border border-slate-700">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={nextStep}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 space-y-2.5">
                {[
                  { label: 'Email', value: form.email },
                  { label: 'Name', value: `${form.firstName} ${form.lastName}` },
                  { label: 'Country', value: form.country },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{row.label}</span>
                    <span className="text-white font-medium truncate ml-4 max-w-[180px]">{row.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className={labelCls}>Referral Code <span className="text-slate-500 font-normal">(optional)</span></label>
                <input type="text" className={inputBase + ' px-4 py-3'} placeholder="Enter referral code"
                  value={form.referralCode} onChange={e => set('referralCode', e.target.value.toUpperCase())} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <button type="button" onClick={() => set('acceptTerms', !form.acceptTerms)}
                  className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                    form.acceptTerms ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-600 hover:border-blue-500'
                  }`}>
                  {form.acceptTerms && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-xs text-slate-400 leading-relaxed">
                  I agree to the{' '}
                  <Link to="/legal/terms" target="_blank" className="text-blue-400 hover:text-blue-300">Terms</Link>,{' '}
                  <Link to="/legal/privacy" target="_blank" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>{' '}
                  and{' '}
                  <Link to="/legal/risk-disclosure" target="_blank" className="text-blue-400 hover:text-blue-300">Risk Disclosure</Link>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <button type="button" onClick={() => set('acceptMarketing', !form.acceptMarketing)}
                  className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                    form.acceptMarketing ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-600 hover:border-blue-500'
                  }`}>
                  {form.acceptMarketing && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-xs text-slate-400 leading-relaxed">
                  I'd like to receive market updates and promotions from {companyName || 'us'}
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep(2); setError('') }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-1 text-sm border border-slate-700">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  {isLoading ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-slate-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
