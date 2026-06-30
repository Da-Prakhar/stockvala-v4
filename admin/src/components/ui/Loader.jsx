import React from 'react'

export const Loader = ({ size = 'md', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  const loader = (
    <div className="flex items-center justify-center">
      <div
        className={`
          ${sizeClasses[size]}
          border-2
          border-primary-200
          dark:border-primary-900
          border-t-primary-600
          dark:border-t-primary-400
          rounded-full
          animate-spin
        `}
      />
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-dark-900 flex items-center justify-center z-50">
        {loader}
      </div>
    )
  }

  return loader
}
