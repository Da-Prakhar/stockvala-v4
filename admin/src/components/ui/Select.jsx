import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export const Select = React.forwardRef(
  (
    {
      label,
      options = [],
      value,
      onChange,
      error,
      disabled = false,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`
              w-full
              px-3 py-2
              border-2
              border-dark-200
              dark:border-dark-700
              rounded-lg
              bg-white
              dark:bg-dark-800
              text-dark-900
              dark:text-dark-50
              appearance-none
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
          >
            {options.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-500 dark:text-dark-400 pointer-events-none" />
        </div>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
