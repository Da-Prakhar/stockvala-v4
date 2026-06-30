import React from 'react'
import { motion } from 'framer-motion'

const Card = React.forwardRef(
  (
    {
      children,
      className = '',
      hoverable = false,
      onClick,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'rounded-lg border transition-all duration-300 dark:border-slate-700'

    const variants = {
      default: 'bg-white dark:bg-slate-800 border-slate-200 shadow-sm',
      elevated: 'bg-white dark:bg-slate-800 border-slate-200 shadow-lg',
      flat: 'bg-slate-50 dark:bg-slate-800/50 border-transparent',
      outlined: 'bg-transparent dark:bg-transparent border-slate-200 dark:border-slate-700',
    }

    const hoverClass = hoverable ? 'cursor-pointer hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800' : ''

    return (
      <motion.div
        ref={ref}
        className={`${baseClasses} ${variants[variant]} ${hoverClass} ${className}`}
        onClick={onClick}
        whileHover={hoverable ? { y: -2 } : {}}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

Card.displayName = 'Card'
export default Card

export const CardHeader = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 ${className}`}>
    {children}
  </div>
)

export const CardBody = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>{children}</div>
)

export const CardFooter = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between ${className}`}>
    {children}
  </div>
)
