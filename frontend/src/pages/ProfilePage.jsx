import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card, { CardBody } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import { pageTransitionVariants } from '../utils/animations'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'

const ProfilePage = () => {
  const { user } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      country: user?.country || '',
      city: user?.city || '',
      bankName: user?.bankName || '',
      accountNumber: user?.accountNumber || '',
      ifscCode: user?.ifscCode || '',
      accountHolderName: user?.accountHolderName || '',
    },
  })
  const { register: registerPwd, handleSubmit: handleSubmitPwd, formState: { errors: pwdErrors }, reset: resetPwd } = useForm()

  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.twoFactorEnabled || false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPwd, setIsChangingPwd] = useState(false)

  const onSubmit = async (data) => {
    setIsSaving(true)
    try {
      const res = await api.put('/users/profile', {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        country: data.country,
        city: data.city,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        accountHolderName: data.accountHolderName,
      })
      // Update authStore user so the UI reflects changes immediately
      const updatedUser = res.data?.data || res.data
      if (updatedUser) {
        useAuthStore.setState((state) => ({
          user: { ...state.user, ...updatedUser },
        }))
      }
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const onChangePassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setIsChangingPwd(true)
    try {
      await api.put('/users/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Password changed successfully!')
      resetPwd()
      setShowPasswordChange(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setIsChangingPwd(false)
    }
  }

  const tabs = [
    {
      label: 'Personal Information',
      content: (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              {...register('firstName', { required: 'First name is required' })}
              error={errors.firstName?.message}
            />
            <Input
              label="Last Name"
              {...register('lastName', { required: 'Last name is required' })}
              error={errors.lastName?.message}
            />
          </div>

          <Input
            label="Email"
            type="email"
            {...register('email', { required: 'Email is required' })}
            error={errors.email?.message}
            disabled
          />

          <Input
            label="Phone Number"
            {...register('phone')}
          />

          <Input
            label="Country"
            {...register('country')}
          />

          <Input
            label="City"
            {...register('city')}
          />

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Bank Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Bank Name"
                {...register('bankName')}
              />
              <Input
                label="Account Holder Name"
                {...register('accountHolderName')}
              />
              <Input
                label="Account Number"
                {...register('accountNumber')}
              />
              <Input
                label="IFSC Code"
                {...register('ifscCode')}
              />
            </div>
          </div>

          <Button type="submit" variant="primary" loading={isSaving}>
            Save Changes
          </Button>
        </form>
      ),
    },
    {
      label: 'Security',
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Two-Factor Authentication
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Add an extra layer of security to your account
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const newVal = !is2FAEnabled
                  await api.put('/users/profile', { twoFactorEnabled: newVal })
                  setIs2FAEnabled(newVal)
                  useAuthStore.setState((s) => ({ user: { ...s.user, twoFactorEnabled: newVal } }))
                  toast.success(newVal ? '2FA enabled' : '2FA disabled')
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Failed to update 2FA')
                }
              }}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                is2FAEnabled ? 'bg-green-600' : 'bg-slate-400'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  is2FAEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {showPasswordChange && (
            <form onSubmit={handleSubmitPwd(onChangePassword)} className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Input label="Current Password" type="password" {...registerPwd('currentPassword', { required: true })} />
              <Input label="New Password" type="password" {...registerPwd('newPassword', { required: true, minLength: 8 })} />
              <Input label="Confirm Password" type="password" {...registerPwd('confirmPassword', { required: true })} />
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setShowPasswordChange(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isChangingPwd}>
                  Change Password
                </Button>
              </div>
            </form>
          )}

          {!showPasswordChange && (
            <Button
              variant="secondary"
              onClick={() => setShowPasswordChange(true)}
              className="w-full"
            >
              Change Password
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Profile Header */}
      <Card variant="elevated">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
              {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {user?.email}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Settings */}
      <Card variant="elevated">
        <CardBody>
          <Tabs tabs={tabs} />
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default ProfilePage
