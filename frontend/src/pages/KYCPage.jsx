import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, AlertCircle, Upload, Shield, ArrowLeft } from 'lucide-react'
import Card, { CardBody } from '../components/ui/Card'
import FileUpload from '../components/ui/FileUpload'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import { pageTransitionVariants, containerVariants, itemVariants } from '../utils/animations'
import api from '../utils/api'
import toast from 'react-hot-toast'

const KYCPage = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [kycData, setKycData] = useState(null) // raw API response
  const [files, setFiles] = useState({
    idProofFront: null,
    idProofBack: null,
    addressProof: null,
    selfie: null,
    bankStatement: null,
  })
  const [documentType, setDocumentType] = useState('passport')
  const [documentNumber, setDocumentNumber] = useState('')

  useEffect(() => {
    fetchKycStatus()
  }, [])

  const fetchKycStatus = async () => {
    try {
      setIsLoading(true)
      const res = await api.get('/kyc/status')
      const data = res.data?.data || res.data || {}
      setKycData(data)
      if (data.documentType) setDocumentType(data.documentType)
      if (data.documentNumber) setDocumentNumber(data.documentNumber)
    } catch (err) {
      console.error('Failed to fetch KYC status:', err)
      toast.error('Failed to fetch KYC status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (key, fileList) => {
    setFiles(prev => ({ ...prev, [key]: fileList?.[0] || null }))
  }

  const handleSubmit = async () => {
    const formData = new FormData()
    let hasFiles = false

    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        formData.append(key, file)
        hasFiles = true
      }
    })

    if (!hasFiles) {
      toast.error('Please select at least one document to upload')
      return
    }

    if (!files.idProofFront) {
      toast.error('ID Proof (Front) is required')
      return
    }
    if (!files.idProofBack) {
      toast.error('ID Proof (Back) is required')
      return
    }

    if (!documentNumber.trim()) {
      toast.error('Please enter your document number')
      return
    }

    formData.append('documentType', documentType)
    formData.append('documentNumber', documentNumber)

    try {
      setIsSubmitting(true)
      await api.post('/kyc/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success('Documents submitted successfully!')
      setFiles({ idProofFront: null, idProofBack: null, addressProof: null, selfie: null, bankStatement: null })
      await fetchKycStatus()
    } catch (err) {
      console.error('Submit KYC error:', err)
      toast.error(err.response?.data?.message || 'Failed to submit documents')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Overall status from API
  const status = kycData?.status || 'not-submitted'
  const isEditable = status === 'not-submitted' || status === 'rejected'

  const documentTypes = [
    { key: 'idProofFront', label: 'ID Proof (Front)', description: 'Front side of Passport, Driving License, National ID, or Voter ID', backendField: 'frontImage', required: true },
    { key: 'idProofBack', label: 'ID Proof (Back)', description: 'Back side of your ID document', backendField: 'backImage', required: true },
    { key: 'addressProof', label: 'Address Proof', description: 'Utility Bill, Bank Statement, or Lease Agreement', backendField: 'addressProof' },
    { key: 'selfie', label: 'Selfie with ID', description: 'Photo of you holding your ID document', backendField: 'selfieImage' },
    { key: 'bankStatement', label: 'Bank Statement', description: 'Latest 3-month bank statement', backendField: 'bankStatement' },
  ]

  const getDocStatus = (backendField) => {
    if (!kycData || status === 'not-submitted') return 'not-submitted'
    if (status === 'approved') return 'approved'
    if (status === 'rejected') return 'rejected'
    const fieldMap = { backImage: 'back_image', frontImage: 'front_image', selfieImage: 'selfie_image', addressProof: 'address_proof', bankStatement: 'bank_statement' }
    const dbKey = fieldMap[backendField] || backendField
    return (kycData[backendField] || kycData[dbKey]) ? 'pending' : 'not-submitted'
  }

  const getStatusIcon = (s) => {
    switch (s) {
      case 'approved': return <Check className="h-5 w-5 text-green-600" />
      case 'pending': return <Clock className="h-5 w-5 text-yellow-600" />
      case 'rejected': return <AlertCircle className="h-5 w-5 text-red-600" />
      default: return <Upload className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusLabel = (s) => {
    const labels = { approved: 'Approved', pending: 'Under Review', rejected: 'Rejected', 'not-submitted': 'Not Submitted' }
    return labels[s] || s
  }

  const statusBannerColor = status === 'approved'
    ? 'from-green-500 to-green-600'
    : status === 'rejected'
    ? 'from-red-500 to-red-600'
    : status === 'pending'
    ? 'from-yellow-500 to-yellow-600'
    : 'from-slate-400 to-slate-500'

  const statusBannerText = status === 'approved' ? 'Verified'
    : status === 'rejected' ? 'Verification Failed — Please Resubmit'
    : status === 'pending' ? 'Under Review'
    : 'Not Submitted'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* KYC Status Banner */}
      <motion.div variants={itemVariants}>
        <Card variant="elevated" className={`bg-gradient-to-r ${statusBannerColor} text-white`}>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">KYC Status</p>
                <h2 className="text-2xl font-bold mt-1">{statusBannerText}</h2>
              </div>
              <Shield className="w-10 h-10 text-white/30" />
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Rejection reason */}
      {status === 'rejected' && kycData?.rejectionReason && (
        <motion.div variants={itemVariants}>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Rejection Reason:</strong> {kycData.rejectionReason}
            </p>
          </div>
        </motion.div>
      )}

      {/* Document Type & Number (only when editable) */}
      {isEditable && (
        <motion.div variants={itemVariants}>
          <Card variant="elevated">
            <CardBody>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Document Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID Card</option>
                    <option value="driving_license">Driving License</option>
                    <option value="voter_id">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Document Number</label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Enter your document number"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Documents */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {documentTypes.map((doc) => {
          const docStatus = getDocStatus(doc.backendField)
          return (
            <motion.div key={doc.key} variants={itemVariants}>
              <Card variant="elevated">
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {doc.label}
                        </h3>
                        {doc.required && (
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Required</span>
                        )}
                        {getStatusIcon(docStatus)}
                        <StatusBadge status={docStatus} label={getStatusLabel(docStatus)} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {doc.description}
                      </p>
                    </div>
                  </div>

                  {isEditable && (
                    <FileUpload
                      label={files[doc.key] ? files[doc.key].name : 'Upload Document'}
                      onFileSelect={(fileList) => handleFileSelect(doc.key, fileList)}
                      accept=".pdf,.jpg,.jpeg,.png"
                      maxSize={10 * 1024 * 1024}
                    />
                  )}

                  {docStatus === 'approved' && (
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Document verified and approved
                      </p>
                    </div>
                  )}

                  {docStatus === 'pending' && (
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 flex items-center gap-2 mt-2">
                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Your document is under review. This may take up to 24 hours.
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Info Box */}
      <motion.div variants={itemVariants}>
        <Card variant="flat">
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <strong>Important:</strong> Complete KYC is required to withdraw funds and use all platform features.
              All documents must be clear, valid, and match your account details.
            </p>
          </CardBody>
        </Card>
      </motion.div>

      {/* Submit Button */}
      {isEditable && (
        <motion.div variants={itemVariants} className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : status === 'rejected' ? 'Resubmit Documents' : 'Submit Documents'}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

export default KYCPage
