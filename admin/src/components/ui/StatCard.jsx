import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'primary'
}) => {
  const colorMap = {
    primary: {
      bg: 'bg-sky-50 dark:bg-sky-500/10',
      icon: 'text-sky-600 dark:text-sky-400',
      border: 'border-sky-200 dark:border-sky-500/20',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      icon: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    danger: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      icon: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-500/20',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      icon: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-500/20',
    },
    info: {
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      icon: 'text-cyan-600 dark:text-cyan-400',
      border: 'border-cyan-200 dark:border-cyan-500/20',
    },
  }

  const c = colorMap[color] || colorMap.primary

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-dark-500 dark:text-dark-400 text-xs font-medium uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-xl font-bold text-dark-900 dark:text-dark-50 truncate">
            {value}
          </p>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend > 0 ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">+{trend}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 text-xs font-medium">{trend}%</span>
                </>
              )}
              {trendLabel && (
                <span className="text-dark-400 dark:text-dark-500 text-xs">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${c.bg} ${c.border} border`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
