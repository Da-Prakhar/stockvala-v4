import React from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useThemeStore } from '../../store/themeStore'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold" style={{ color: payload[0].payload.fill }}>
        {payload[0].name}: {payload[0].value}
      </p>
    </div>
  )
}

export const AccountTypesPie = ({ data = [] }) => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const chartData = data.length > 0
    ? data
    : [{ name: 'No Data', value: 1 }]

  const labelColor = isDark ? '#94a3b8' : '#64748b'
  const legendColor = isDark ? '#94a3b8' : '#64748b'
  const strokeColor = isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.8)'

  const renderLabel = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 24
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill={labelColor} textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central" fontSize={12} fontWeight={500}>
        {name} {(percent * 100).toFixed(0)}%
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={90}
          innerRadius={45}
          fill="#8884d8"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: legendColor }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
