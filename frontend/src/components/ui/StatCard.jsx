import React from 'react'
import Card from './Card'

const StatCard = ({
  icon: Icon,
  label,
  value,
  change,
  changeType = 'neutral',
  trend,
  loading = false,
}) => {
  const changeColor =
    changeType === 'positive'
      ? 'text-green-600 dark:text-green-400'
      : changeType === 'negative'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-500 dark:text-slate-400'

  const changeBg =
    changeType === 'positive'
      ? 'bg-green-100 dark:bg-green-900/20'
      : changeType === 'negative'
      ? 'bg-red-100 dark:bg-red-900/20'
      : 'bg-slate-100 dark:bg-slate-700'

  return (
    <Card variant="elevated">
      <div className="p-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              {Icon && (
                <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                  <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              {change !== undefined && (
                <span className={`text-sm font-semibold ${changeColor}`}>
                  {changeType === 'positive' ? '+' : ''}{change}%
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</p>

            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {value}
            </p>

            {trend && (
              <p className={`text-xs mt-2 ${changeBg} ${changeColor} px-2 py-1 rounded inline-block`}>
                {trend}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export default StatCard
