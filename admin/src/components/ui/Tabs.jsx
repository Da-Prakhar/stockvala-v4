import React, { useState } from 'react'
import { motion } from 'framer-motion'

export const Tabs = ({ tabs, defaultTab = 0, activeTab: activeProp, onChange }) => {
  const [internalTab, setInternalTab] = useState(defaultTab)

  // Controlled mode: activeProp is a key string; find its index
  const activeIndex = activeProp !== undefined
    ? Math.max(0, tabs.findIndex(t => t.key === activeProp))
    : internalTab

  const handleClick = (index) => {
    setInternalTab(index)
    onChange?.(tabs[index].key ?? index)
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-dark-200 dark:border-dark-700 overflow-x-auto">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`
              px-4 py-3 font-medium text-sm whitespace-nowrap
              border-b-2 transition-colors
              ${activeIndex === index
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-dark-200'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[activeIndex]?.content && (
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          {tabs[activeIndex].content}
        </motion.div>
      )}
    </div>
  )
}
