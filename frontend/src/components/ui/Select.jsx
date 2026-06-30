import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useClickOutside } from '../../hooks/useClickOutside'

const Select = React.forwardRef(
  (
    {
      label,
      options,
      value,
      onChange,
      error,
      disabled = false,
      placeholder = 'Select...',
      containerClassName = '',
      className = '',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useClickOutside(() => setIsOpen(false))

    const selectedOption = options?.find((opt) => opt.value === value)

    return (
      <div ref={dropdownRef} className={`relative ${containerClassName}`}>
        {label && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}

        <button
          ref={ref}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-between transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
            error ? 'border-red-500' : ''
          } ${className}`}
        >
          <span className={selectedOption ? 'text-slate-900 dark:text-white' : 'text-slate-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {options?.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors duration-150 ${
                  value === option.value
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
