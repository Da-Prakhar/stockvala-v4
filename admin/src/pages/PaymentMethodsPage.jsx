import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  Image as ImageIcon,
  QrCode,
  RefreshCw,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Loader } from '../components/ui/Loader'
import { formatCurrency } from '../utils/formatters'
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

const emptyForm = {
  type: 'bank',
  name: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  ifsc: '',
  network: 'TRC20',
  walletAddress: '',
  upiId: '',
  contactNumber: '',
  instructions: '',
  minAmount: 100,
  maxAmount: 500000,
  isActive: true,
}

const typeIcons = { bank: '🏦', usdt: '₮', upi: '📱', angadiya: '🤝', other: '💳' }

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null })
  const [formData, setFormData] = useState(emptyForm)
  const [uploadingQr, setUploadingQr] = useState(null)
  const qrInputRef = useRef(null)

  useEffect(() => {
    fetchMethods()
  }, [])

  const fetchMethods = async () => {
    try {
      setLoading(true)
      // Use admin endpoint which returns flattened details
      const res = await api.get('/admin/payment-methods')
      setMethods(res.data?.data || res.data || [])
    } catch (err) {
      console.error('Error fetching payment methods:', err)
      // Fallback to user endpoint
      try {
        const res2 = await api.get('/funds/payment-methods')
        const raw = res2.data?.data || res2.data || []
        // Flatten details for display
        setMethods(raw.map(m => {
          const d = typeof m.details === 'string' ? JSON.parse(m.details) : (m.details || {})
          return { ...m, ...d, ifsc: d.ifscCode || '' }
        }))
      } catch (err2) {
        toast.error('Failed to load payment methods')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setModalOpen(true)
  }

  const handleOpenEdit = (method) => {
    setEditingId(method.id)
    setFormData({
      type: method.type || 'bank',
      name: method.name || '',
      bankName: method.bankName || '',
      accountNumber: method.accountNumber || '',
      accountHolder: method.accountHolder || '',
      ifsc: method.ifsc || method.ifscCode || '',
      network: method.network || 'TRC20',
      walletAddress: method.walletAddress || '',
      upiId: method.upiId || '',
      contactNumber: method.contactNumber || '',
      instructions: method.instructions || '',
      minAmount: method.minAmount || 100,
      maxAmount: method.maxAmount || 500000,
      isActive: method.isActive !== false,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Method name is required')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await api.put(`/admin/payment-methods/${editingId}`, formData)
        const updated = res.data?.data || res.data
        setMethods((prev) => prev.map((m) => m.id === editingId ? { ...m, ...updated } : m))
        toast.success('Payment method updated')
      } else {
        const res = await api.post('/admin/payment-methods', formData)
        const created = res.data?.data || res.data
        setMethods((prev) => [...prev, created])
        toast.success('Payment method added')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payment method')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (method) => {
    try {
      const res = await api.put(`/admin/payment-methods/${method.id}`, { isActive: !method.isActive })
      const updated = res.data?.data || res.data
      setMethods((prev) => prev.map((m) => m.id === method.id ? { ...m, ...updated, isActive: !method.isActive } : m))
      toast.success(`Payment method ${!method.isActive ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/payment-methods/${deleteModal.id}`)
      setMethods((prev) => prev.filter((m) => m.id !== deleteModal.id))
      toast.success('Payment method deleted')
    } catch (err) {
      toast.error('Failed to delete payment method')
    } finally {
      setDeleteModal({ isOpen: false, id: null })
    }
  }

  const handleQrUpload = async (methodId, file) => {
    if (!file) return
    setUploadingQr(methodId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      let res
      try {
        res = await api.post(`/admin/payment-methods/${methodId}/qr?type=qr`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } catch (adminErr) {
        // Fallback to fund route if admin route not available
        res = await api.post(`/funds/payment-methods/${methodId}/qr?type=qr`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }
      const updated = res.data?.data || res.data
      setMethods((prev) => prev.map((m) => m.id === methodId ? { ...m, ...updated } : m))
      toast.success('QR image uploaded!')
    } catch (err) {
      console.error('QR upload error:', err)
      toast.error('Failed to upload QR image')
    } finally {
      setUploadingQr(null)
    }
  }

  const updateForm = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }))

  const renderMethodDetails = (method) => {
    const details = []

    if (method.type === 'bank') {
      if (method.bankName) details.push({ label: 'Bank Name', value: method.bankName })
      if (method.accountNumber) details.push({ label: 'Account', value: method.accountNumber })
      if (method.accountHolder) details.push({ label: 'Holder', value: method.accountHolder })
      if (method.ifsc || method.ifscCode) details.push({ label: 'IFSC', value: method.ifsc || method.ifscCode })
    } else if (method.type === 'usdt') {
      if (method.network) details.push({ label: 'Network', value: method.network })
      if (method.walletAddress) details.push({ label: 'Wallet', value: method.walletAddress })
    } else if (method.type === 'upi') {
      if (method.upiId) details.push({ label: 'UPI ID', value: method.upiId })
    } else if (method.type === 'angadiya') {
      if (method.contactNumber) details.push({ label: 'Contact', value: method.contactNumber })
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {details.map((d, i) => (
          <div key={i}>
            <p className="text-xs text-dark-500 dark:text-dark-400">{d.label}</p>
            <p className="text-sm font-medium text-dark-900 dark:text-dark-50 truncate">{d.value}</p>
          </div>
        ))}
        <div>
          <p className="text-xs text-dark-500 dark:text-dark-400">Min</p>
          <p className="text-sm font-medium text-dark-900 dark:text-dark-50">{formatCurrency(method.minAmount || 0, 'USD')}</p>
        </div>
        <div>
          <p className="text-xs text-dark-500 dark:text-dark-400">Max</p>
          <p className="text-sm font-medium text-dark-900 dark:text-dark-50">{formatCurrency(method.maxAmount || 0, 'USD')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-96"><Loader /></div>
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Payment Methods</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Configure payment gateways, QR codes, and channels</p>
        </div>
        <div className="flex gap-2">
          <Button icon={RefreshCw} variant="secondary" onClick={fetchMethods}>Refresh</Button>
          <Button icon={Plus} onClick={handleOpenAdd}>Add Method</Button>
        </div>
      </div>

      {methods.length === 0 ? (
        <Card>
          <p className="text-dark-500 dark:text-dark-400 text-center py-8">No payment methods configured yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {methods.map((method) => {
            const qrUrl = getUploadUrl(method.qrImageUrl)

            return (
              <Card key={method.id}>
                <div className="flex items-start gap-4">
                  {/* QR Image or Upload - ONLY FOR UPI AND USDT */}
                  {(method.type === 'upi' || method.type === 'usdt') && (
                    <div className="flex-shrink-0">
                      {qrUrl ? (
                        <div className="relative group">
                          <img
                            src={qrUrl}
                            alt="QR Code"
                            className="w-24 h-24 rounded-lg border border-dark-200 dark:border-dark-700 object-contain bg-white"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                          <button
                            onClick={() => {
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = 'image/*'
                              input.onchange = (e) => handleQrUpload(method.id, e.target.files[0])
                              input.click()
                            }}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                          >
                            <Upload className="w-5 h-5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = 'image/*'
                            input.onchange = (e) => handleQrUpload(method.id, e.target.files[0])
                            input.click()
                          }}
                          disabled={uploadingQr === method.id}
                          className="w-24 h-24 rounded-lg border-2 border-dashed border-dark-300 dark:border-dark-600 flex flex-col items-center justify-center gap-1 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer"
                        >
                          {uploadingQr === method.id ? (
                            <Loader />
                          ) : (
                            <>
                              <QrCode className="w-6 h-6 text-dark-400" />
                              <span className="text-[10px] text-dark-400 font-medium">Upload QR</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Method Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{typeIcons[method.type] || '💳'}</span>
                      <h3 className="text-lg font-bold text-dark-900 dark:text-dark-50">{method.name}</h3>
                      <StatusBadge status={method.isActive ? 'active' : 'inactive'}>
                        {method.isActive ? 'ENABLED' : 'DISABLED'}
                      </StatusBadge>
                      <span className="text-xs bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300 px-2 py-0.5 rounded uppercase font-medium">
                        {method.type}
                      </span>
                    </div>

                    {renderMethodDetails(method)}

                    {method.instructions && (
                      <p className="text-xs text-dark-500 dark:text-dark-400 mt-2 italic">
                        {method.instructions}
                      </p>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="secondary" icon={Edit2} onClick={() => handleOpenEdit(method)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={method.isActive ? 'warning' : 'success'}
                        icon={method.isActive ? ToggleLeft : ToggleRight}
                        onClick={() => handleToggle(method)}
                      >
                        {method.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteModal({ isOpen: true, id: method.id })}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Payment Method' : 'Add Payment Method'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Display Name"
              value={formData.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="e.g. ICICI Bank Transfer"
              fullWidth
            />
            <Select
              label="Payment Type"
              options={[
                { label: 'Bank Transfer', value: 'bank' },
                { label: 'USDT / Crypto', value: 'usdt' },
                { label: 'UPI', value: 'upi' },
                { label: 'Angadiya', value: 'angadiya' },
              ]}
              value={formData.type}
              onChange={(e) => updateForm('type', e.target.value)}
              fullWidth
            />
          </div>

          {formData.type === 'bank' && (
            <div className="p-4 bg-dark-50 dark:bg-dark-800/50 rounded-lg space-y-3 border border-dark-200 dark:border-dark-700">
              <p className="text-sm font-semibold text-dark-700 dark:text-dark-300">🏦 Bank Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Bank Name" value={formData.bankName} onChange={(e) => updateForm('bankName', e.target.value)} fullWidth />
                <Input label="Account Number" value={formData.accountNumber} onChange={(e) => updateForm('accountNumber', e.target.value)} fullWidth />
                <Input label="Account Holder" value={formData.accountHolder} onChange={(e) => updateForm('accountHolder', e.target.value)} fullWidth />
                <Input label="IFSC Code" value={formData.ifsc} onChange={(e) => updateForm('ifsc', e.target.value)} fullWidth />
              </div>
            </div>
          )}

          {formData.type === 'usdt' && (
            <div className="p-4 bg-dark-50 dark:bg-dark-800/50 rounded-lg space-y-3 border border-dark-200 dark:border-dark-700">
              <p className="text-sm font-semibold text-dark-700 dark:text-dark-300">₮ USDT / Crypto Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Network"
                  options={[
                    { label: 'TRC20', value: 'TRC20' },
                    { label: 'ERC20', value: 'ERC20' },
                    { label: 'BEP20', value: 'BEP20' },
                  ]}
                  value={formData.network}
                  onChange={(e) => updateForm('network', e.target.value)}
                  fullWidth
                />
                <Input label="Wallet Address" value={formData.walletAddress} onChange={(e) => updateForm('walletAddress', e.target.value)} fullWidth />
              </div>
            </div>
          )}

          {formData.type === 'upi' && (
            <div className="p-4 bg-dark-50 dark:bg-dark-800/50 rounded-lg space-y-3 border border-dark-200 dark:border-dark-700">
              <p className="text-sm font-semibold text-dark-700 dark:text-dark-300">📱 UPI Details</p>
              <Input label="UPI ID" value={formData.upiId} onChange={(e) => updateForm('upiId', e.target.value)} placeholder="yourname@upi" fullWidth />
            </div>
          )}

          {formData.type === 'angadiya' && (
            <div className="p-4 bg-dark-50 dark:bg-dark-800/50 rounded-lg space-y-3 border border-dark-200 dark:border-dark-700">
              <p className="text-sm font-semibold text-dark-700 dark:text-dark-300">🤝 Angadiya Details</p>
              <Input label="Contact Number" value={formData.contactNumber} onChange={(e) => updateForm('contactNumber', e.target.value)} fullWidth />
            </div>
          )}

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Instructions for Client</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => updateForm('instructions', e.target.value)}
              placeholder="Any special instructions shown to clients..."
              className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600 text-sm"
              rows="2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Amount (USD)" type="number" value={formData.minAmount} onChange={(e) => updateForm('minAmount', parseFloat(e.target.value) || 0)} />
            <Input label="Max Amount (USD)" type="number" value={formData.maxAmount} onChange={(e) => updateForm('maxAmount', parseFloat(e.target.value) || 0)} />
          </div>

          <p className="text-xs text-dark-400">
            Tip: After saving, you can upload a QR code image from the method card.
          </p>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
              {editingId ? 'Save Changes' : 'Add Method'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Payment Method"
        message="This will permanently delete this payment method. Clients won't be able to use it anymore."
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  )
}
