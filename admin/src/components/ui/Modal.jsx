import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`
                bg-white
                dark:bg-dark-800
                rounded-lg
                shadow-xl
                max-h-[90vh]
                overflow-y-auto
                w-full
                ${sizes[size]}
              `}
            >
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800">
                <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-50">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
