import React, { useMemo } from 'react'
import Card from '../ui/Card'

const RecentTrades = ({ trades = [], positions = [] }) => {
  // Combine open positions and closed trades into one list, sorted by time desc
  const allTrades = useMemo(() => {
    const openMapped = positions.map((pos) => ({
      id: pos.id,
      symbol: pos.symbol || '',
      type: pos.type || 'buy',
      volume: parseFloat(pos.volume) || 0,
      openPrice: parseFloat(pos.openPrice) || 0,
      closePrice: parseFloat(pos.currentPrice) || 0,
      pnl: parseFloat(pos.pnl) || 0,
      status: 'open',
      time: pos.openTime ? new Date(typeof pos.openTime === 'number' ? pos.openTime * 1000 : pos.openTime) : new Date(),
    }))

    const closedMapped = trades.map((t) => ({
      id: t.id,
      symbol: t.symbol || '',
      type: t.type || '',
      volume: parseFloat(t.volume) || 0,
      openPrice: parseFloat(t.price) || 0,
      closePrice: parseFloat(t.price) || 0,
      pnl: parseFloat(t.profit) || 0,
      status: 'closed',
      time: t.time ? new Date(typeof t.time === 'number' ? t.time * 1000 : t.time) : null,
    }))

    return [...openMapped, ...closedMapped]
      .sort((a, b) => ((b.time?.getTime() || 0) - (a.time?.getTime() || 0)))
      .slice(0, 10)
  }, [trades, positions])

  return (
    <Card variant="elevated">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Trades
        </h3>

        {allTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">Symbol</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">Volume</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">P&L</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {allTrades.map((trade) => (
                  <tr
                    key={`${trade.status}-${trade.id}`}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        trade.type === 'buy'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}>
                        {(trade.type || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{trade.volume.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {trade.openPrice > 0 ? trade.openPrice.toFixed(trade.openPrice > 100 ? 2 : 5) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${
                        trade.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.status === 'open'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {trade.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            No trades yet. Place your first trade to see activity here.
          </div>
        )}
      </div>
    </Card>
  )
}

export default RecentTrades
