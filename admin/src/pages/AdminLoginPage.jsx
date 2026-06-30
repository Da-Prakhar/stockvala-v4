import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import toast from 'react-hot-toast'
import { useCompanyStore, getUploadUrl } from '../store/companyStore'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { companyName, logoUrl } = useCompanyStore()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(formData.email, formData.password)
      toast.success('Login successful!')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-primary-600/20">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="inline-flex items-center justify-center mb-4"
            >
              {logoUrl ? (
                <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">{companyName.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </motion.div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50 mb-2 truncate px-4">
              {companyName} Admin
            </h1>
            <p className="text-dark-600 dark:text-dark-400">Broker Control Panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              icon={Mail}
              placeholder="admin@example.com"
              fullWidth
              required
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                icon={Lock}
                placeholder="Enter your password"
                fullWidth
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </div>

            <Button
              type="submit"
              loading={loading}
              fullWidth
              className="mt-6 h-11"
            >
              Sign In to Dashboard
            </Button>
          </form>

          {/* Demo credentials removed for production */}
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-sm text-dark-400 dark:text-dark-500"
        >
          {companyName} Broker Admin Panel v1.0.0
        </motion.p>
      </motion.div>
    </div>
  )
}
