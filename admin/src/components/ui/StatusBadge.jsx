import React from 'react'

export const StatusBadge = ({ status, children }) => {
  const statusStyles = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    inactive: 'bg-dark-100 text-dark-600 border-dark-200 dark:bg-dark-600/40 dark:text-dark-400 dark:border-dark-600/30',
    pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
    suspended: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
    processing: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/20',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    failed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  }

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border
      ${statusStyles[status] || statusStyles.inactive}
    `}>
      {children}
    </span>
  )
}
