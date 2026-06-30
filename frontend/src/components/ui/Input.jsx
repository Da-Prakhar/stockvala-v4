import React from 'react'

const Input = React.forwardRef(
  (
    {
      label,
      error,
      hint,
      icon: Icon,
      containerClassName = '',
      className = '',
      disabled = false,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'w-full px-4 py-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:disabled:bg-slate-900'

    const borderClass = error
      ? 'border-red-500 dark:border-red-500'
      : 'border-slate-200 dark:border-slate-600'

    return (
      <div className={containerClassName}>
        {label && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}

        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          )}

          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={`${baseClasses} ${borderClass} ${Icon ? 'pl-10' : ''} ${className}`}
            {...props}
          />
        </div>

        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
