import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GradientText from '../components/ui/GradientText';
import { useAuthStore } from '../store/authStore';
import { useCompanyStore, getUploadUrl } from '../store/companyStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, redirectToDashboard } = useAuthStore();
  const { companyName, logoUrl } = useCompanyStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password);
      toast.success('Login successful! Redirecting to dashboard...');
      setTimeout(() => redirectToDashboard(), 1000);
    } catch (error) {
      toast.error(error.message || 'Login failed. Please try again.');
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

          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your trading account</p>
        </motion.div>

        {/* Form */}
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

          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={Lock}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                error={errors.password?.message}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('remember')}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Remember me
              </span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </motion.form>

        {/* Divider */}
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex-1 h-px bg-gray-700 dark:bg-dark-700" />
          <span className="text-sm text-gray-500">OR</span>
          <div className="flex-1 h-px bg-gray-700 dark:bg-dark-700" />
        </motion.div>

        {/* Social Login */}
        <motion.div variants={itemVariants} className="space-y-3 mb-6">
          <button className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-700 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="font-medium">Continue with Google</span>
          </button>

          <button className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-700 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 13.5c-.91 0-1.82-.33-2.56-1.02l-3.23 5.6c-.13.23-.38.36-.64.36-.26 0-.51-.13-.64-.36l-3.23-5.6c-.74.69-1.65 1.02-2.56 1.02-2.21 0-4-1.79-4-4s1.79-4 4-4c.91 0 1.82.33 2.56 1.02l3.23-5.6c.13-.23.38-.36.64-.36s.51.13.64.36l3.23 5.6c.74-.69 1.65-1.02 2.56-1.02 2.21 0 4 1.79 4 4s-1.79 4-4 4z"/>
            </svg>
            <span className="font-medium">Continue with Apple</span>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center text-gray-400"
        >
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Sign up here
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
