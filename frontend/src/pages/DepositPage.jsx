import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, QrCode, ArrowLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Card, { CardBody } from '../components/ui/Card'
import FileUpload from '../components/ui/FileUpload'
import { pageTransitionVariants } from '../utils/animations'
import { useAccountStore } from '../store/accountStore'
import { useCompanyStore } from '../store/companyStore'
import api from '../utils/api'
import { API_URL } from '../utils/domainConfig'

const apiBase = API_URL.replace(/\/api\/?$/, '')

function getUploadUrl(v) {
  if (!v) return null
  if (v.startsWith('http')) return v
  const uploadsIdx = v.indexOf('uploads/')
  const relativePath = uploadsIdx >= 0 ? v.substring(uploadsIdx) : v.replace(/^\//, '')
  return `${apiBase}/${relativePath}`
}

// Generate QR code URL using QR Server API (no npm dependency needed)
function getQrImageUrl(text, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

const DepositPage = () => {
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm({
    defaultValues: { account: '', method: '', amount: '', reference: '' }
  })
  const { accounts, fetchAccounts } = useAccountStore()
  const { companyName } = useCompanyStore()
  const [files, setFiles] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [copiedField, setCopiedField] = useState(null)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.get('/funds/payment-methods')
      const methods = res.data?.data || res.data || []
      setPaymentMethods(methods)
      if (methods.length > 0) {
        setValue('method', methods[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch payment methods', err)
      setPaymentMethods([{ id: 1, name: 'Bank Transfer', type: 'bank' }])
      setValue('method', 1)
    }
  }

  const [walletBalance, setWalletBalance] = useState(null)

  useEffect(() => {
    api.get('/wallet/balance').then(r => {
      const b = r.data?.data?.balance ?? r.data?.balance ?? 0
      setWalletBalance(parseFloat(b))
    }).catch(() => {})
  }, [])

  const selectedMethodId = watch('method')
  const watchAmount = watch('amount')

  const selectedMethod = useMemo(
    () => paymentMethods.find(m => parseInt(m.id) === parseInt(selectedMethodId)),
    [paymentMethods, selectedMethodId]
  )

  const methodDetails = useMemo(() => {
    if (!selectedMethod) return {}
    const d = typeof selectedMethod.details === 'string'
      ? JSON.parse(selectedMethod.details)
      : (selectedMethod.details || {})
    return d
  }, [selectedMethod])

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const onSubmit = async (data) => {
    const accountId = data.account ? Number(data.account) : null

    if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) < 1) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)

    // Wallet deposit: instant wallet → MT5 transfer
    if (data.method === 'wallet') {
      try {
        await api.post('/wallet/fund-account', { mt5AccountId: accountId, amount: Number(data.amount) })
        toast.success('Funds transferred from wallet to MT5!')
        setTimeout(() => navigate('/fund'), 2000)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Wallet transfer failed')
      } finally { setIsSubmitting(false) }
      return
    }

    const methodId = data.method ? Number(data.method) : null
    if (!methodId || isNaN(methodId)) {
      setIsSubmitting(false)
      toast.error('Please select a payment method')
      return
    }

    try {
      const depositRes = await api.post('/funds/deposits', {
        amount: Number(data.amount),
        paymentMethodId: methodId,
        mt5AccountId: accountId,
        transactionRef: data.reference || null,
      })

      const depositId = depositRes.data?.data?.id || depositRes.data?.id

      if (depositId && files.length > 0) {
        const formData = new FormData()
        formData.append('file', files[0])
        await api.post(`/funds/deposits/${depositId}/proof?type=proofs`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }

      toast.success('Deposit request submitted successfully!')
      setTimeout(() => {
        navigate('/fund')
      }, 2000)
    } catch (error) {
      console.error('[Deposit] Error:', error.response?.data)
      const errMsg = error.response?.data?.message || 'Failed to submit deposit'
      const errDetails = error.response?.data?.errors
      if (errDetails && errDetails.length > 0) {
        toast.error(`${errMsg}: ${errDetails.map(e => e.message).join(', ')}`)
      } else {
        toast.error(errMsg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const methodType = selectedMethodId === 'wallet' ? 'wallet' : (selectedMethod?.type || 'bank')
  const icons = { bank: '🏦', usdt: '₮', crypto: '₮', upi: '📱', angadiya: '🤝', wallet: '💰', other: '💳' }

  const upiPaymentLink = useMemo(() => {
    if (methodType !== 'upi' || !methodDetails.upiId) return null
    const amt = parseFloat(watchAmount) || ''
    const safeCompanyName = encodeURIComponent(companyName || 'Payment')
    let link = `upi://pay?pa=${methodDetails.upiId}&pn=${safeCompanyName}&cu=INR`
    if (amt > 0) link += `&am=${amt}`
    return link
  }, [methodType, methodDetails.upiId, watchAmount, companyName])

  // Copyable detail row
  const DetailRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-mono text-slate-900 dark:text-white mt-0.5 break-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => copyToClipboard(value, label)}
        className="ml-2 p-1.5 text-slate-400 hover:text-primary-500 transition-colors flex-shrink-0"
        title={`Copy ${label}`}
      >
        {copiedField === label ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  )

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-5xl mx-auto"
    >
      {/* Back link */}
      <button
        onClick={() => navigate('/fund')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Funds
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card variant="elevated">
            <CardBody>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Deposit Funds
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Account Selection */}
                <Select
                  label="Select Account"
                  options={(accounts || []).map((acc) => ({
                    value: acc.id,
                    label: `${acc.login} - ${(acc.type || 'live').toUpperCase()} ($${parseFloat(acc.balance || 0).toFixed(2)})`,
                  }))}
                  value={watch('account')}
                  onChange={(value) => setValue('account', value, { shouldValidate: true })}
                  error={errors.account?.message}
                  placeholder="Select a trading account"
                />

                {/* Amount */}
                <Input
                  label="Amount (USD)"
                  type="number"
                  placeholder="100.00"
                  step="0.01"
                  min="1"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: { value: 1, message: 'Minimum deposit is $1' },
                  })}
                  error={errors.amount?.message}
                />

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Payment Method
                  </label>
                  {paymentMethods.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-3">Loading payment methods...</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {paymentMethods.map((method) => {
                      const type = method.type || 'bank'
                      const isSelected = parseInt(selectedMethodId) === parseInt(method.id)

                      return (
                        <label
                          key={method.id}
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            value={method.id}
                            {...register('method')}
                            className="hidden"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5">
                              <CheckCircle className="w-4 h-4 text-primary-500" />
                            </div>
                          )}
                          <div className="text-2xl mb-1.5">{icons[type] || '💳'}</div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                            {method.name || type}
                          </p>
                        </label>
                      )
                    })}

                    {/* Hardcoded Wallet tile — always visible */}
                    <label
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                        selectedMethodId === 'wallet'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        value="wallet"
                        {...register('method')}
                        className="hidden"
                      />
                      {selectedMethodId === 'wallet' && (
                        <div className="absolute top-1.5 right-1.5">
                          <CheckCircle className="w-4 h-4 text-indigo-500" />
                        </div>
                      )}
                      <div className="text-2xl mb-1.5">💰</div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">Wallet</p>
                      {walletBalance !== null && (
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">${walletBalance.toFixed(2)}</p>
                      )}
                    </label>
                  </div>
                </div>

                {/* Wallet instant info */}
                {methodType === 'wallet' && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">💰 Instant Wallet Transfer</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">
                      Funds will be transferred instantly from your wallet to your MT5 account. No proof required.
                    </p>
                    {walletBalance !== null && (
                      <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        Available: ${walletBalance.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* Transaction Reference — hidden for wallet */}
                {methodType !== 'wallet' && (
                  <Input
                    label="Transaction Reference / UTR Number"
                    placeholder="Enter transaction ID or UTR number"
                    {...register('reference', {
                      required: methodType !== 'wallet' ? 'Reference is required' : false,
                    })}
                    error={errors.reference?.message}
                  />
                )}

                {/* File Upload — hidden for wallet */}
                {methodType !== 'wallet' && (
                  <FileUpload
                    label="Proof of Payment (Screenshot / Receipt)"
                    onFileSelect={setFiles}
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxSize={5 * 1024 * 1024}
                  />
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  className="w-full"
                >
                  {methodType === 'wallet' ? 'Transfer from Wallet' : 'Submit Deposit Request'}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Payment Details Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card variant="elevated">
            <CardBody>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{icons[methodType] || '💳'}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedMethod?.name || 'Payment Details'}
                </h3>
              </div>

              {/* QR Code */}
              {(() => {
                if (methodType !== 'upi' && methodType !== 'usdt') return null;

                const adminQrUrl = getUploadUrl(methodDetails.qrImageUrl)
                const showUpiAutoQr = methodType === 'upi' && methodDetails.upiId && !adminQrUrl
                const showUsdtAutoQr = methodType === 'usdt' && methodDetails.walletAddress && !adminQrUrl
                const showQr = adminQrUrl || showUpiAutoQr || showUsdtAutoQr

                if (!showQr) return null

                let autoQrText = ''
                if (showUpiAutoQr) {
                  autoQrText = upiPaymentLink || `upi://pay?pa=${methodDetails.upiId}&pn=${encodeURIComponent(companyName || 'Payment')}&cu=INR`
                } else if (showUsdtAutoQr) {
                  autoQrText = methodDetails.walletAddress
                }

                const qrSrc = adminQrUrl || getQrImageUrl(autoQrText, 200)

                return (
                  <div className="mb-4">
                    <div className="bg-white rounded-xl p-4 flex flex-col items-center border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-1.5 mb-2">
                        <QrCode className="w-4 h-4 text-primary-500" />
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Scan to Pay</p>
                      </div>
                      <img
                        src={qrSrc}
                        alt="Payment QR Code"
                        className="w-48 h-48 rounded-lg"
                      />
                      {methodType === 'upi' && !adminQrUrl && (
                        <p className="text-xs text-slate-500 mt-2">
                          {watchAmount && parseFloat(watchAmount) > 0
                            ? `Amount: $${parseFloat(watchAmount).toFixed(2)}`
                            : 'Enter amount for pre-filled QR'
                          }
                        </p>
                      )}
                      {methodType === 'usdt' && (
                        <p className="text-xs text-slate-500 mt-2">
                          Send {methodDetails.network || 'USDT'} to the address below
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Details */}
              <div className="space-y-2">
                {methodType === 'bank' && (
                  <>
                    {methodDetails.bankName && <DetailRow label="Bank Name" value={methodDetails.bankName} />}
                    {methodDetails.accountNumber && <DetailRow label="Account Number" value={methodDetails.accountNumber} />}
                    {methodDetails.accountHolder && <DetailRow label="Account Holder" value={methodDetails.accountHolder} />}
                    {methodDetails.ifscCode && <DetailRow label="IFSC Code" value={methodDetails.ifscCode} />}
                    {methodDetails.routingNumber && <DetailRow label="Routing Number" value={methodDetails.routingNumber} />}
                    {methodDetails.swiftCode && <DetailRow label="Swift Code" value={methodDetails.swiftCode} />}
                  </>
                )}

                {methodType === 'upi' && (
                  <>
                    {methodDetails.upiId && <DetailRow label="UPI ID" value={methodDetails.upiId} />}
                  </>
                )}

                {(methodType === 'usdt' || methodType === 'crypto') && (
                  <>
                    {methodDetails.walletAddress && <DetailRow label="Wallet Address" value={methodDetails.walletAddress} />}
                    {methodDetails.network && <DetailRow label="Network" value={methodDetails.network} />}
                  </>
                )}

                {methodType === 'angadiya' && (
                  <>
                    {methodDetails.contactNumber && <DetailRow label="Contact Number" value={methodDetails.contactNumber} />}
                  </>
                )}

                {methodDetails.instructions && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Instructions</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{methodDetails.instructions}</p>
                  </div>
                )}

                {selectedMethod?.minAmount && (
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                    <span>Min: ${selectedMethod.minAmount}</span>
                    {selectedMethod.maxAmount && <span>Max: ${selectedMethod.maxAmount}</span>}
                  </div>
                )}
              </div>

              {methodType === 'wallet' ? (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">💰 Wallet Balance</p>
                  <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                    {walletBalance !== null ? `$${walletBalance.toFixed(2)}` : '—'}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                    Funds will be transferred instantly from your wallet to the selected MT5 account.
                  </p>
                </div>
              ) : (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> After completing the payment, upload the proof
                  and enter the transaction reference. We'll process your deposit within 24 hours.
                </p>
              </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

export default DepositPage
