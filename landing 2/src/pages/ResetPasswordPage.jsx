import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GradientText from '../components/ui/GradientText';
import { useCompanyStore, getUploadUrl } from '../store/companyStore';
import { API_URL } from '../utils/domainConfig';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'form' : 'invalid'); // form | success | error | invalid
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { companyName, logoUrl } = useCompanyStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const onSubmit = async (data) => {
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus('success');
      } else {
        setErrorMsg(json.message || 'Invalid or expired reset token');
        setStatus('error');
      }
    } catch (err) {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-dark-950 dark:bg-dark-950 flex items-center justify-center pt-20 pb-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            {logoUrl ? (
              <img src={getUploadUrl(logoUrl)} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">{companyName.substring(0, 2).toUpperCase()}</span>
              </div>
            )}
            <span className="text-lg font-bold text-gradient">{companyName}</span>
          </Link>

          <h1 className="text-3xl font-bold text-white mb-2">
            {status === 'success' ? 'Password Reset!' : status === 'error' || status === 'invalid' ? 'Reset Failed' : 'Set New Password'}
          </h1>
          <p className="text-gray-400">
            {status === 'success'
              ? 'Your password has been updated successfully'
              : status === 'invalid'
              ? 'This reset link is invalid or missing'
              : status === 'error'
              ? errorMsg
              : 'Enter your new password below'}
          </p>
        </motion.div>

        {/* Form */}
        {status === 'form' && (
          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 mb-6"
            variants={itemVariants}
          >
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                icon={Lock}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' },
                })}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm new password"
                icon={Lock}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (val) => val === watch('password') || 'Passwords do not match',
                })}
                error={errors.confirmPassword?.message}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-300"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Reset Password
            </Button>
          </motion.form>
        )}

        {/* Success */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-success/10 border border-success/20 rounded-lg p-6 mb-6"
          >
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-4"
              >
                <CheckCircle className="w-12 h-12 text-success" />
              </motion.div>
              <h2 className="text-lg font-bold text-white mb-2">All Set!</h2>
              <p className="text-sm text-gray-300 mb-6">
                Your password has been reset. You can now log in with your new password.
              </p>
              <Link to="/login" className="w-full">
                <Button variant="gradient" size="lg" className="w-full">
                  Go to Login
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Error / Invalid */}
        {(status === 'error' || status === 'invalid') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-danger/10 border border-danger/20 rounded-lg p-6 mb-6"
          >
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="w-12 h-12 text-danger mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">
                {status === 'invalid' ? 'Invalid Link' : 'Reset Failed'}
              </h2>
              <p className="text-sm text-gray-300 mb-6">
                {status === 'invalid'
                  ? 'This password reset link is invalid or has expired. Please request a new one.'
                  : errorMsg}
              </p>
              <div className="flex gap-3 w-full">
                <Link to="/forgot-password" className="flex-1">
                  <Button variant="gradient" size="lg" className="w-full">
                    Request New Link
                  </Button>
                </Link>
                <Link to="/login" className="flex-1">
                  <Button variant="secondary" size="lg" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Back link for form state */}
        {status === 'form' && (
          <motion.div variants={itemVariants} className="text-center">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-primary-400 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
