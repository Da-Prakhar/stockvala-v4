import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useThemeStore } from '../../store/themeStore'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-dark-500 dark:text-dark-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: ${p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export const DepositWithdrawalChart = ({ data = [] }) => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const chartData = data.length > 0
    ? data
    : [{ date: 'No data', deposits: 0, withdrawals: 0 }]

  const axisColor = isDark ? '#64748b' : '#94a3b8'
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)'
  const legendColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="date"
          stroke={axisColor}
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
        />
        <YAxis
          stroke={axisColor}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: legendColor }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="deposits" fill="#10b981" name="Deposits" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="withdrawals" fill="#f59e0b" name="Withdrawals" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
