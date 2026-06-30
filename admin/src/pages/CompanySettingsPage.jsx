import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, Mail, Server, Eye, EyeOff, Send, ShieldCheck } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { API_URL } from '../utils/domainConfig'

const apiBase = API_URL.replace(/\/api\/?$/, '')

function getUploadUrl(v) {
  if (!v) return null
  if (v.startsWith('http')) return v
  const uploadsIdx = v.indexOf('uploads/')
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : v.replace(/^\//, '')
  return `${apiBase}/${relativePath}`
}

export default function CompanySettingsPage() {
  const defaultForm = {
    companyName: '',
    email: '',
    phone: '',
    address: '',
    facebook: '',
    twitter: '',
    linkedin: '',
    footerText: '',
    disclaimer: 'Past performance is not indicative of future results...',
    logoUrl: '',
    faviconUrl: '',
  }

  const defaultSmtp = {
    host: '',
    port: '465',
    user: '',
    password: '',
    fromName: '',
    fromEmail: '',
  }

  const [formData, setFormData] = useState(defaultForm)
  const [smtpForm, setSmtpForm] = useState(defaultSmtp)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)

  // 2FA security settings
  const [securityForm, setSecurityForm] = useState({
    two_factor_required: false,
    two_factor_methods_allowed: 'email,totp',
  })
  const [securityLoading, setSecurityLoading] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/admin/settings/company')
        const data = res.data?.data || res.data
        const s = data?.settings || data || {}
        if (Object.keys(s).length) {
          setFormData((prev) => ({
            ...prev,
            companyName: s.companyName || prev.companyName,
            email: s.email || prev.email,
            phone: s.phone || prev.phone,
            address: s.address || prev.address,
            facebook: s.facebook || prev.facebook,
            twitter: s.twitter || prev.twitter,
            linkedin: s.linkedin || prev.linkedin,
            footerText: s.footerText || prev.footerText,
            disclaimer: s.disclaimer || prev.disclaimer,
            logoUrl: s.logoUrl || prev.logoUrl,
            faviconUrl: s.faviconUrl || prev.faviconUrl,
          }))
        }
      } catch (err) {
        console.warn('Company settings not fetched:', err.message)
      }
    }

    const fetchSmtp = async () => {
      try {
        const res = await api.get('/admin/settings/smtp')
        const data = res.data?.data || res.data
        const s = data?.settings || data || {}
        if (Object.keys(s).length) {
          setSmtpForm(prev => ({
            ...prev,
            host: s.host || prev.host,
            port: String(s.port || prev.port || '465'),
            user: s.user || prev.user,
            password: s.password || prev.password,
            fromName: s.fromName || prev.fromName,
            fromEmail: s.fromEmail || prev.fromEmail,
          }))
        }
      } catch (err) {
        console.warn('SMTP settings not fetched:', err.message)
      }
    }

    const fetchSecurity = async () => {
      try {
        const res = await api.get('/admin/settings/security')
        const data = res.data?.data || res.data
        const s = data?.settings || data || {}
        setSecurityForm(prev => ({
          two_factor_required: s.two_factor_required === 'true' || s.two_factor_required === true,
          two_factor_methods_allowed: s.two_factor_methods_allowed || prev.two_factor_methods_allowed,
        }))
      } catch (_) {}
    }

    fetchSettings()
    fetchSmtp()
    fetchSecurity()
  }, [])

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSmtpChange = (field, value) => {
    setSmtpForm({ ...smtpForm, [field]: value })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await api.put('/admin/settings/company', formData)
      toast.success('Company settings saved successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSmtpSave = async () => {
    if (!smtpForm.host || !smtpForm.user || !smtpForm.password) {
      toast.error('SMTP Host, User, and Password are required')
      return
    }
    setSmtpLoading(true)
    try {
      await api.put('/admin/settings/smtp', smtpForm)
      toast.success('SMTP settings saved successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save SMTP settings')
    } finally {
      setSmtpLoading(false)
    }
  }

  const handleSecuritySave = async () => {
    setSecurityLoading(true)
    try {
      await api.put('/admin/settings/security', {
        two_factor_required: String(securityForm.two_factor_required),
        two_factor_methods_allowed: securityForm.two_factor_methods_allowed,
      })
      toast.success('Security settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save security settings')
    } finally {
      setSecurityLoading(false)
    }
  }

  const handleTestEmail = async () => {
    setTestLoading(true)
    try {
      await api.post('/admin/settings/test-email')
      toast.success('Test email sent! Check your admin inbox.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test email')
    } finally {
      setTestLoading(false)
    }
  }

  const handleImageUpload = async (file, type) => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/admin/settings/upload?type=${type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = res.data?.data?.url || res.data?.url;
      if (url) {
        const field = type === 'logo' ? 'logoUrl' : 'faviconUrl';
        setFormData(prev => ({ ...prev, [field]: url }));
        // Persist the URL to company settings immediately
        try {
          await api.put('/admin/settings/company', { [field]: url });
        } catch (_) { /* will be saved when user clicks Save */ }
        toast.success(`${type} uploaded successfully!`);
      }
    } catch (err) {
      toast.error(`Failed to upload ${type}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Company Settings</h1>
        <p className="text-dark-600 dark:text-dark-400 mt-1">Manage company branding, information, and email configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo Section */}
        <Card>
          <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Logo</h3>
          <div className="bg-dark-100 dark:bg-dark-700 h-32 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-dark-300 dark:border-dark-600 overflow-hidden">
            {formData.logoUrl ? (
              <img src={getUploadUrl(formData.logoUrl)} alt="Logo" className="max-h-full object-contain" />
            ) : (
              <div className="text-center">
                <p className="text-sm text-dark-600 dark:text-dark-400">No logo uploaded</p>
              </div>
            )}
          </div>
          <Button icon={Upload} variant="secondary" fullWidth onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = e => handleImageUpload(e.target.files[0], 'logo');
            input.click();
          }}>
            Upload Logo
          </Button>
        </Card>

        {/* Favicon Section */}
        <Card>
          <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Favicon</h3>
          <div className="bg-dark-100 dark:bg-dark-700 h-32 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-dark-300 dark:border-dark-600 overflow-hidden">
            {formData.faviconUrl ? (
              <img src={getUploadUrl(formData.faviconUrl)} alt="Favicon" className="max-h-full object-contain" />
            ) : (
              <div className="text-center">
                <p className="text-sm text-dark-600 dark:text-dark-400">No favicon uploaded</p>
              </div>
            )}
          </div>
          <Button icon={Upload} variant="secondary" fullWidth onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = e => handleImageUpload(e.target.files[0], 'favicon');
            input.click();
          }}>
            Upload Favicon
          </Button>
        </Card>

        {/* Preview */}
        <Card>
          <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-4">Preview</h3>
          <div className="bg-dark-100 dark:bg-dark-700 h-32 rounded-lg p-4 flex items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {formData.companyName ? formData.companyName.substring(0, 2).toUpperCase() : 'CO'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Company Info */}
      <Card>
        <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-6">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            fullWidth
          />
          <Input
            label="Contact Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            fullWidth
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            fullWidth
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            fullWidth
          />
        </div>
      </Card>

      {/* Social Media */}
      <Card>
        <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-6">Social Media Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Facebook"
            value={formData.facebook}
            onChange={(e) => handleChange('facebook', e.target.value)}
            fullWidth
            placeholder="https://facebook.com/yourcompany"
          />
          <Input
            label="Twitter"
            value={formData.twitter}
            onChange={(e) => handleChange('twitter', e.target.value)}
            fullWidth
            placeholder="https://twitter.com/yourcompany"
          />
          <Input
            label="LinkedIn"
            value={formData.linkedin}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            fullWidth
            placeholder="https://linkedin.com/company/yourcompany"
          />
        </div>
      </Card>

      {/* Footer & Disclaimer */}
      <Card>
        <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-6">Footer & Legal</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Footer Text
            </label>
            <textarea
              value={formData.footerText}
              onChange={(e) => handleChange('footerText', e.target.value)}
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Risk Disclaimer
            </label>
            <textarea
              value={formData.disclaimer}
              onChange={(e) => handleChange('disclaimer', e.target.value)}
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
              rows="4"
            />
          </div>
        </div>
      </Card>

      {/* Save Company Button */}
      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={() => setFormData(defaultForm)}>
          Reset
        </Button>
        <Button variant="primary" onClick={handleSave} loading={loading} fullWidth>
          Save Company Settings
        </Button>
      </div>

      {/* ═══════ Security / 2FA Settings ═══════ */}
      <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-dark-50 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary-500" />
          Security Settings
        </h2>
        <p className="text-dark-600 dark:text-dark-400 mt-1">Configure two-factor authentication policy for all users.</p>
      </div>

      <Card>
        <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-1">Two-Factor Authentication (2FA)</h3>
        <p className="text-xs text-dark-500 dark:text-dark-400 mb-5">
          When enabled globally, every user must verify their identity on each login regardless of their personal settings.
        </p>

        <div className="space-y-4">
          {/* Global 2FA toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-50 dark:bg-dark-700/50 border border-dark-200 dark:border-dark-700">
            <div>
              <p className="font-medium text-dark-900 dark:text-dark-50 text-sm">Require 2FA for all users</p>
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">Force every login to go through a second verification step</p>
            </div>
            <button
              type="button"
              onClick={() => setSecurityForm(p => ({ ...p, two_factor_required: !p.two_factor_required }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                securityForm.two_factor_required ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                securityForm.two_factor_required ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Allowed methods */}
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Allowed 2FA Methods</label>
            <div className="flex gap-3">
              {[{ key: 'email', label: 'Email OTP', desc: 'Send a 6-digit code via email' }, { key: 'totp', label: 'Authenticator App', desc: 'Google Authenticator / Authy' }].map(m => {
                const enabled = securityForm.two_factor_methods_allowed.includes(m.key)
                return (
                  <label key={m.key} className={`flex-1 flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    enabled
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800'
                  }`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => {
                        const methods = securityForm.two_factor_methods_allowed.split(',').filter(Boolean)
                        const next = enabled ? methods.filter(x => x !== m.key) : [...methods, m.key]
                        setSecurityForm(p => ({ ...p, two_factor_methods_allowed: next.join(',') || 'email' }))
                      }}
                      className="mt-0.5 accent-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-dark-900 dark:text-dark-50">{m.label}</p>
                      <p className="text-xs text-dark-500 dark:text-dark-400">{m.desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Button variant="primary" onClick={handleSecuritySave} loading={securityLoading} fullWidth>
            Save Security Settings
          </Button>
        </div>
      </Card>

      {/* ═══════ SMTP / Email Configuration ═══════ */}
      <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-dark-50 flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary-500" />
          Email / SMTP Configuration
        </h2>
        <p className="text-dark-600 dark:text-dark-400 mt-1">Configure outgoing email. New deployers only need to update these fields.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Server className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-dark-900 dark:text-dark-50">SMTP Server</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="SMTP Host"
            value={smtpForm.host}
            onChange={(e) => handleSmtpChange('host', e.target.value)}
            placeholder="mail.yourdomain.com"
            fullWidth
          />
          <Input
            label="SMTP Port"
            value={smtpForm.port}
            onChange={(e) => handleSmtpChange('port', e.target.value)}
            placeholder="465"
            fullWidth
          />
          <Input
            label="SMTP Username (Email)"
            value={smtpForm.user}
            onChange={(e) => handleSmtpChange('user', e.target.value)}
            placeholder="noreply@yourdomain.com"
            fullWidth
          />
          <div className="relative">
            <Input
              label="SMTP Password"
              type={showSmtpPass ? 'text' : 'password'}
              value={smtpForm.password}
              onChange={(e) => handleSmtpChange('password', e.target.value)}
              placeholder="••••••••"
              fullWidth
            />
            <button
              type="button"
              onClick={() => setShowSmtpPass(!showSmtpPass)}
              className="absolute right-3 top-9 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
            >
              {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            label="From Name (Display)"
            value={smtpForm.fromName}
            onChange={(e) => handleSmtpChange('fromName', e.target.value)}
            placeholder="Your Company Name"
            fullWidth
          />
          <Input
            label="From Email"
            value={smtpForm.fromEmail}
            onChange={(e) => handleSmtpChange('fromEmail', e.target.value)}
            placeholder="noreply@yourdomain.com"
            fullWidth
          />
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" icon={Send} onClick={handleTestEmail} loading={testLoading}>
            Send Test Email
          </Button>
          <Button variant="primary" onClick={handleSmtpSave} loading={smtpLoading} fullWidth>
            Save SMTP Settings
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
