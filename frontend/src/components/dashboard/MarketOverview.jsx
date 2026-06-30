import React, { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Card from '../ui/Card'
import api from '../../utils/api'
import { getSocket } from '../../utils/socket'

/**
 * Desired symbols to show on dashboard — these are "base" names.
 * We resolve them against real MT5 symbols on mount.
 */
const DESIRED_SYMBOLS = [
  { base: 'EURUSD', label: 'EUR/USD', category: 'Forex' },
  { base: 'GBPUSD', label: 'GBP/USD', category: 'Forex' },
  { base: 'USDJPY', label: 'USD/JPY', category: 'Forex' },
  { base: 'AUDUSD', label: 'AUD/USD', category: 'Forex' },
  { base: 'USDCAD', label: 'USD/CAD', category: 'Forex' },
  { base: 'XAUUSD', label: 'Gold', category: 'Metals' },
  { base: 'BTCUSD', label: 'Bitcoin', category: 'Crypto' },
  { base: 'US30', label: 'Dow Jones', category: 'Indices' },
  { base: 'CRUDEOIL', label: 'Crude Oil MCX', category: 'MCX' },
  { base: 'GOLD', label: 'Gold MCX', category: 'MCX' },
  { base: 'SILVER', label: 'Silver MCX', category: 'MCX' },
  { base: 'NATURALGAS', label: 'Natural Gas MCX', category: 'MCX' },
  { base: 'NIFTY50', label: 'Nifty 50', category: 'NSE' },
  { base: 'BANKNIFTY', label: 'Bank Nifty', category: 'NSE' },
]

const MarketOverview = () => {
  const [watchlist, setWatchlist] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const prevPrices = useRef({})
  const pricesRef = useRef({}) // mutable copy for socket handlers

  // Keep pricesRef in sync
  useEffect(() => { pricesRef.current = prices }, [prices])

  // Step 1: Resolve symbols
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/trades/symbols/grouped')
        const data = res.data?.data || {}
        const sMap = data.symbolMap || {}
        const resolved = []
        for (const d of DESIRED_SYMBOLS) {
          const mt5Name = sMap[d.base] || sMap[d.base.toUpperCase()] || null
          if (mt5Name) resolved.push({ ...d, mt5Symbol: mt5Name })
        }
        setWatchlist(resolved.length > 0 ? resolved : DESIRED_SYMBOLS.map(d => ({ ...d, mt5Symbol: d.base })))
      } catch (_) {
        setWatchlist(DESIRED_SYMBOLS.map(d => ({ ...d, mt5Symbol: d.base })))
      }
    }
    init()
  }, [])

  // Helper: merge a tick update into prices state
  const applyTick = (base, bid, ask) => {
    if (!bid || bid <= 0) return
    const prev = pricesRef.current[base] || {}
    const prevBid = prev.bid || bid
    const change = prevBid > 0 ? ((bid - prevBid) / prevBid) * 100 : 0
    setPrices(p => ({
      ...p,
      [base]: { bid, ask: ask || bid, change: Math.round(change * 10000) / 10000 }
    }))
  }

  // Step 2a: Subscribe to Socket.IO price_update for each symbol
  useEffect(() => {
    if (watchlist.length === 0) return
    const socket = getSocket()
    if (!socket) return

    // Subscribe to all symbols at once
    const symbolNames = watchlist.map(w => w.mt5Symbol)
    socket.emit('price:subscribe', symbolNames)

    // Single handler for all price_update events
    const handler = (data) => {
      const sym = (data.symbol || '').replace(/\.#$/, '')
      const entry = watchlist.find(w => w.mt5Symbol === sym || w.mt5Symbol === data.symbol || w.base === sym)
      const baseKey = entry ? entry.base : sym
      applyTick(baseKey, parseFloat(data.bid) || 0, parseFloat(data.ask) || 0)
      setLoading(false)
    }
    socket.on('price_update', handler)

    return () => {
      socket.off('price_update', handler)
      socket.emit('price:unsubscribe', symbolNames)
    }
  }, [watchlist])

  // Step 2b: REST fallback — initial load + 3s polling (covers when socket isn't delivering)
  const fetchPrices = async () => {
    if (watchlist.length === 0) return
    const results = {}
    await Promise.allSettled(
      watchlist.map(async ({ base, mt5Symbol }) => {
        try {
          const res = await api.get(`/trades/tick/${mt5Symbol}`)
          const data = res.data?.data || res.data || {}
          const bid = parseFloat(data.bid) || 0
          const ask = parseFloat(data.ask) || 0
          if (bid > 0 || ask > 0) results[base] = { bid, ask }
        } catch (_) {}
      })
    )
    if (Object.keys(results).length === 0) return

    const withChange = {}
    Object.entries(results).forEach(([sym, { bid, ask }]) => {
      const prevBid = prevPrices.current[sym]?.bid || bid
      const change = prevBid > 0 ? ((bid - prevBid) / prevBid) * 100 : 0
      withChange[sym] = { bid, ask, change: Math.round(change * 10000) / 10000 }
    })
    prevPrices.current = results
    setPrices(p => ({ ...p, ...withChange }))
    setLoading(false)
  }

  useEffect(() => {
    if (watchlist.length === 0) return
    fetchPrices()
    const interval = setInterval(fetchPrices, 3000)
    return () => clearInterval(interval)
  }, [watchlist])

  const formatPrice = (price, symbol) => {
    if (!price || price === 0) return '—'
    if (/GOLD|SILVER|CRUDEOIL|NATURALGAS|COPPER|NIFTY|BANKNIFTY|XAU|BTC|ETH|US30|US500|NAS|GER/.test(symbol)) return price.toFixed(2)
    if (symbol.includes('JPY')) return price.toFixed(3)
    return price.toFixed(5)
  }

  const visibleSymbols = watchlist.filter(s => prices[s.base] || loading)

  return (
    <Card variant="elevated">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Market Overview</h3>
          {!loading && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(loading && visibleSymbols.length === 0 ? DESIRED_SYMBOLS : visibleSymbols).map(({ base, label, category }) => {
            const p = prices[base]
            const spread = p
              ? ((p.ask - p.bid) * (base.includes('JPY') ? 1000 : /XAU|BTC|ETH|US30|US500|GOLD|SILVER|CRUDEOIL|NATURALGAS|NIFTY|BANKNIFTY/.test(base) ? 100 : 100000))
              : 0

            return (
              <div
                key={base}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{category}</span>
                  {p ? (
                    p.change > 0 ? <TrendingUp className="h-3 w-3 text-green-500" />
                    : p.change < 0 ? <TrendingDown className="h-3 w-3 text-red-500" />
                    : <Minus className="h-3 w-3 text-slate-400" />
                  ) : null}
                </div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mb-2">{base}</p>
                {loading && !p ? (
                  <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                ) : p ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg font-bold font-mono ${
                        p.change > 0 ? 'text-green-500' : p.change < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'
                      }`}>
                        {formatPrice(p.bid, base)}
                      </span>
                      {p.change !== 0 && (
                        <span className={`text-[10px] font-semibold ${p.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {p.change > 0 ? '+' : ''}{p.change.toFixed(4)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">Ask: {formatPrice(p.ask, base)}</span>
                      <span className="text-[10px] text-slate-400">Spd: {spread.toFixed(1)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>

        {!loading && visibleSymbols.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No market data available. Check MT5 connection.
          </p>
        )}
      </div>
    </Card>
  )
}

export default MarketOverview
