import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useThemeStore } from '../../store/themeStore'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-dark-500 dark:text-dark-400 text-xs mb-1">{label}</p>
      <p className="text-cyan-600 dark:text-cyan-400 font-semibold text-sm">
        {payload[0].value} clients
      </p>
    </div>
  )
}

export const CountriesChart = ({ data = [] }) => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const chartData = data.length > 0
    ? data
    : [{ country: 'No data', clients: 0 }]

  const axisColor = isDark ? '#64748b' : '#94a3b8'
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)'
  const labelColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis
          type="number"
          stroke={axisColor}
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="country"
          stroke={labelColor}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="clients" fill="#06b6d4" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
