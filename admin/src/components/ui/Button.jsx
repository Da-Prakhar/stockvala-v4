import React from 'react'
import { motion } from 'framer-motion'
import { Loader } from 'lucide-react'

export const Button = React.forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon: Icon,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2'

    const variants = {
      primary:
        'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 shadow-md hover:shadow-lg',
      secondary:
        'bg-dark-200 text-dark-900 hover:bg-dark-300 dark:bg-dark-700 dark:text-dark-50 dark:hover:bg-dark-600',
      danger:
        'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
      success:
        'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
      ghost:
        'text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800',
      outline:
        'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:border-primary-500 dark:text-primary-400 dark:hover:bg-dark-800',
    }

    const sizes = {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      xl: 'px-8 py-4 text-lg',
    }

    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        disabled={isDisabled}
        className={`
          ${baseStyles}
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        {...props}
      >
        {loading && <Loader className="w-4 h-4 animate-spin" />}
        {Icon && !loading && <Icon className="w-4 h-4" />}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
