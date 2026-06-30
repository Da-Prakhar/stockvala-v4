import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  User as UserIcon,
  Eye,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Loader } from '../components/ui/Loader'
import { formatDate } from '../utils/formatters'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { API_URL } from '../utils/domainConfig'

const apiBase = API_URL.replace(/\/api\/?$/, '')

function getDocUrl(v) {
  if (!v) return null
  if (v.startsWith('http')) return v
  const uploadsIdx = v.indexOf('uploads/')
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : `uploads/${v.replace(/^\//, '')}`
  return `${apiBase}/${relativePath}`
}

export default function KYCApproverPage() {
  const [kycList, setKycList] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [docModal, setDocModal] = useState({ isOpen: false, url: null, title: '' })
  const [detailModal, setDetailModal] = useState({ isOpen: false, kyc: null })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, kycId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setPageLoading(true)
      const [kycRes, statsRes] = await Promise.all([
        api.get('/admin/kyc?limit=200'),
        api.get('/admin/kyc/stats').catch(() => ({ data: { data: null } }))
      ])
      setKycList(kycRes.data.data || [])
      if (statsRes.data?.data) setStats(statsRes.data.data)
    } catch (err) {
      console.error('Error fetching KYC:', err)
      toast.error('Failed to load KYC documents')
    } finally {
      setPageLoading(false)
      setRefreshing(false)
    }
  }

  // Filter by tab
  const pending = useMemo(() => kycList.filter(k => k.status === 'pending'), [kycList])
  const approved = useMemo(() => kycList.filter(k => k.status === 'approved'), [kycList])
  const rejected = useMemo(() => kycList.filter(k => k.status === 'rejected'), [kycList])

  const handleApprove = async (kycId) => {
    setLoading(true)
    try {
      await api.put(`/admin/kyc/${kycId}/approve`)
      setKycList(prev => prev.map(k => k.id === kycId ? { ...k, status: 'approved' } : k))
      setStats(s => ({ ...s, pending: s.pending - 1, approved: s.approved + 1 }))
      toast.success('KYC approved!')
      setDetailModal({ isOpen: false, kyc: null })
    } catch (err) {
      console.error('Error approving KYC:', err)
      toast.error(err.response?.data?.message || 'Failed to approve KYC')
    } finally {
      setConfirmModal({ isOpen: false, action: null, kycId: null })
      setLoading(false)
    }
  }

  const handleReject = async (kycId) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setLoading(true)
    try {
      await api.put(`/admin/kyc/${kycId}/reject`, { reason: rejectReason })
      setKycList(prev => prev.map(k => k.id === kycId ? { ...k, status: 'rejected', rejectionReason: rejectReason } : k))
      setStats(s => ({ ...s, pending: s.pending - 1, rejected: s.rejected + 1 }))
      toast.success('KYC rejected.')
      setDetailModal({ isOpen: false, kyc: null })
    } catch (err) {
      console.error('Error rejecting KYC:', err)
      toast.error(err.response?.data?.message || 'Failed to reject KYC')
    } finally {
      setConfirmModal({ isOpen: false, action: null, kycId: null })
      setRejectReason('')
      setLoading(false)
    }
  }

  // Document labels
  const docFields = [
    { key: 'frontImage', label: 'ID Proof (Front)' },
    { key: 'backImage', label: 'ID Proof (Back)' },
    { key: 'selfieImage', label: 'Selfie with ID' },
    { key: 'addressProof', label: 'Address Proof' },
    { key: 'bankStatement', label: 'Bank Statement' },
  ]

  const docTypeName = (t) => {
    const map = { passport: 'Passport', national_id: 'National ID', driving_license: 'Driving License', drivers_license: 'Driving License', voter_id: 'Voter ID', residence_permit: 'Residence Permit' }
    return map[t] || t || '—'
  }

  // ── KYC Card ────────────────────────────────────────────────────
  const KycCard = ({ kyc }) => {
    const user = kyc.User || kyc.user || {}
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—'
    const uploadedDocs = docFields.filter(d => kyc[d.key])

    return (
      <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-700 transition-colors bg-white dark:bg-dark-800">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-semibold text-dark-900 dark:text-dark-50 text-sm">{name}</p>
              <p className="text-xs text-dark-400">{user.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={kyc.status}>{(kyc.status || '').toUpperCase()}</StatusBadge>
            <span className="font-mono text-xs text-dark-400">#{kyc.id}</span>
          </div>
        </div>

        {/* Doc type & number */}
        <div className="flex items-center gap-4 mb-3 text-xs text-dark-500 dark:text-dark-400">
          <span><strong>Type:</strong> {docTypeName(kyc.documentType)}</span>
          {kyc.documentNumber && <span><strong>Number:</strong> {kyc.documentNumber}</span>}
          {kyc.submittedAt && <span><strong>Submitted:</strong> {formatDate(kyc.submittedAt)}</span>}
        </div>

        {/* Document thumbnails */}
        <div className="flex gap-2 flex-wrap mb-3">
          {docFields.map(({ key, label }) => {
            const val = kyc[key]
            if (!val) return null
            const url = getDocUrl(val)
            return (
              <button
                key={key}
                onClick={() => setDocModal({ isOpen: true, url, title: `${name} — ${label}` })}
                className="group relative flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-100 dark:bg-dark-700 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-xs font-medium text-dark-700 dark:text-dark-300"
              >
                <ImageIcon className="w-3.5 h-3.5 text-primary-500" />
                {label}
                <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-500" />
              </button>
            )
          })}
          {uploadedDocs.length === 0 && (
            <span className="text-xs text-dark-400 italic">No documents uploaded</span>
          )}
        </div>

        {/* Rejection reason */}
        {kyc.status === 'rejected' && kyc.rejectionReason && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-700 dark:text-red-300"><strong>Rejection:</strong> {kyc.rejectionReason}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-dark-100 dark:border-dark-700">
          <Button
            size="sm"
            variant="outline"
            icon={Eye}
            onClick={() => setDetailModal({ isOpen: true, kyc })}
          >
            Review
          </Button>
          {kyc.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="success"
                icon={Check}
                onClick={() => setConfirmModal({ isOpen: true, action: 'approve', kycId: kyc.id })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={X}
                onClick={() => setConfirmModal({ isOpen: true, action: 'reject', kycId: kyc.id })}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Stat cards ──────────────────────────────────────────────────
  const statCards = [
    { label: 'Total KYC', value: stats.total, icon: Shield, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-900/30' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  ]

  const tabs = [
    { key: 'pending', label: `Pending (${pending.length})` },
    { key: 'approved', label: `Approved (${approved.length})` },
    { key: 'rejected', label: `Rejected (${rejected.length})` },
    { key: 'all', label: `All (${kycList.length})` },
  ]

  const [activeTab, setActiveTab] = useState('pending')

  const filteredList = activeTab === 'all' ? kycList
    : activeTab === 'pending' ? pending
    : activeTab === 'approved' ? approved
    : rejected

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">KYC Verification</h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">Review and approve client KYC documents</p>
        </div>
        <Button
          variant="outline"
          icon={RefreshCw}
          onClick={() => fetchAll(true)}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <div className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-dark-500 dark:text-dark-400">{label}</p>
                <p className="text-xl font-bold text-dark-900 dark:text-dark-50">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* KYC Cards */}
      <div className="space-y-4">
        {filteredList.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <Shield className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-dark-600 dark:text-dark-400">No KYC documents in this category</p>
            </div>
          </Card>
        ) : (
          filteredList.map(kyc => <KycCard key={kyc.id} kyc={kyc} />)
        )}
      </div>

      {/* ── Document Preview Modal ─────────────────────────────── */}
      <Modal
        isOpen={docModal.isOpen}
        onClose={() => setDocModal({ isOpen: false, url: null, title: '' })}
        title={docModal.title}
        size="lg"
      >
        <div className="flex items-center justify-center min-h-[400px] bg-dark-100 dark:bg-dark-700 rounded-lg overflow-hidden">
          {docModal.url ? (
            docModal.url.match(/\.pdf$/i) ? (
              <iframe src={docModal.url} className="w-full h-[500px]" title="Document" />
            ) : (
              <img
                src={docModal.url}
                alt="KYC Document"
                className="max-h-[500px] max-w-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div class="text-center p-8"><p class="text-dark-400">Unable to load image</p></div>' }}
              />
            )
          ) : (
            <div className="text-center p-8">
              <FileText className="w-16 h-16 text-dark-400 mx-auto mb-2" />
              <p className="text-dark-400">No document available</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Detail Review Modal ────────────────────────────────── */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, kyc: null })}
        title="KYC Review"
        size="xl"
      >
        {detailModal.kyc && (() => {
          const kyc = detailModal.kyc
          const user = kyc.User || kyc.user || {}
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—'

          return (
            <div className="space-y-5">
              {/* User info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-dark-400 mb-1">Client Name</p>
                  <p className="font-semibold text-dark-900 dark:text-dark-50">{name}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Email</p>
                  <p className="text-dark-700 dark:text-dark-300">{user.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Document Type</p>
                  <p className="text-dark-700 dark:text-dark-300">{docTypeName(kyc.documentType)}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Document Number</p>
                  <p className="font-mono text-dark-700 dark:text-dark-300">{kyc.documentNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Status</p>
                  <StatusBadge status={kyc.status}>{(kyc.status || '').toUpperCase()}</StatusBadge>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Submitted</p>
                  <p className="text-dark-700 dark:text-dark-300">{kyc.submittedAt ? formatDate(kyc.submittedAt) : '—'}</p>
                </div>
              </div>

              {/* Uploaded documents grid */}
              <div>
                <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50 mb-3">Uploaded Documents</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {docFields.map(({ key, label }) => {
                    const val = kyc[key]
                    const url = getDocUrl(val)
                    return (
                      <div key={key} className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                        <div className="p-2 bg-dark-50 dark:bg-dark-700 border-b border-dark-200 dark:border-dark-600">
                          <p className="text-xs font-medium text-dark-600 dark:text-dark-300">{label}</p>
                        </div>
                        {val && url ? (
                          <button
                            onClick={() => setDocModal({ isOpen: true, url, title: `${name} — ${label}` })}
                            className="w-full h-32 flex items-center justify-center bg-dark-100 dark:bg-dark-800 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors cursor-pointer"
                          >
                            {url.match(/\.pdf$/i) ? (
                              <FileText className="w-10 h-10 text-red-400" />
                            ) : (
                              <img src={url} alt={label} className="max-h-28 max-w-full object-contain p-1" />
                            )}
                          </button>
                        ) : (
                          <div className="h-32 flex items-center justify-center bg-dark-50 dark:bg-dark-800">
                            <p className="text-xs text-dark-400 italic">Not uploaded</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Rejection reason if rejected */}
              {kyc.status === 'rejected' && kyc.rejectionReason && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300"><strong>Rejection Reason:</strong> {kyc.rejectionReason}</p>
                </div>
              )}

              {/* Actions */}
              {kyc.status === 'pending' && (
                <div className="flex gap-3 pt-3 border-t border-dark-200 dark:border-dark-700">
                  <Button
                    variant="success"
                    icon={Check}
                    onClick={() => setConfirmModal({ isOpen: true, action: 'approve', kycId: kyc.id })}
                  >
                    Approve KYC
                  </Button>
                  <Button
                    variant="danger"
                    icon={X}
                    onClick={() => setConfirmModal({ isOpen: true, action: 'reject', kycId: kyc.id })}
                  >
                    Reject KYC
                  </Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => { setConfirmModal({ isOpen: false, action: null, kycId: null }); setRejectReason(''); }}
        title={confirmModal.action === 'approve' ? 'Approve KYC' : 'Reject KYC'}
        message={
          confirmModal.action === 'approve'
            ? 'This will approve the KYC documents and mark the user as verified. Continue?'
            : (
              <div className="space-y-3">
                <p>This will reject the KYC documents. The user will be notified and can resubmit.</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason (required)..."
                  className="w-full px-3 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 focus:outline-none focus:border-primary-600"
                  rows="3"
                />
              </div>
            )
        }
        confirmText={confirmModal.action === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmModal.action === 'approve' ? 'success' : 'danger'}
        loading={loading}
        onConfirm={() =>
          confirmModal.action === 'reject'
            ? handleReject(confirmModal.kycId)
            : handleApprove(confirmModal.kycId)
        }
      />
    </motion.div>
  )
}
