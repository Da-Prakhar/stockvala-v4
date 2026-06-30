import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '../ui/Card'

const COLORS = ['#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6']

const PortfolioChart = ({ positions = [], accounts = [] }) => {
  const data = useMemo(() => {
    if (positions.length === 0) return []

    // Group by symbol, sum absolute volume
    const symbolMap = {}
    positions.forEach((pos) => {
      const sym = pos.symbol || 'Unknown'
      if (!symbolMap[sym]) symbolMap[sym] = 0
      symbolMap[sym] += Math.abs(parseFloat(pos.volume) || 0)
    })

    const totalVolume = Object.values(symbolMap).reduce((s, v) => s + v, 0)
    if (totalVolume === 0) return []

    // Sort by volume descending, top 7 + "Others"
    const sorted = Object.entries(symbolMap)
      .map(([name, vol]) => ({ name, value: Math.round((vol / totalVolume) * 100) }))
      .sort((a, b) => b.value - a.value)

    if (sorted.length <= 8) return sorted

    const top7 = sorted.slice(0, 7)
    const othersValue = sorted.slice(7).reduce((s, e) => s + e.value, 0)
    return [...top7, { name: 'Others', value: othersValue }]
  }, [positions])

  // If no positions, show account distribution by balance
  const accountData = useMemo(() => {
    if (data.length > 0 || accounts.length === 0) return []
    const totalBal = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0)
    if (totalBal === 0) return []
    return accounts
      .filter(a => (parseFloat(a.balance) || 0) > 0)
      .map(a => ({
        name: `${a.login || a.mt5Login} (${(a.type || 'live').toUpperCase()})`,
        value: Math.round(((parseFloat(a.balance) || 0) / totalBal) * 100)
      }))
  }, [data, accounts])

  const chartData = data.length > 0 ? data : accountData
  const title = data.length > 0 ? 'Position Distribution' : 'Account Distribution'

  return (
    <Card variant="elevated">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {title}
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 text-sm">
            No open positions or accounts to display
          </div>
        )}
      </div>
    </Card>
  )
}

export default PortfolioChart
