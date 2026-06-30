import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  Globe,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GradientText from '../components/ui/GradientText';
import { useAuthStore } from '../store/authStore';
import { useCompanyStore, getUploadUrl } from '../store/companyStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const { companyName, logoUrl } = useCompanyStore();
  const [countries] = useState([
    'Afghanistan', 'Argentina', 'Australia', 'Bangladesh', 'Brazil', 'Canada',
    'China', 'Colombia', 'Egypt', 'France', 'Germany', 'Hong Kong', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan',
    'Kenya', 'Kuwait', 'Malaysia', 'Mexico', 'Netherlands', 'New Zealand',
    'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Philippines', 'Poland',
    'Qatar', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
    'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
    'Thailand', 'Turkey', 'UAE', 'United Kingdom', 'United States',
    'Vietnam',
  ]);

  const { register: registerUser, isLoading, redirectToDashboard } = useAuthStore();
  const refFromUrl = searchParams.get('ref') || '';
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    setValue,
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phone: '',
      country: '',
      referralCode: refFromUrl,
      terms: false,
    },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    // Auto-fill referral code from URL ?ref= param
    if (refFromUrl) setValue('referralCode', refFromUrl);
  }, [refFromUrl, setValue]);

  const password = watch('password');

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
      toast.success('Registration successful! Redirecting to dashboard...');
      setTimeout(() => redirectToDashboard(), 1000);
    } catch (error) {
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const values = getValues(['email', 'password', 'confirmPassword']);
      if (!values[0] || !values[1] || !values[2]) {
        toast.error('Please fill all fields');
        return;
      }
      if (values[1] !== values[2]) {
        toast.error('Passwords do not match');
        return;
      }
    }

    if (step === 2) {
      const values = getValues(['firstName', 'lastName', 'phone', 'country']);
      if (!values[0] || !values[1] || !values[2] || !values[3]) {
        toast.error('Please fill all fields');
        return;
      }
    }

    setStep(step + 1);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
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
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
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

          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400">Join 500K+ traders worldwide</p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex justify-between mb-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full mx-1 transition-colors duration-300 ${
                  i <= step
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500'
                    : 'bg-gray-700 dark:bg-dark-700'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">
            Step {step} of 3
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 mb-6"
          variants={itemVariants}
        >
          {/* Step 1 - Email & Password */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
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

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  icon={Lock}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
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

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter your password"
                icon={Lock}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) =>
                    value === password || 'Passwords do not match',
                })}
                error={errors.confirmPassword?.message}
              />
            </motion.div>
          )}

          {/* Step 2 - Personal Info */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <Input
                label="First Name"
                type="text"
                placeholder="John"
                icon={User}
                {...register('firstName', {
                  required: 'First name is required',
                })}
                error={errors.firstName?.message}
              />

              <Input
                label="Last Name"
                type="text"
                placeholder="Doe"
                icon={User}
                {...register('lastName', {
                  required: 'Last name is required',
                })}
                error={errors.lastName?.message}
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 (555) 000-0000"
                icon={Phone}
                {...register('phone', {
                  required: 'Phone number is required',
                })}
                error={errors.phone?.message}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country <span className="text-danger">*</span>
                </label>
                <select
                  {...register('country', {
                    required: 'Country is required',
                  })}
                  className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select your country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p className="mt-1 text-sm text-danger">
                    {errors.country.message}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3 - Additional Info & Terms */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <Input
                label="Referral Code (Optional)"
                type="text"
                placeholder="Enter referral code if you have one"
                {...register('referralCode')}
              />

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <input
                  type="checkbox"
                  {...register('terms', {
                    required: 'You must accept the terms',
                  })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-500 cursor-pointer mt-1 flex-shrink-0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  I agree to the{' '}
                  <a
                    href="#"
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a
                    href="#"
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Privacy Policy
                  </a>
                </span>
              </label>
              {errors.terms && (
                <p className="text-sm text-danger">{errors.terms.message}</p>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('marketingOptIn')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-500 cursor-pointer mt-1 flex-shrink-0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  I want to receive updates and promotions
                </span>
              </label>

              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  <p className="text-sm text-gray-300">
                    All fields completed! Review your information above and click
                    "Create Account" to get started.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-6">
            {step > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={handlePrevStep}
              >
                Back
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                variant="gradient"
                size="lg"
                className="flex-1"
                onClick={handleNextStep}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="flex-1"
                isLoading={isLoading}
              >
                Create Account
              </Button>
            )}
          </div>
        </motion.form>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center text-gray-400 text-sm"
        >
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
