import React from 'react'
import { motion } from 'framer-motion'

export const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {Icon && (
        <div className="mb-4 p-3 bg-dark-100 dark:bg-dark-700 rounded-full">
          <Icon className="w-8 h-8 text-dark-400 dark:text-dark-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-50 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-dark-600 dark:text-dark-400 text-sm mb-6 text-center max-w-sm">
          {description}
        </p>
      )}
      {action && action}
    </motion.div>
  )
}
