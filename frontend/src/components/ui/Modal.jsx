import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { modalBackdropVariants, modalContentVariants } from '../../utils/animations'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeButton = true,
}) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            variants={modalBackdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              className={`${sizes[size]} w-full mx-4 pointer-events-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl`}
              variants={modalContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {(title || closeButton) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  {title && (
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {title}
                    </h2>
                  )}
                  {closeButton && (
                    <button
                      onClick={onClose}
                      className="ml-auto p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              <div className="px-6 py-4">{children}</div>

              {footer && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Modal
