import React from 'react'
import { motion } from 'framer-motion'

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionText,
  illustration,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {illustration ? (
        <img src={illustration} alt="Empty state" className="h-48 w-48 mb-6 opacity-70" />
      ) : Icon ? (
        <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
          <Icon className="h-12 w-12 text-slate-400 dark:text-slate-600" />
        </div>
      ) : null}

      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-6">
        {description}
      </p>

      {action && actionText && (
        <button
          onClick={action}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  )
}

export default EmptyState
