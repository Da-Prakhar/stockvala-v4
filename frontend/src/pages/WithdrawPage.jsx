import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Card, { CardBody } from '../components/ui/Card'
import { pageTransitionVariants } from '../utils/animations'
import { useAccountStore } from '../store/accountStore'
import api from '../utils/api'

const WithdrawPage = () => {
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm({
    defaultValues: { account: '', method: '', amount: '' }
  })
  const { accounts, fetchAccounts } = useAccountStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [walletBalance, setWalletBalance] = useState(null)
  const [minWithdrawal, setMinWithdrawal] = useState(1)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchPaymentMethods()
    fetchWalletBalance()
    fetchMinWithdrawal()
  }, [])

  const fetchWalletBalance = async () => {
    try {
      const res = await api.get('/wallet/balance')
      const b = res.data?.data?.balance ?? res.data?.balance ?? 0
      setWalletBalance(parseFloat(b))
    } catch (_) {}
  }

  const fetchMinWithdrawal = async () => {
    try {
      const res = await api.get('/admin/settings/trading')
      const s = res.data?.data?.settings || {}
      const v = parseFloat(s.minWithdrawal || s.min_withdrawal || 1)
      if (v > 0) setMinWithdrawal(v)
    } catch (_) {}
  }

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

  const selectedAccountId = watch('account')
  const paymentMethodId = watch('method')
  const watchAmount = watch('amount')

  const selectedAccount = (accounts || []).find((acc) => String(acc.id) === String(selectedAccountId))

  const selectedMethod = useMemo(
    () => paymentMethods.find(m => String(m.id) === String(paymentMethodId)),
    [paymentMethods, paymentMethodId]
  )

  const methodType = paymentMethodId === 'wallet' ? 'wallet' : (selectedMethod?.type || 'bank')
  const icons = { bank: '🏦', usdt: '₮', crypto: '₮', upi: '📱', angadiya: '🤝', wallet: '💰', other: '💳' }

  const onSubmit = async (data) => {
    const accountId = data.account ? Number(data.account) : null

    if (!accountId || isNaN(accountId)) {
      toast.error('Please select a trading account')
      return
    }
    if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) < minWithdrawal) {
      toast.error(`Minimum withdrawal is $${minWithdrawal}`)
      return
    }

    // Wallet withdrawal: instant MT5 → wallet transfer, no approval needed
    if (data.method === 'wallet') {
      setIsSubmitting(true)
      try {
        await api.post('/wallet/withdraw-mt5', { mt5AccountId: accountId, amount: Number(data.amount) })
        toast.success('Funds transferred to your wallet!')
        setTimeout(() => navigate('/fund'), 2000)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Wallet transfer failed')
      } finally { setIsSubmitting(false) }
      return
    }

    const methodId = data.method ? Number(data.method) : null
    if (!methodId || isNaN(methodId)) {
      toast.error('Please select a withdrawal method')
      return
    }

    // Build withdrawal details based on method type
    const withdrawalDetails = {}

    if (methodType === 'bank') {
      if (!data.bankAccount || !data.bankName || !data.accountHolder) {
        toast.error('Please fill in all bank details')
        return
      }
      withdrawalDetails.bankAccountNumber = data.bankAccount
      withdrawalDetails.bankName = data.bankName
      withdrawalDetails.accountHolderName = data.accountHolder
      if (data.ifscCode) withdrawalDetails.ifscCode = data.ifscCode
      if (data.iban) withdrawalDetails.iban = data.iban
    } else if (methodType === 'usdt' || methodType === 'crypto') {
      if (!data.walletAddress) {
        toast.error('Please enter your wallet address')
        return
      }
      withdrawalDetails.walletAddress = data.walletAddress
      if (data.network) withdrawalDetails.network = data.network
    } else if (methodType === 'upi') {
      if (!data.upiId) {
        toast.error('Please enter your UPI ID')
        return
      }
      withdrawalDetails.upiId = data.upiId
    } else if (methodType === 'angadiya') {
      if (data.contactNumber) withdrawalDetails.contactNumber = data.contactNumber
      if (data.angadiyaNote) withdrawalDetails.note = data.angadiyaNote
    }

    setIsSubmitting(true)

    try {
      await api.post('/funds/withdrawals', {
        amount: Number(data.amount),
        paymentMethodId: methodId,
        mt5AccountId: accountId,
        withdrawalDetails,
      })
      toast.success('Withdrawal request submitted successfully!')
      setTimeout(() => {
        navigate('/fund')
      }, 2000)
    } catch (error) {
      console.error('[Withdraw] Error:', error.response?.data)
      const errMsg = error.response?.data?.message || 'Failed to submit withdrawal'
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

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      {/* Back link */}
      <button
        onClick={() => navigate('/fund')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Funds
      </button>

      <Card variant="elevated">
        <CardBody>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Withdraw Funds
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Selection */}
            <Select
              label="Select Account"
              options={(accounts || []).map((acc) => ({
                value: acc.id,
                label: `${acc.login} - Available: $${parseFloat(acc.balance || 0).toFixed(2)}`,
              }))}
              value={watch('account')}
              onChange={(value) => setValue('account', value, { shouldValidate: true })}
              error={errors.account?.message}
              placeholder="Select a trading account"
            />

            {/* Available Balance */}
            {selectedAccount && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Available Balance:</strong> ${parseFloat(selectedAccount.balance || 0).toFixed(2)}
                </p>
              </div>
            )}

            {/* Amount */}
            <Input
              label={`Withdrawal Amount (USD) — min $${minWithdrawal}`}
              type="number"
              placeholder="Enter amount"
              step="0.01"
              min={minWithdrawal}
              {...register('amount', {
                required: 'Amount is required',
                min: { value: minWithdrawal, message: `Minimum withdrawal is $${minWithdrawal}` },
              })}
              error={errors.amount?.message}
            />

            {/* Payment Method — radio grid like deposit page */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Withdrawal Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentMethods.map((method) => {
                  const type = method.type || 'bank'
                  const isSelected = String(paymentMethodId) === String(method.id)

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
                    paymentMethodId === 'wallet'
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
                  <div className="text-2xl mb-1.5">💰</div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">Wallet</p>
                  {walletBalance !== null && (
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">${walletBalance.toFixed(2)}</p>
                  )}
                </label>
              </div>
            </div>

            {/* Conditional fields based on method type */}
            {methodType === 'bank' && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">🏦 Bank Account Details</p>
                <Input
                  label="Account Holder Name"
                  placeholder="Enter account holder name"
                  {...register('accountHolder', {
                    required: 'Account holder name is required',
                  })}
                  error={errors.accountHolder?.message}
                />
                <Input
                  label="Bank Account Number"
                  placeholder="Enter your bank account number"
                  {...register('bankAccount', {
                    required: 'Bank account is required',
                  })}
                  error={errors.bankAccount?.message}
                />
                <Input
                  label="Bank Name"
                  placeholder="Enter bank name"
                  {...register('bankName', {
                    required: 'Bank name is required',
                  })}
                  error={errors.bankName?.message}
                />
                <Input
                  label="IFSC Code"
                  placeholder="Enter IFSC code (for India)"
                  {...register('ifscCode')}
                />
                <Input
                  label="IBAN (for international transfers)"
                  placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                  {...register('iban')}
                />
              </div>
            )}

            {(methodType === 'usdt' || methodType === 'crypto') && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">₮ Crypto Wallet Details</p>
                <Input
                  label="Wallet Address"
                  placeholder="Enter your cryptocurrency wallet address"
                  {...register('walletAddress', {
                    required: 'Wallet address is required',
                  })}
                  error={errors.walletAddress?.message}
                />
                <Input
                  label="Network (e.g. TRC20, ERC20)"
                  placeholder="TRC20"
                  {...register('network')}
                />
              </div>
            )}

            {methodType === 'upi' && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">📱 UPI Details</p>
                <Input
                  label="Your UPI ID"
                  placeholder="yourname@upi or 9876543210@paytm"
                  {...register('upiId', {
                    required: 'UPI ID is required',
                  })}
                  error={errors.upiId?.message}
                />
              </div>
            )}

            {methodType === 'angadiya' && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">🤝 Angadiya Details</p>
                <Input
                  label="Contact Number"
                  placeholder="Enter your contact number"
                  {...register('contactNumber')}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    placeholder="Any special instructions or preferred pickup details..."
                    {...register('angadiyaNote')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    rows="3"
                  />
                </div>
              </div>
            )}

            {methodType === 'wallet' && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">💰 Withdraw to Wallet</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Funds will be transferred instantly from your MT5 account to your platform wallet.
                </p>
                {walletBalance !== null && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 font-medium">
                    Current wallet balance: ${walletBalance.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Disclaimer — not shown for wallet (instant transfer) */}
            {methodType !== 'wallet' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Processing Time</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Withdrawals are typically processed within 1-3 business days. The amount will be debited from your MT5 account upon approval.
                </p>
              </div>
            </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className="w-full"
            >
              Request Withdrawal
            </Button>
          </form>
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default WithdrawPage
