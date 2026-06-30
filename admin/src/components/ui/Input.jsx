import React from 'react'

export const Input = React.forwardRef(
  (
    {
      label,
      error,
      hint,
      icon: Icon,
      type = 'text',
      fullWidth = false,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const sizes = {
      sm: 'px-2 py-1 text-sm',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    }

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400 dark:text-dark-500">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`
              w-full
              ${Icon ? 'pl-10' : 'px-3'}
              py-2
              border-2
              border-dark-200
              dark:border-dark-700
              rounded-lg
              bg-white
              dark:bg-dark-800
              text-dark-900
              dark:text-dark-50
              placeholder-dark-400
              dark:placeholder-dark-500
              focus:outline-none
              focus:border-primary-600
              dark:focus:border-primary-500
              focus:ring-2
              focus:ring-primary-100
              dark:focus:ring-primary-900
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition-all
              ${error ? 'border-red-600 focus:border-red-600 focus:ring-red-100' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        {hint && !error && <p className="text-dark-500 dark:text-dark-400 text-sm mt-1">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
