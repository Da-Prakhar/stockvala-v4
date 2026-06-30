import React from 'react'

export const Card = React.forwardRef(
  ({ children, className = '', noPadding = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-white
          dark:bg-dark-800
          border
          border-dark-200
          dark:border-dark-700
          rounded-xl
          shadow-sm
          dark:shadow-lg
          ${!noPadding ? 'p-6' : ''}
          transition-all
          hover:shadow-md
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
