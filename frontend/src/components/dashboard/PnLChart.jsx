import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '../ui/Card'

const PnLChart = ({ trades = [], positions = [] }) => {
  const data = useMemo(() => {
    // Build cumulative P&L from closed trades
    if (trades.length === 0 && positions.length === 0) return []

    const closedTrades = [...trades]
      .filter(t => t.profit !== undefined && t.profit !== null)
      .sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0
        const tb = b.time ? new Date(b.time).getTime() : 0
        return ta - tb
      })

    if (closedTrades.length === 0) {
      // If no closed trades, show current open P&L as single point
      const openPnL = positions.reduce((sum, p) => sum + (parseFloat(p.pnl) || 0), 0)
      return [{ date: 'Now', pnl: openPnL, cumulative: openPnL }]
    }

    // Group by date and build cumulative
    const dailyMap = {}
    closedTrades.forEach(trade => {
      const date = trade.time
        ? new Date(typeof trade.time === 'number' ? trade.time * 1000 : trade.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Unknown'
      if (!dailyMap[date]) dailyMap[date] = 0
      dailyMap[date] += parseFloat(trade.profit) || 0
    })

    let cumulative = 0
    return Object.entries(dailyMap).map(([date, pnl]) => {
      cumulative += pnl
      return { date, pnl: Math.round(pnl * 100) / 100, cumulative: Math.round(cumulative * 100) / 100 }
    })
  }, [trades, positions])

  const totalPnL = data.length > 0 ? data[data.length - 1]?.cumulative || 0 : 0
  const isPositive = totalPnL >= 0

  return (
    <Card variant="elevated">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Profit & Loss
          </h3>
          {data.length > 0 && (
            <span className={`text-sm font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
          )}
        </div>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fff' }}
                formatter={(value, name) => [
                  `$${parseFloat(value).toFixed(2)}`,
                  name === 'cumulative' ? 'Cumulative P&L' : 'Daily P&L'
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                fill="url(#pnlGradient)"
                name="Cumulative P&L"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 text-sm">
            <p>No trade history yet</p>
            <p className="text-xs mt-1">P&L chart will populate as you close trades</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default PnLChart
