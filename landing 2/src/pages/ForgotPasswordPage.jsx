import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GradientText from '../components/ui/GradientText';
import { useCompanyStore, getUploadUrl } from '../store/companyStore';
import { API_URL } from '../utils/domainConfig';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const { companyName, logoUrl } = useCompanyStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
    },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const onSubmit = async (data) => {
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      setSubmitted(true);
    } catch (err) {
      // Even on error, show success to prevent email enumeration
      setSubmitted(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
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
            {submitted ? 'Check Your Email' : 'Reset Password'}
          </h1>
          <p className="text-gray-400">
            {submitted
              ? 'We sent you a password reset link'
              : 'Enter your email to receive a password reset link'}
          </p>
        </motion.div>

        {/* Content */}
        {!submitted ? (
          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 mb-6"
            variants={itemVariants}
          >
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              icon={Mail}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email',
                },
              })}
              error={errors.email?.message}
            />

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Send Reset Link
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-primary-400 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </motion.form>
        ) : (
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

              <h2 className="text-lg font-bold text-white mb-2">Email Sent!</h2>
              <p className="text-sm text-gray-300 mb-6">
                Check your inbox for a password reset link. The link will expire in 24 hours.
              </p>

              <div className="w-full p-3 rounded-lg bg-dark-700 mb-6 border border-dark-600">
                <p className="text-xs text-gray-400 break-all">
                  {/* Email would be shown here from form data */}
                  Check spam folder if you don't see the email
                </p>
              </div>

              <Link
                to="/login"
                className="w-full"
              >
                <Button variant="secondary" size="lg" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Help Text */}
        <motion.div
          variants={itemVariants}
          className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/20"
        >
          <p className="text-xs text-gray-400">
            <span className="font-medium text-primary-400">Having trouble?</span>
            {' '}Contact our support team at support@{companyName.toLowerCase().replace(/\s+/g, '')}.com for assistance.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
