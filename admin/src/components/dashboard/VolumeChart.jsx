import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useThemeStore } from '../../store/themeStore'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-dark-500 dark:text-dark-400 text-xs mb-1">{label}</p>
      <p className="text-sky-600 dark:text-cyan-400 font-semibold text-sm">
        ${payload[0].value?.toLocaleString()}
      </p>
    </div>
  )
}

export const VolumeChart = ({ data = [] }) => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const chartData = data.length > 0
    ? data
    : [{ date: 'No data', volume: 0 }]

  const axisColor = isDark ? '#64748b' : '#94a3b8'
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="volume"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          fill="url(#volumeGradient)"
          dot={{ fill: '#0ea5e9', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#0ea5e9', stroke: isDark ? '#0c3d66' : '#e0f2fe', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
