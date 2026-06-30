import { forwardRef } from 'react';

const Input = forwardRef(
  (
    { label, error, icon: Icon, type = 'text', className = '', ...props },
    ref,
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
          )}
          <input
            ref={ref}
            type={type}
            className={`
              w-full px-4 py-2.5 rounded-lg
              bg-white dark:bg-dark-700
              border border-gray-300 dark:border-dark-600
              text-gray-900 dark:text-white
              placeholder-gray-500 dark:placeholder-gray-400
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              dark:focus:ring-offset-dark-900
              disabled:opacity-50 disabled:cursor-not-allowed
              ${Icon ? 'pl-10' : ''}
              ${error ? 'border-danger focus:ring-danger' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-danger font-medium">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
