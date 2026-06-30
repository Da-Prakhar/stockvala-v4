import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Star, Search, ChevronDown, ChevronUp,
  Plus, Minus, X, ArrowUpRight, ArrowDownRight,
  Menu, ShoppingCart
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTradeStore } from '../store/tradeStore'
import { useAccountStore } from '../store/accountStore'
import { useThemeStore } from '../store/themeStore'
import { useSocket } from '../hooks/useSocket'
import api from '../utils/api'

/* ═══════════════════════════════════════════════════
   SVG Icons for chart toolbar (inline to avoid extra deps)
   ═══════════════════════════════════════════════════ */
const ChartIcon = ({ type, size = 14, className = '' }) => {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className }
  switch (type) {
    case 'candle': return <svg {...s}><rect x="9" y="4" width="6" height="16" rx="1"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/></svg>
    case 'line': return <svg {...s}><polyline points="3,17 8,11 13,15 21,5"/></svg>
    case 'area': return <svg {...s}><polyline points="3,17 8,11 13,15 21,5"/><polygon points="3,17 8,11 13,15 21,5 21,21 3,21" fill="currentColor" opacity="0.15" stroke="none"/></svg>
    case 'bars': return <svg {...s}><line x1="6" y1="4" x2="6" y2="20"/><line x1="3" y1="8" x2="6" y2="8"/><line x1="6" y1="16" x2="9" y2="16"/><line x1="14" y1="6" x2="14" y2="18"/><line x1="11" y1="10" x2="14" y2="10"/><line x1="14" y1="14" x2="17" y2="14"/></svg>
    case 'crosshair': return <svg {...s}><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>
    case 'trendline': return <svg {...s}><line x1="4" y1="20" x2="20" y2="4"/></svg>
    case 'hline': return <svg {...s}><line x1="2" y1="12" x2="22" y2="12"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/></svg>
    case 'fib': return <svg {...s}><line x1="3" y1="5" x2="21" y2="5" strokeDasharray="2"/><line x1="3" y1="10" x2="21" y2="10" strokeDasharray="4 2"/><line x1="3" y1="14" x2="21" y2="14" strokeDasharray="4 2"/><line x1="3" y1="19" x2="21" y2="19" strokeDasharray="2"/></svg>
    case 'ruler': return <svg {...s}><line x1="4" y1="20" x2="20" y2="4"/><line x1="4" y1="20" x2="4" y2="14"/><line x1="4" y1="20" x2="10" y2="20"/></svg>
    case 'indicator': return <svg {...s}><path d="M3,17 Q7,3 12,12 Q17,21 21,7"/></svg>
    case 'magnet': return <svg {...s}><path d="M6,18 C6,12 12,6 18,6"/><line x1="6" y1="18" x2="3" y2="21"/><line x1="6" y1="18" x2="9" y2="21"/></svg>
    case 'screenshot': return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3,8 L7,8 L8,5 L16,5 L17,8 L21,8"/></svg>
    case 'fullscreen': return <svg {...s}><polyline points="4,14 4,20 10,20"/><polyline points="20,10 20,4 14,4"/><line x1="14" y1="10" x2="20" y2="4"/><line x1="4" y1="20" x2="10" y2="14"/></svg>
    case 'zoomin': return <svg {...s}><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="22" y2="22"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
    case 'zoomout': return <svg {...s}><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="22" y2="22"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    case 'undo': return <svg {...s}><polyline points="1,4 1,10 7,10"/><path d="M3.51,15a9,9,0,1,0,2.13-9.36L1,10"/></svg>
    case 'trade': return <svg {...s}><path d="M12,2 L12,22"/><polyline points="8,6 12,2 16,6"/><polyline points="8,18 12,22 16,18"/></svg>
    default: return null
  }
}

/* ═══════════════════════════════════════════════════
   Indicator calculation helpers
   ═══════════════════════════════════════════════════ */
const calcSMA = (data, period) => {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

const calcEMA = (data, period) => {
  const result = []
  const k = 2 / (period + 1)
  let ema = null
  for (let i = 0; i < data.length; i++) {
    if (ema === null) {
      if (i < period - 1) continue
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += data[j].close
      ema = sum / period
    } else {
      ema = data[i].close * k + ema * (1 - k)
    }
    result.push({ time: data[i].time, value: ema })
  }
  return result
}

const calcBollingerBands = (data, period = 20, stdDev = 2) => {
  const upper = [], lower = [], mid = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    const avg = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += Math.pow(data[j].close - avg, 2)
    const std = Math.sqrt(variance / period)
    mid.push({ time: data[i].time, value: avg })
    upper.push({ time: data[i].time, value: avg + stdDev * std })
    lower.push({ time: data[i].time, value: avg - stdDev * std })
  }
  return { upper, lower, mid }
}

const calcVWAP = (data) => {
  const result = []
  let cumVol = 0, cumTP = 0
  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3
    const vol = data[i].volume || 1
    cumVol += vol
    cumTP += tp * vol
    result.push({ time: data[i].time, value: cumTP / cumVol })
  }
  return result
}

/* ═══════════════════════════════════════════════════
   StockVala inline logo — used as chart watermark
   ═══════════════════════════════════════════════════ */
const StockValaLogo = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Left cyan chevron */}
    <path d="M6 10 C6 8 7.5 6.5 9.5 6.5 L14 6.5 C15.5 6.5 16.5 7.5 17.5 8.8 L26 24 L17.5 39.2 C16.5 40.5 15.5 41.5 14 41.5 L9.5 41.5 C7.5 41.5 6 40 6 38 C6 37.2 6.3 36.4 6.8 35.8 L14.2 24 L6.8 12.2 C6.3 11.6 6 10.8 6 10 Z" fill="#00D4F5"/>
    {/* Right purple chevron */}
    <path d="M18 10 C18 8 19.5 6.5 21.5 6.5 L26 6.5 C27.5 6.5 28.5 7.5 29.5 8.8 L38 24 L29.5 39.2 C28.5 40.5 27.5 41.5 26 41.5 L21.5 41.5 C19.5 41.5 18 40 18 38 C18 37.2 18.3 36.4 18.8 35.8 L26.2 24 L18.8 12.2 C18.3 11.6 18 10.8 18 10 Z" fill="#7C3AED"/>
    {/* Dot top-right */}
    <circle cx="38" cy="9" r="4.5" fill="#9333EA"/>
  </svg>
)

/* ═══════════════════════════════════════════════════
   Professional MT5 Chart Component
   Full trading chart with indicators, tools, one-click trading
   ═══════════════════════════════════════════════════ */
const MT5Chart = ({ symbol = 'EURUSD', onQuickTrade, positions = [], isDark = true }) => {
  const wrapperRef = useRef(null)
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const mainSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const indicatorSeriesRefs = useRef([])
  const rawDataRef = useRef([])
  const isFirstLoadRef = useRef(true)

  const [timeframe, setTimeframe] = useState('M15')
  const [loading, setLoading] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [chartType, setChartType] = useState('candle') // candle, line, area, bars
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false)
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false)
  const [showDrawingMenu, setShowDrawingMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showOneClickTrading, setShowOneClickTrading] = useState(false)

  // Active indicators state
  const [activeIndicators, setActiveIndicators] = useState([
    { id: 'sma20', type: 'SMA', period: 20, color: '#f59e0b', enabled: false },
    { id: 'sma50', type: 'SMA', period: 50, color: '#3b82f6', enabled: false },
    { id: 'ema9', type: 'EMA', period: 9, color: '#a855f7', enabled: false },
    { id: 'ema21', type: 'EMA', period: 21, color: '#ec4899', enabled: false },
    { id: 'bb', type: 'BB', period: 20, color: '#6366f1', enabled: false },
    { id: 'vwap', type: 'VWAP', period: 0, color: '#14b8a6', enabled: false },
  ])

  // Crosshair data for OHLC info bar
  const [ohlcInfo, setOhlcInfo] = useState(null)

  // Drawing tool state
  const [activeTool, setActiveTool] = useState(null) // 'trendline', 'hline', 'fib', 'ruler'
  const priceLineRefs = useRef([])
  const positionLinesRef = useRef([])

  // ─── Theme colour tokens for toolbar / overlays ─────────────────────────────
  const C = isDark ? {
    wrapBg:      'bg-[#0f1724]',
    toolbar:     'bg-[#131c2e] border-[#1e2d45]',
    divider:     'bg-[#1e2d45]',
    btn:         'text-slate-400 hover:text-slate-100 hover:bg-white/5',
    dropdown:    'bg-[#131c2e] border-[#1e2d45] shadow-black/50',
    item:        'text-slate-300 hover:bg-white/5',
    sectionHdr:  'text-slate-500 border-[#1e2d45]',
    checkbox:    'border-slate-600',
    ohlcBar:     'bg-[#0f1724] border-[#1e2d45]',
    ohlcSym:     'text-slate-200',
    ohlcLabel:   'text-slate-500',
    ohlcVal:     'text-slate-300',
    oneClick:    'bg-[#0d1520]/95 border-[#1e2d45]',
    oneClickMid: 'bg-[#131c2e]',
    oneClickMeta:'text-slate-400',
    oneClickAmt: 'text-slate-100',
    clearHover:  'hover:bg-white/5',
  } : {
    wrapBg:      'bg-white',
    toolbar:     'bg-[#f8f9fa] border-[#e0e0e0]',
    divider:     'bg-gray-300',
    btn:         'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
    dropdown:    'bg-white border-gray-200 shadow-black/10',
    item:        'text-gray-700 hover:bg-gray-100',
    sectionHdr:  'text-gray-400 border-gray-200',
    checkbox:    'border-gray-300',
    ohlcBar:     'bg-white border-gray-200',
    ohlcSym:     'text-gray-900',
    ohlcLabel:   'text-gray-400',
    ohlcVal:     'text-gray-700',
    oneClick:    'bg-white/95 border-gray-200',
    oneClickMid: 'bg-gray-50',
    oneClickMeta:'text-gray-400',
    oneClickAmt: 'text-gray-800',
    clearHover:  'hover:bg-gray-100',
  }

  // Load lightweight-charts library
  useEffect(() => {
    if (window.LightweightCharts) { setScriptLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js'
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => console.error('Failed to load lightweight-charts')
    document.head.appendChild(script)
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.LightweightCharts) return
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; mainSeriesRef.current = null; volumeSeriesRef.current = null; indicatorSeriesRefs.current = [] }

    const LWC = window.LightweightCharts
    const bgClr     = isDark ? '#0f1724' : '#ffffff'
    const txtClr    = isDark ? '#94a3b8' : '#374151'
    const gridClr   = isDark ? '#1e2d45' : '#f0f0f0'
    const borderClr = isDark ? '#1e2d45' : '#e0e0e0'
    const chart = LWC.createChart(containerRef.current, {
      layout: { background: { color: bgClr }, textColor: txtClr, fontSize: 11, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
      grid: { vertLines: { color: gridClr, style: 1 }, horzLines: { color: gridClr, style: 1 } },
      crosshair: {
        mode: LWC.CrosshairMode.Normal,
        vertLine: { color: '#2962FF80', width: 1, style: LWC.LineStyle.Dashed, labelBackgroundColor: '#2962FF' },
        horzLine: { color: '#2962FF80', width: 1, style: LWC.LineStyle.Dashed, labelBackgroundColor: '#2962FF' },
      },
      timeScale: {
        borderColor: borderClr, timeVisible: true, secondsVisible: false,
        rightOffset: 5, barSpacing: 8, minBarSpacing: 3,
        // Show bar times in the user's local timezone
        tickMarkFormatter: (time) => {
          const d = new Date(time * 1000)
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      },
      localization: {
        timeFormatter: (time) => {
          const d = new Date(time * 1000)
          return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        },
      },
      watermark: { visible: false },
      rightPriceScale: { borderColor: borderClr, scaleMargins: { top: 0.05, bottom: 0.05 }, entireTextOnly: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    // Main price series (candles by default)
    const mainSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    })
    mainSeriesRef.current = mainSeries

    // Crosshair move handler for OHLC info
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setOhlcInfo(null)
        return
      }
      const data = param.seriesData.get(mainSeries)
      if (data) {
        setOhlcInfo({
          time: param.time,
          open: data.open ?? data.value ?? 0,
          high: data.high ?? data.value ?? 0,
          low: data.low ?? data.value ?? 0,
          close: data.close ?? data.value ?? 0,
        })
      }
    })

    // Click handler for drawing tools (horizontal line)
    chart.subscribeClick((param) => {
      if (activeTool === 'hline' && param.point) {
        const price = mainSeries.coordinateToPrice(param.point.y)
        if (price) {
          const pl = mainSeries.createPriceLine({
            price: price, color: '#f59e0b', lineWidth: 1,
            lineStyle: LWC.LineStyle.Dashed, axisLabelVisible: true,
            title: `H ${price.toFixed(5)}`,
          })
          priceLineRefs.current.push(pl)
        }
      }
    })

    chartRef.current = chart

    // Auto-resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      }
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; mainSeriesRef.current = null; volumeSeriesRef.current = null; indicatorSeriesRefs.current = [] } }
  }, [scriptLoaded])

  // Change chart type
  useEffect(() => {
    if (!chartRef.current || !scriptLoaded) return
    const LWC = window.LightweightCharts
    const chart = chartRef.current
    const data = rawDataRef.current
    if (!data.length) return

    // Remove old main series
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current) } catch {}
    }

    let newSeries
    if (chartType === 'candle') {
      newSeries = chart.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e90', wickDownColor: '#ef444490',
      })
      newSeries.setData(data)
    } else if (chartType === 'line') {
      newSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 })
      newSeries.setData(data.map(d => ({ time: d.time, value: d.close })))
    } else if (chartType === 'area') {
      newSeries = chart.addAreaSeries({
        topColor: '#3b82f640', bottomColor: '#3b82f605', lineColor: '#3b82f6', lineWidth: 2,
      })
      newSeries.setData(data.map(d => ({ time: d.time, value: d.close })))
    } else if (chartType === 'bars') {
      newSeries = chart.addBarSeries({
        upColor: '#26a69a', downColor: '#ef5350',
      })
      newSeries.setData(data)
    }

    mainSeriesRef.current = newSeries

    // Re-subscribe crosshair
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) { setOhlcInfo(null); return }
      const d = param.seriesData.get(newSeries)
      if (d) setOhlcInfo({ time: param.time, open: d.open ?? d.value ?? 0, high: d.high ?? d.value ?? 0, low: d.low ?? d.value ?? 0, close: d.close ?? d.value ?? 0 })
    })

    // Re-apply indicators, then re-draw position lines on the new series
    applyIndicators(data)
    drawPositionLinesRef.current()
  }, [chartType])

  // Apply indicators to chart
  const applyIndicators = useCallback((data) => {
    if (!chartRef.current || !data?.length) return
    const chart = chartRef.current

    // Remove old indicator series
    indicatorSeriesRefs.current.forEach(s => { try { chart.removeSeries(s) } catch {} })
    indicatorSeriesRefs.current = []

    activeIndicators.forEach(ind => {
      if (!ind.enabled) return
      let lineData = []

      if (ind.type === 'SMA') lineData = calcSMA(data, ind.period)
      else if (ind.type === 'EMA') lineData = calcEMA(data, ind.period)
      else if (ind.type === 'VWAP') lineData = calcVWAP(data)
      else if (ind.type === 'BB') {
        const bb = calcBollingerBands(data, ind.period)
        // Upper band
        const upperS = chart.addLineSeries({ color: ind.color + '80', lineWidth: 1, lineStyle: 2 })
        upperS.setData(bb.upper)
        indicatorSeriesRefs.current.push(upperS)
        // Lower band
        const lowerS = chart.addLineSeries({ color: ind.color + '80', lineWidth: 1, lineStyle: 2 })
        lowerS.setData(bb.lower)
        indicatorSeriesRefs.current.push(lowerS)
        // Mid band
        const midS = chart.addLineSeries({ color: ind.color, lineWidth: 1 })
        midS.setData(bb.mid)
        indicatorSeriesRefs.current.push(midS)
        return
      }

      if (lineData.length > 0) {
        const s = chart.addLineSeries({ color: ind.color, lineWidth: 1.5, lastValueVisible: true, priceLineVisible: false })
        s.setData(lineData)
        indicatorSeriesRefs.current.push(s)
      }
    })
  }, [activeIndicators])

  const [chartUnavailable, setChartUnavailable] = useState(false)

  // Fetch candle data
  const fetchCandles = useCallback(async () => {
    if (!mainSeriesRef.current) return
    setLoading(true)
    try {
      const res = await api.get(`/trades/chart/${symbol}?timeframe=${timeframe}&count=500`)
      const data = res.data?.data || res.data || {}
      const candles = data.candles || []
      if (candles.length > 0) {
        setChartUnavailable(false)
        const formatted = candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 }))
        rawDataRef.current = formatted

        // Save visible range before updating data so we can restore it
        let savedRange = null
        if (!isFirstLoadRef.current && chartRef.current) {
          try { savedRange = chartRef.current.timeScale().getVisibleLogicalRange() } catch {}
        }

        if (chartType === 'candle' || chartType === 'bars') {
          mainSeriesRef.current.setData(formatted)
        } else {
          mainSeriesRef.current.setData(formatted.map(d => ({ time: d.time, value: d.close })))
        }

        // Only fitContent on first load; restore user's zoom on refresh
        if (isFirstLoadRef.current) {
          chartRef.current?.timeScale().fitContent()
          isFirstLoadRef.current = false
        } else if (savedRange) {
          try { chartRef.current?.timeScale().setVisibleLogicalRange(savedRange) } catch {}
        }

        // Apply indicators
        applyIndicators(formatted)
        // Redraw open-position lines on top of fresh candle data
        drawPositionLinesRef.current()
      } else {
        setChartUnavailable(true)
      }
    } catch (err) {
      console.error('Chart data fetch error:', err.message)
      setChartUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [symbol, timeframe, chartType, applyIndicators])

  useEffect(() => {
    isFirstLoadRef.current = true // reset so new symbol/timeframe gets fitContent
    if (scriptLoaded && mainSeriesRef.current) fetchCandles()
  }, [symbol, timeframe, scriptLoaded, fetchCandles])

  useEffect(() => {
    // When chart is unavailable (aggregator building), retry every 30s.
    // Once data arrives, switch to normal 15s refresh.
    const iv = setInterval(fetchCandles, chartUnavailable ? 30000 : 15000)
    return () => clearInterval(iv)
  }, [fetchCandles, chartUnavailable])

  // Toggle indicator
  const toggleIndicator = (id) => {
    setActiveIndicators(prev => {
      const updated = prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind)
      // Re-apply after state update
      setTimeout(() => applyIndicators(rawDataRef.current), 50)
      return updated
    })
  }

  // Re-apply indicators when toggled
  useEffect(() => {
    if (rawDataRef.current.length > 0) applyIndicators(rawDataRef.current)
  }, [activeIndicators, applyIndicators])

  // Remove all drawings
  const clearDrawings = () => {
    if (mainSeriesRef.current) {
      priceLineRefs.current.forEach(pl => { try { mainSeriesRef.current.removePriceLine(pl) } catch {} })
      priceLineRefs.current = []
    }
    setActiveTool(null)
  }

  // Screenshot
  const takeScreenshot = () => {
    if (!chartRef.current) return
    try {
      const canvas = chartRef.current.takeScreenshot()
      if (canvas) {
        const link = document.createElement('a')
        link.download = `${symbol}_${timeframe}_${Date.now()}.png`
        link.href = canvas.toDataURL()
        link.click()
      }
    } catch {}
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!wrapperRef.current) return
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Sync chart colours when theme toggles at runtime ────────────────────────
  useEffect(() => {
    if (!chartRef.current) return
    const gridClr   = isDark ? '#1e2d45' : '#f0f0f0'
    const borderClr = isDark ? '#1e2d45' : '#e0e0e0'
    chartRef.current.applyOptions({
      layout: { background: { color: isDark ? '#0f1724' : '#ffffff' }, textColor: isDark ? '#94a3b8' : '#374151' },
      grid: { vertLines: { color: gridClr }, horzLines: { color: gridClr } },
      timeScale: { borderColor: borderClr },
      rightPriceScale: { borderColor: borderClr },
    })
  }, [isDark])

  // ── Draw open-position entry price lines on the chart ───────────────────────
  // Defined as a plain function so every render has the freshest positions/symbol.
  // drawPositionLinesRef lets useCallback closures (fetchCandles, chartType) call it.
  const drawPositionLines = () => {
    if (!mainSeriesRef.current) return
    const LWC = window.LightweightCharts
    if (!LWC) return
    // Remove previous position lines
    positionLinesRef.current.forEach(pl => { try { mainSeriesRef.current.removePriceLine(pl) } catch {} })
    positionLinesRef.current = []
    const baseSymbol = (symbol || '').replace(/\.\#.*$/, '').toUpperCase()
    ;(positions || []).forEach(pos => {
      const posBase = (pos.symbol || '').replace(/\.\#.*$/, '').toUpperCase()
      if (posBase !== baseSymbol || !pos.openPrice) return
      const isBuy = (pos.type || '').toLowerCase() === 'buy'
      const color  = isBuy ? '#22c55e' : '#ef4444'
      const pnl    = pos.pnl || 0
      const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
      try {
        const pl = mainSeriesRef.current.createPriceLine({
          price: parseFloat(pos.openPrice),
          color, lineWidth: 1,
          lineStyle: LWC.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${isBuy ? '▲' : '▼'} ${(pos.volume || 0).toFixed(2)}L  ${pnlStr}`,
        })
        positionLinesRef.current.push(pl)
      } catch {}
    })
  }
  // Keep a ref so useCallback closures always call the latest version
  const drawPositionLinesRef = useRef(drawPositionLines)
  drawPositionLinesRef.current = drawPositionLines

  // Redraw whenever positions list or selected symbol changes
  useEffect(() => {
    drawPositionLines()
  }, [positions, symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const timeframes = [
    { key: 'M1', label: '1m' }, { key: 'M5', label: '5m' }, { key: 'M15', label: '15m' },
    { key: 'M30', label: '30m' }, { key: 'H1', label: '1H' }, { key: 'H4', label: '4H' }, { key: 'D1', label: '1D' },
  ]

  const chartTypeLabel = { candle: 'Candles', line: 'Line', area: 'Area', bars: 'Bars' }

  // OHLC info display
  const lastCandle = rawDataRef.current.length > 0 ? rawDataRef.current[rawDataRef.current.length - 1] : null
  const displayOhlc = ohlcInfo || lastCandle
  const ohlcChange = displayOhlc ? (displayOhlc.close - displayOhlc.open) : 0
  const ohlcChangePct = displayOhlc && displayOhlc.open > 0 ? ((ohlcChange / displayOhlc.open) * 100) : 0
  const digits = symbol.includes('JPY') || symbol.includes('XAU') ? 2 : symbol.startsWith('BTC') || symbol.startsWith('ETH') ? 2 : 5

  return (
    <div ref={wrapperRef} className={`flex flex-col h-full w-full ${C.wrapBg} ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}>

      {/* ── PROFESSIONAL TOOLBAR ── */}
      <div className={`flex items-center gap-1 px-2 py-1 ${C.toolbar} border-b flex-shrink-0 overflow-x-auto`}>

        {/* Timeframes */}
        <div className="flex items-center gap-px mr-1">
          {timeframes.map(tf => (
            <button key={tf.key} onClick={() => setTimeframe(tf.key)}
              className={`px-1.5 py-1 rounded text-[10px] font-semibold transition-all min-w-[28px]
                ${timeframe === tf.key ? 'bg-blue-500/15 text-blue-500 shadow-sm' : C.btn}`}>
              {tf.label}
            </button>
          ))}
        </div>

        <div className={`w-px h-4 ${C.divider} mx-1`} />

        {/* Chart Type Dropdown */}
        <div className="relative">
          <button onClick={() => { setShowChartTypeMenu(!showChartTypeMenu); setShowIndicatorMenu(false); setShowDrawingMenu(false) }}
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] ${C.btn} transition-colors`}>
            <ChartIcon type={chartType} size={13} />
            <span className="hidden sm:inline">{chartTypeLabel[chartType]}</span>
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {showChartTypeMenu && (
            <div className={`absolute top-full left-0 mt-1 w-[130px] ${C.dropdown} border rounded-lg shadow-xl z-50 py-1`}>
              {[
                { key: 'candle', label: 'Candlestick', icon: 'candle' },
                { key: 'bars', label: 'OHLC Bars', icon: 'bars' },
                { key: 'line', label: 'Line', icon: 'line' },
                { key: 'area', label: 'Area', icon: 'area' },
              ].map(ct => (
                <button key={ct.key} onClick={() => { setChartType(ct.key); setShowChartTypeMenu(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors
                    ${chartType === ct.key ? 'text-blue-400' : C.item}`}>
                  <ChartIcon type={ct.icon} size={13} /> {ct.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`w-px h-4 ${C.divider} mx-0.5`} />

        {/* Indicators Dropdown */}
        <div className="relative">
          <button onClick={() => { setShowIndicatorMenu(!showIndicatorMenu); setShowChartTypeMenu(false); setShowDrawingMenu(false) }}
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors
              ${activeIndicators.some(i => i.enabled) ? 'text-blue-400 bg-blue-500/10' : C.btn}`}>
            <ChartIcon type="indicator" size={13} />
            <span className="hidden sm:inline">Indicators</span>
            {activeIndicators.filter(i => i.enabled).length > 0 && (
              <span className="px-1 py-px rounded-full bg-blue-100 text-[8px] text-blue-600 font-bold">{activeIndicators.filter(i => i.enabled).length}</span>
            )}
          </button>
          {showIndicatorMenu && (
            <div className={`absolute top-full left-0 mt-1 w-[200px] ${C.dropdown} border rounded-lg shadow-xl z-50 py-1`}>
              <div className={`px-3 py-1.5 text-[9px] ${C.sectionHdr} uppercase font-semibold border-b`}>Moving Averages</div>
              {activeIndicators.filter(i => i.type === 'SMA' || i.type === 'EMA').map(ind => (
                <button key={ind.id} onClick={() => toggleIndicator(ind.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] ${C.item} transition-colors`}>
                  <div className={`w-3 h-3 rounded border ${ind.enabled ? 'bg-blue-500 border-blue-500' : C.checkbox} flex items-center justify-center`}>
                    {ind.enabled && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1,4 L3,6 L7,2" fill="none" stroke="white" strokeWidth="1.5"/></svg>}
                  </div>
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: ind.color }} />
                  <span>{ind.type} ({ind.period})</span>
                </button>
              ))}
              <div className={`px-3 py-1.5 text-[9px] ${C.sectionHdr} uppercase font-semibold border-b border-t mt-1`}>Overlays</div>
              {activeIndicators.filter(i => i.type === 'BB' || i.type === 'VWAP').map(ind => (
                <button key={ind.id} onClick={() => toggleIndicator(ind.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] ${C.item} transition-colors`}>
                  <div className={`w-3 h-3 rounded border ${ind.enabled ? 'bg-blue-500 border-blue-500' : C.checkbox} flex items-center justify-center`}>
                    {ind.enabled && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1,4 L3,6 L7,2" fill="none" stroke="white" strokeWidth="1.5"/></svg>}
                  </div>
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: ind.color }} />
                  <span>{ind.type === 'BB' ? `Bollinger (${ind.period})` : 'VWAP'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`w-px h-4 ${C.divider} mx-0.5`} />

        {/* Drawing Tools */}
        <div className="relative">
          <button onClick={() => { setShowDrawingMenu(!showDrawingMenu); setShowChartTypeMenu(false); setShowIndicatorMenu(false) }}
            className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors
              ${activeTool ? 'text-yellow-400 bg-yellow-500/10' : C.btn}`}>
            <ChartIcon type="crosshair" size={13} />
            <span className="hidden sm:inline">Draw</span>
          </button>
          {showDrawingMenu && (
            <div className={`absolute top-full left-0 mt-1 w-[160px] ${C.dropdown} border rounded-lg shadow-xl z-50 py-1`}>
              {[
                { key: 'hline', label: 'Horizontal Line', icon: 'hline' },
                { key: 'crosshair', label: 'Crosshair', icon: 'crosshair' },
              ].map(tool => (
                <button key={tool.key} onClick={() => { setActiveTool(activeTool === tool.key ? null : tool.key); setShowDrawingMenu(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors
                    ${activeTool === tool.key ? 'text-yellow-400' : C.item}`}>
                  <ChartIcon type={tool.icon} size={13} /> {tool.label}
                </button>
              ))}
              <div className={`border-t ${isDark ? 'border-[#1e2d45]' : 'border-gray-200'} mt-1 pt-1`}>
                <button onClick={() => { clearDrawings(); setShowDrawingMenu(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 ${C.clearHover} transition-colors`}>
                  <ChartIcon type="undo" size={13} /> Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTool && (
          <span className="text-[9px] text-yellow-400/70 bg-yellow-500/10 px-1.5 py-0.5 rounded animate-pulse">
            Click chart to place {activeTool === 'hline' ? 'line' : activeTool}
          </span>
        )}

        <div className="flex-1" />

        {/* Right side tools */}
        <div className="flex items-center gap-0.5">
          {/* One-Click Trading toggle */}
          {onQuickTrade && (
            <button onClick={() => setShowOneClickTrading(!showOneClickTrading)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors
                ${showOneClickTrading ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : C.btn}`}>
              <ChartIcon type="trade" size={13} />
              <span className="hidden sm:inline">Trade</span>
            </button>
          )}

          <div className={`w-px h-4 ${C.divider} mx-0.5 hidden sm:block`} />

          <button onClick={takeScreenshot} className={`p-1 rounded ${C.btn} transition-colors`} title="Screenshot">
            <ChartIcon type="screenshot" size={13} />
          </button>

          <button onClick={toggleFullscreen} className={`p-1 rounded ${C.btn} transition-colors`} title="Fullscreen">
            <ChartIcon type="fullscreen" size={13} />
          </button>

          {loading && <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin ml-1" />}
        </div>
      </div>

      {/* ── OHLC INFO BAR ── */}
      <div className={`flex items-center gap-3 px-2 py-0.5 ${C.ohlcBar} border-b flex-shrink-0 min-h-[22px] overflow-x-auto`}>
        <span className={`text-[10px] font-semibold ${C.ohlcSym}`}>{symbol}</span>
        {displayOhlc && (
          <>
            <span className={`text-[10px] ${C.ohlcLabel}`}>O <span className={`${C.ohlcVal} font-mono`}>{Number(displayOhlc.open).toFixed(digits)}</span></span>
            <span className={`text-[10px] ${C.ohlcLabel}`}>H <span className="text-emerald-500 font-mono">{Number(displayOhlc.high).toFixed(digits)}</span></span>
            <span className={`text-[10px] ${C.ohlcLabel}`}>L <span className="text-red-500 font-mono">{Number(displayOhlc.low).toFixed(digits)}</span></span>
            <span className={`text-[10px] ${C.ohlcLabel}`}>C <span className={`${C.ohlcVal} font-mono`}>{Number(displayOhlc.close).toFixed(digits)}</span></span>
            <span className={`text-[10px] font-mono font-semibold ${ohlcChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {ohlcChange >= 0 ? '+' : ''}{ohlcChange.toFixed(digits)} ({ohlcChangePct >= 0 ? '+' : ''}{ohlcChangePct.toFixed(2)}%)
            </span>
            {/* Show active indicator labels */}
            {activeIndicators.filter(i => i.enabled).map(ind => (
              <span key={ind.id} className="text-[9px] font-medium px-1 py-px rounded" style={{ color: ind.color, backgroundColor: ind.color + '15' }}>
                {ind.type}{ind.period > 0 ? `(${ind.period})` : ''}
              </span>
            ))}
          </>
        )}
      </div>

      {/* ── CHART CONTAINER with ONE-CLICK TRADING OVERLAY ── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="w-full h-full" />

        {/* StockVala brand watermark — logo + name, bottom-left */}
        <div className="absolute bottom-6 left-3 z-10 pointer-events-none flex items-center gap-1.5"
             style={{ opacity: 0.65 }}>
          <StockValaLogo size={20} />
          <span className="text-[12px] font-bold tracking-wide select-none">
            <span style={{ color: '#00D4F5' }}>Stock</span><span style={{ color: '#7C3AED' }}>Vala</span>
          </span>
        </div>

        {/* No data overlay — shown while history is accumulating from live ticks */}
        {chartUnavailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f1724]/80 z-10 pointer-events-none">
            <div className="text-slate-400 text-4xl mb-3">📊</div>
            <p className="text-slate-300 font-medium">Building chart history for {symbol}</p>
            <p className="text-slate-500 text-sm mt-1">Live ticks are being collected — chart will appear shortly</p>
            <p className="text-slate-600 text-xs mt-2">M1 candles in ~1 min · M15 in ~15 min · H1 in ~1 hour</p>
          </div>
        )}

        {/* One-Click Trading Panel */}
        {showOneClickTrading && onQuickTrade && (
          <div className={`absolute top-3 left-3 z-20 flex items-stretch ${C.oneClick} backdrop-blur-sm border rounded-lg overflow-hidden shadow-xl shadow-black/15`}>
            <button onClick={() => onQuickTrade('sell')}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white transition-colors min-w-[80px]">
              <div className="text-[8px] uppercase tracking-wider opacity-80">Sell</div>
              <div className="text-[14px] font-bold font-mono">{lastCandle ? Number(lastCandle.close).toFixed(Math.min(digits, 3)) : '—'}</div>
            </button>
            <div className={`flex flex-col items-center justify-center px-2 ${C.oneClickMid} min-w-[50px]`}>
              <div className={`text-[8px] ${C.oneClickMeta} uppercase`}>Lots</div>
              <div className={`text-[13px] ${C.oneClickAmt} font-bold font-mono`}>0.01</div>
            </div>
            <button onClick={() => onQuickTrade('buy')}
              className="px-4 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white transition-colors min-w-[80px]">
              <div className="text-[8px] uppercase tracking-wider opacity-80">Buy</div>
              <div className="text-[14px] font-bold font-mono">{lastCandle ? Number(lastCandle.close).toFixed(Math.min(digits, 3)) : '—'}</div>
            </button>
          </div>
        )}
      </div>

      {/* Close any open dropdowns when clicking chart area */}
      {(showChartTypeMenu || showIndicatorMenu || showDrawingMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowChartTypeMenu(false); setShowIndicatorMenu(false); setShowDrawingMenu(false) }} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Default Watchlist — curated popular symbols
   Only these load initially. Users search to add more.
   ═══════════════════════════════════════════════════ */
/* ── Market-specific symbol sets ── */
const FOREX_WATCHLIST = [
  { name: 'EURUSD', description: 'Euro vs US Dollar', digits: 5, market: 'forex' },
  { name: 'GBPUSD', description: 'British Pound vs US Dollar', digits: 5, market: 'forex' },
  { name: 'USDJPY', description: 'US Dollar vs Japanese Yen', digits: 3, market: 'forex' },
  { name: 'AUDUSD', description: 'Australian Dollar vs US Dollar', digits: 5, market: 'forex' },
  { name: 'USDCAD', description: 'US Dollar vs Canadian Dollar', digits: 5, market: 'forex' },
  { name: 'NZDUSD', description: 'New Zealand Dollar vs US Dollar', digits: 5, market: 'forex' },
  { name: 'USDCHF', description: 'US Dollar vs Swiss Franc', digits: 5, market: 'forex' },
  { name: 'EURGBP', description: 'Euro vs British Pound', digits: 5, market: 'forex' },
  { name: 'EURJPY', description: 'Euro vs Japanese Yen', digits: 3, market: 'forex' },
  { name: 'GBPJPY', description: 'Pound vs Japanese Yen', digits: 3, market: 'forex' },
  { name: 'XAUUSD', description: 'Gold vs US Dollar', digits: 2, market: 'forex' },
  { name: 'XAGUSD', description: 'Silver vs US Dollar', digits: 3, market: 'forex' },
  { name: 'BTCUSD', description: 'Bitcoin vs US Dollar', digits: 2, market: 'forex' },
  { name: 'ETHUSD', description: 'Ethereum vs US Dollar', digits: 2, market: 'forex' },
  { name: 'US500', description: 'S&P 500 Index', digits: 2, market: 'forex' },
  { name: 'US30', description: 'Dow Jones 30', digits: 2, market: 'forex' },
  { name: 'USTEC', description: 'Nasdaq 100', digits: 2, market: 'forex' },
  { name: 'USOIL', description: 'Crude Oil WTI', digits: 2, market: 'forex' },
  { name: 'GER40', description: 'German DAX 40', digits: 2, market: 'forex' },
  { name: 'UK100', description: 'UK FTSE 100', digits: 2, market: 'forex' },
]

const MCX_WATCHLIST = [
  { name: 'CRUDEOIL', description: 'Crude Oil MCX', digits: 2, market: 'mcx' },
  { name: 'GOLD', description: 'Gold MCX', digits: 2, market: 'mcx' },
  { name: 'GOLDM', description: 'Gold Mini MCX', digits: 2, market: 'mcx' },
  { name: 'SILVER', description: 'Silver MCX', digits: 2, market: 'mcx' },
  { name: 'SILVERM', description: 'Silver Mini MCX', digits: 2, market: 'mcx' },
  { name: 'NATURALGAS', description: 'Natural Gas MCX', digits: 2, market: 'mcx' },
  { name: 'COPPER', description: 'Copper MCX', digits: 2, market: 'mcx' },
  { name: 'ZINC', description: 'Zinc MCX', digits: 2, market: 'mcx' },
  { name: 'ALUMINIUM', description: 'Aluminium MCX', digits: 2, market: 'mcx' },
  { name: 'LEAD', description: 'Lead MCX', digits: 2, market: 'mcx' },
  { name: 'NICKEL', description: 'Nickel MCX', digits: 2, market: 'mcx' },
  { name: 'COTTONCANDY', description: 'Cotton MCX', digits: 2, market: 'mcx' },
]

const NSE_WATCHLIST = [
  { name: 'NIFTY50', description: 'Nifty 50 Index', digits: 2, market: 'nse' },
  { name: 'BANKNIFTY', description: 'Bank Nifty Index', digits: 2, market: 'nse' },
  { name: 'FINNIFTY', description: 'Fin Nifty Index', digits: 2, market: 'nse' },
  { name: 'RELIANCE', description: 'Reliance Industries', digits: 2, market: 'nse' },
  { name: 'TCS', description: 'Tata Consultancy', digits: 2, market: 'nse' },
  { name: 'HDFCBANK', description: 'HDFC Bank', digits: 2, market: 'nse' },
  { name: 'INFY', description: 'Infosys', digits: 2, market: 'nse' },
  { name: 'ICICIBANK', description: 'ICICI Bank', digits: 2, market: 'nse' },
  { name: 'SBIN', description: 'State Bank of India', digits: 2, market: 'nse' },
  { name: 'BHARTIARTL', description: 'Bharti Airtel', digits: 2, market: 'nse' },
  { name: 'ITC', description: 'ITC Limited', digits: 2, market: 'nse' },
  { name: 'TATAMOTORS', description: 'Tata Motors', digits: 2, market: 'nse' },
  { name: 'WIPRO', description: 'Wipro', digits: 2, market: 'nse' },
  { name: 'ADANIENT', description: 'Adani Enterprises', digits: 2, market: 'nse' },
  { name: 'TATASTEEL', description: 'Tata Steel', digits: 2, market: 'nse' },
]

const ALL_DEFAULT_WATCHLISTS = { forex: FOREX_WATCHLIST, mcx: MCX_WATCHLIST, nse: NSE_WATCHLIST }

/** Returns the default watchlist for a given account market type */
const getDefaultWatchlist = (market) => ALL_DEFAULT_WATCHLISTS[market] || FOREX_WATCHLIST

/** Detect account market type from account object */
const getAccountMarket = (acc) => {
  if (!acc) return 'forex'
  const m = (acc.market || acc.accountType || '').toLowerCase()
  if (m.includes('mcx')) return 'mcx'
  if (m.includes('nse')) return 'nse'
  return 'forex'
}

/* ═══════════════════════════════════════════════════
   Price formatting helpers
   ═══════════════════════════════════════════════════ */

/**
 * Return decimal places for a symbol.
 * Forex: 5 | JPY pairs: 3 | Crypto / Metals / Indices: 2
 */
const getSymbolDigits = (symbol) => {
  const s = (symbol || '').replace(/\.\#.*$/, '').toUpperCase()
  if (/JPY/.test(s)) return 3
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return 2
  if (/^(BTC|ETH|LTC|XRP|SOL|ADA|DOGE|BNB|AVAX|MATIC|LINK)/.test(s)) return 2
  if (/^(US30|US500|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX|USTEC)/.test(s)) return 2
  if (/^(USOIL|UKOIL|XBR|XTI|NGAS|BRENT|WTI)/.test(s)) return 2
  return 5
}

/** Format a price with correct decimal places for the symbol. */
const fmtPrice = (price, symbol) => {
  const n = Number(price)
  if (!n || isNaN(n)) return '—'
  return n.toFixed(getSymbolDigits(symbol))
}

/**
 * Check whether a given market segment is currently open.
 * All hours are in IST (UTC+5:30).
 *   MCX  : Mon–Fri 09:00–23:30, Sat 09:00–14:00
 *   NSE  : Mon–Fri 09:15–15:30
 *   Forex: Mon 00:00 – Fri 23:59 (24×5 with weekend gap)
 */
const isMarketOpen = (market) => {
  // Convert current UTC time to IST (UTC+5:30)
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffset)
  const day  = ist.getUTCDay()   // 0=Sun, 1=Mon … 6=Sat
  const h    = ist.getUTCHours()
  const m    = ist.getUTCMinutes()
  const mins = h * 60 + m        // minutes since midnight IST

  const mk = (market || 'forex').toLowerCase()

  if (mk === 'forex') {
    // Closed Sat after 22:00 IST and all day Sun
    if (day === 0) return false
    if (day === 6 && mins >= 22 * 60) return false
    return true
  }
  if (mk === 'mcx' || mk === 'commodity') {
    if (day === 0) return false                          // Sunday closed
    if (day === 6) return mins >= 9 * 60 && mins < 14 * 60  // Sat 09:00–14:00
    return mins >= 9 * 60 && mins < 23 * 60 + 30        // Mon–Fri 09:00–23:30
  }
  if (mk === 'nse' || mk === 'equity') {
    if (day === 0 || day === 6) return false             // Weekend closed
    return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30  // Mon–Fri 09:15–15:30
  }
  return true
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
const floatingPnl = (acc) => {
  if (!acc) return 0
  return (Number(acc.equity) || 0) - (Number(acc.balance) || 0)
}

const categorize = (sym) => {
  const n = (sym.name || '').toUpperCase()
  const p = (sym.path || sym.description || '').toLowerCase()
  const m = (sym.market || '').toLowerCase()
  if (m === 'mcx') return 'MCX'
  if (m === 'nse') return 'NSE'
  if (p.includes('mcx') || /^CRUDEOIL|^GOLDM?$|^SILVERM?$|^NATURALGAS|^COPPER|^ZINC|^ALUMINIUM|^LEAD|^NICKEL|^COTTON/.test(n)) return 'MCX'
  if (p.includes('nse') || /^NIFTY|^BANKNIFTY|^FINNIFTY|^RELIANCE|^TCS|^HDFCBANK|^INFY|^ICICIBANK|^SBIN|^BHARTIARTL|^ITC$|^TATAMOTORS|^WIPRO|^ADANIENT|^TATASTEEL/.test(n)) return 'NSE'
  if (/^XAU|^XAG|^XPT|^XPD/.test(n) || p.includes('gold') || p.includes('silver') || p.includes('metal')) return 'Metals'
  if (/^BTC|^ETH|^LTC|^XRP|^DOGE|^SOL|^ADA/.test(n) || p.includes('crypto')) return 'Crypto'
  if (/US500|US30|USTEC|NAS100|UK100|GER40|JPN225|AUS200|SPX|DJI|DAX|FTSE/.test(n) || p.includes('index') || p.includes('indice')) return 'Indices'
  if (/USOIL|UKOIL|XBR|XTI|NGAS|BRENT|WTI/.test(n) || p.includes('oil') || p.includes('energy')) return 'Energy'
  return 'Forex'
}

/* ═══════════════════════════════════════════════════
   Module-level price cache — survives route changes.
   Prices written here are used to seed component state
   on mount so the watchlist never shows "—" on re-visit.
   ═══════════════════════════════════════════════════ */
const _priceCache = {}   // { EURUSD: { bid, ask }, ... }

/* ═══════════════════════════════════════════════════
   MAIN TRADE PAGE
   ═══════════════════════════════════════════════════ */
const TradePage = () => {
  const { isDark } = useThemeStore()
  const { accounts, selectedAccountId, selectAccount, fetchAccounts } = useAccountStore()
  const {
    positions, orders, tradeHistory,
    fetchPositions, fetchOrders, fetchTradeHistory,
    placeOrder, closeTrade, isLoading, positionsLoading
  } = useTradeStore()

  // ── Theme-aware colour tokens ─────────────────────────────────────────────
  const D = isDark ? {
    pageBg:    'bg-[#0f1724]',
    panelBg:   'bg-[#0f1724]',
    barBg:     'bg-[#131c2e]',
    inputBg:   'bg-[#1a2540]',
    border:    'border-[#1e2d45]',
    rowHover:  'hover:bg-white/5',
    text:      'text-white',
    textMuted: 'text-slate-400',
    textDim:   'text-slate-300',
    tableBg:   'bg-[#0f1724]',
  } : {
    pageBg:    'bg-gray-50',
    panelBg:   'bg-white',
    barBg:     'bg-white',
    inputBg:   'bg-gray-100',
    border:    'border-gray-200',
    rowHover:  'hover:bg-gray-50',
    text:      'text-gray-900',
    textMuted: 'text-gray-500',
    textDim:   'text-gray-700',
    tableBg:   'bg-white',
  }

  const accountMarket = useMemo(() => getAccountMarket(
    (accounts || []).find(a => String(a.id) === String(selectedAccountId))
  ), [accounts, selectedAccountId])

  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const def = getDefaultWatchlist('forex')
    return def[0]?.name || 'EURUSD'
  })
  const [watchlist, setWatchlist] = useState(getDefaultWatchlist('forex'))  // curated list shown in panel
  const [allServerSymbols, setAllServerSymbols] = useState([])   // full list loaded lazily for search
  const allServerSymbolsRef = useRef([])   // same list as ref so effects can read without re-running
  const [serverSymbolsLoaded, setServerSymbolsLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [placing, setPlacing] = useState(false)

  // Mobile panels
  const [mobilePanel, setMobilePanel] = useState(null) // 'watchlist' | 'order' | null

  // Order form state
  const [orderType, setOrderType] = useState('buy')
  const [execType, setExecType] = useState('market')
  const [volume, setVolume] = useState('0.01')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [showSlTp, setShowSlTp] = useState(false)
  const [limitPrice, setLimitPrice] = useState('')

  // Live tick prices
  const [tickData, setTickData] = useState({ bid: 0, ask: 0, digits: 5, spread: 0 })

  // Watchlist state
  const [watchSearch, setWatchSearch] = useState('')
  const [watchCategory, setWatchCategory] = useState('All')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sv_wl_fav') || '[]') } catch { return [] }
  })
  const [searchMode, setSearchMode] = useState(false) // true = searching server symbols to add

  // priceBuffer collects socket/REST updates; flushed to state every 100ms (no render storm)
  const priceBufferRef = useRef({})

  // Bottom panel
  const [bottomTab, setBottomTab] = useState('positions')
  const [bottomCollapsed, setBottomCollapsed] = useState(false)

  const selectedAcc = (accounts || []).find(a => String(a.id) === String(selectedAccountId))
  const totalPnlValue = (positions || []).reduce((sum, p) => sum + (p.pnl || 0), 0)

  // P&L flash animation — track previous pnl per position ticket
  const prevPnlRef = useRef({})
  const [flashMap, setFlashMap] = useState({})  // ticket → 'up' | 'down' | null
  useEffect(() => {
    if (!positions || positions.length === 0) return
    const newFlash = {}
    positions.forEach(pos => {
      const prev = prevPnlRef.current[pos.id]
      const cur  = pos.pnl || 0
      if (prev !== undefined && prev !== cur) {
        newFlash[pos.id] = cur > prev ? 'up' : 'down'
      }
      prevPnlRef.current[pos.id] = cur
    })
    if (Object.keys(newFlash).length > 0) {
      setFlashMap(prev => ({ ...prev, ...newFlash }))
      setTimeout(() => setFlashMap({}), 600)
    }
  }, [positions])

  // Symbol resolution map: base name → actual MT5 name (e.g. EURUSD → EURUSD.#)
  const symbolMapRef = useRef({})

  /** Resolve a base symbol name to its actual MT5 name */
  const resolveMt5Symbol = useCallback((baseName) => {
    return symbolMapRef.current[baseName] || symbolMapRef.current[baseName?.toUpperCase()] || baseName
  }, [])

  // ── Data Loading ──
  useEffect(() => {
    fetchAccounts()
    loadTradeData()

    // ── PRIMARY: Build watchlist from the broker's symbolMap ──────────────────
    // symbolMap keys are already base names (EURUSD, BTCUSD, etc.) — no suffix issues.
    // For every symbol the broker has, we look up our curated metadata (description,
    // digits, market) and fall back to auto-generation for unlisted symbols.
    api.get('/trades/symbols/grouped').then((res) => {
      const data = res.data?.data || {}
      const sMap = data.symbolMap || {}
      symbolMapRef.current = sMap

      if (Object.keys(sMap).length === 0) return  // bridge not ready, keep defaults

      // Combine ALL our curated defaults into one metadata lookup
      const allDefaults = [...FOREX_WATCHLIST, ...MCX_WATCHLIST, ...NSE_WATCHLIST]
      const metaMap = {}
      allDefaults.forEach(s => { metaMap[s.name.toUpperCase()] = s })

      // Build one watchlist entry per broker symbol (suffix-free base names)
      const newWatchlist = Object.keys(sMap).map(baseName => {
        const meta = metaMap[baseName.toUpperCase()]
        if (meta) return meta
        // Auto-generate metadata for broker symbols not in our curated lists
        return {
          name: baseName,
          description: baseName,
          digits: getSymbolDigits(baseName),
          market: 'forex',
        }
      })

      // Always supplement with curated MCX + NSE symbols the server doesn't have.
      // This ensures the MCX/NSE watchlist tabs are populated even when the
      // gateway broker only exposes Forex symbols.
      const existingNames = new Set(Object.keys(sMap).map(k => k.toUpperCase()))
      const supplement = [...MCX_WATCHLIST, ...NSE_WATCHLIST].filter(
        s => !existingNames.has(s.name.toUpperCase())
      )
      const merged = [...newWatchlist, ...supplement]
      if (merged.length > 0) setWatchlist(merged)
    }).catch(() => {})

    // ── SECONDARY: Load full tradeable list for the "Add Symbol" search panel ──
    api.get('/trades/symbols').then((res) => {
      const syms = res.data?.data?.symbols || []
      if (syms.length > 0) {
        const tradeable = syms.filter(s => s.trade_mode === undefined || s.trade_mode > 0)
        setAllServerSymbols(tradeable)
        allServerSymbolsRef.current = tradeable
        setServerSymbolsLoaded(true)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedAccountId) loadTradeData()
  }, [selectedAccountId])

  // Switch category + auto-select when the account market type changes (forex ↔ mcx ↔ nse)
  useEffect(() => {
    const sMap = symbolMapRef.current

    if (Object.keys(sMap).length > 0) {
      // Watchlist is already built from the server — just focus the right category tab
      const targetCat = accountMarket === 'mcx' ? 'MCX' : accountMarket === 'nse' ? 'NSE' : 'Forex'
      setWatchCategory(targetCat)

      // Auto-select the first symbol from the matching default list
      const defaultList = getDefaultWatchlist(accountMarket)
      const serverKeys  = new Set(Object.keys(sMap).map(k => k.toUpperCase()))
      const firstMatch  = defaultList.find(s => serverKeys.has(s.name.toUpperCase()))
      if (firstMatch) setSelectedSymbol(firstMatch.name)
    } else {
      // Server not loaded yet — fall back to curated defaults
      const defaultList = getDefaultWatchlist(accountMarket)
      setWatchlist(defaultList)
      // Focus the right category tab for MCX/NSE accounts
      const targetCat = accountMarket === 'mcx' ? 'MCX' : accountMarket === 'nse' ? 'NSE' : 'All'
      setWatchCategory(targetCat)
      if (defaultList.length > 0) setSelectedSymbol(defaultList[0].name)
    }
    try { localStorage.removeItem('sv_watchlist') } catch {}
  }, [accountMarket])

  // Auto-refresh positions for selected account every 15 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      if (selectedAccountId) fetchPositions(selectedAccountId).catch(() => {})
    }, 15000)
    return () => clearInterval(iv)
  }, [selectedAccountId])

  // Track which symbol the current tick data belongs to (prevents stale price display)
  const [tickSymbol, setTickSymbol] = useState('')

  // ── Watchlist prices — live bid/ask for ALL symbols in the watchlist ──────
  // watchlistPrices is seeded from _priceCache on mount so prices are instant on re-visit.
  const [watchlistPrices, setWatchlistPrices] = useState(() => ({ ..._priceCache }))
  const { subscribe: socketSubscribe, emit: socketEmit } = useSocket()

  // ── 100ms price flush — buffer all updates in a ref, commit to state on interval ──
  // This prevents a re-render storm when 20 symbols each tick every ~1s via socket.
  useEffect(() => {
    const flush = setInterval(() => {
      if (Object.keys(priceBufferRef.current).length > 0) {
        const snapshot = priceBufferRef.current
        priceBufferRef.current = {}
        // Write through to module-level cache so the next mount is instant
        Object.assign(_priceCache, snapshot)
        setWatchlistPrices(prev => ({ ...prev, ...snapshot }))
      }
    }, 100)
    return () => clearInterval(flush)
  }, [])

  // Subscribe/unsubscribe to Socket.IO price rooms as the watchlist changes
  useEffect(() => {
    if (!watchlist || watchlist.length === 0) return
    const names = watchlist.map(s => s.name)
    socketEmit('price:subscribe', names)
    return () => { socketEmit('price:unsubscribe', names) }
  }, [watchlist, socketEmit])

  // Receive live price_update from the socket — buffer into ref, NOT direct setState
  useEffect(() => {
    const unsub = socketSubscribe('price_update', (data) => {
      const { symbol, bid, ask } = data || {}
      if (!symbol) return
      const b = parseFloat(bid) || 0
      const a = parseFloat(ask) || 0
      if (b > 0 || a > 0) {
        priceBufferRef.current[symbol] = { bid: b, ask: a }
      }
    })
    return unsub
  }, [socketSubscribe])

  // Batch REST fallback — fires once on mount and whenever watchlist changes.
  // Only fills symbols the socket hasn't pushed yet — avoids redundant updates.
  useEffect(() => {
    if (!watchlist || watchlist.length === 0) return
    let cancelled = false
    const fetchAll = async () => {
      const results = await Promise.allSettled(
        watchlist.map(s => api.get(`/trades/tick/${s.name}`).then(r => ({ name: s.name, ...(r.data?.data || {}) })))
      )
      if (cancelled) return
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          const { name, bid, ask } = r.value
          const b = parseFloat(bid) || 0
          const a = parseFloat(ask) || 0
          if (b > 0 || a > 0) priceBufferRef.current[name] = { bid: b, ask: a }
        }
      })
    }
    fetchAll()
    // Refresh every 5 s as a backstop (socket is the primary source)
    const iv = setInterval(fetchAll, 5000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [watchlist])

  // Fetch live bid/ask for selected symbol (1-second poll for the order panel)
  const fetchTick = async (symbol) => {
    try {
      const res = await api.get(`/trades/tick/${symbol}`)
      const d = res.data?.data || {}
      const bid = parseFloat(d.bid) || 0
      const ask = parseFloat(d.ask) || 0
      if (bid > 0 || ask > 0) {
        setTickData({ bid, ask, digits: d.digits || 5, spread: d.spread || 0 })
        setTickSymbol(symbol)
        // Cache the resolved MT5 name for chart/trade use
        if (d.resolvedSymbol && d.resolvedSymbol !== symbol) {
          symbolMapRef.current[symbol] = d.resolvedSymbol
        }
      }
    } catch (_) {}
  }

  // Mirror watchlistPrices into tickData when the selected symbol's price arrives via socket
  useEffect(() => {
    const p = watchlistPrices[selectedSymbol]
    if (p && (p.bid > 0 || p.ask > 0)) {
      setTickData(prev => ({ ...prev, bid: p.bid, ask: p.ask }))
      setTickSymbol(selectedSymbol)
    }
  }, [watchlistPrices, selectedSymbol])

  // Track whether symbol has no price data after waiting long enough
  const [tickUnavailable, setTickUnavailable] = useState(false)

  useEffect(() => {
    // When symbol changes, seed from cache/watchlistPrices first so price never blanks
    const cached = _priceCache[selectedSymbol] || watchlistPrices[selectedSymbol]
    if (cached && cached.bid > 0) {
      setTickData(prev => ({ ...prev, bid: cached.bid, ask: cached.ask || cached.bid }))
      setTickSymbol(selectedSymbol)
    } else {
      setTickData({ bid: 0, ask: 0, digits: 5, spread: 0 })
      setTickSymbol('')
    }
    setTickUnavailable(false)

    if (!selectedSymbol) return

    fetchTick(selectedSymbol)
    // Poll every 3s (reduced from 1s — socket provides 1s updates already)
    const iv = setInterval(() => { if (selectedSymbol) fetchTick(selectedSymbol) }, 3000)

    // After 5s with no prices, mark as unavailable so UI stops saying "Loading"
    const unavailTimer = setTimeout(() => {
      setTickUnavailable(prev => {
        const hasCachedNow = (_priceCache[selectedSymbol]?.bid || 0) > 0
        return hasCachedNow ? false : true
      })
    }, 5000)

    return () => { clearInterval(iv); clearTimeout(unavailTimer) }
  }, [selectedSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load server symbols for the "Add Symbol" search panel.
  // No-op if already loaded by the startup effect.
  const loadServerSymbols = async () => {
    if (serverSymbolsLoaded) return
    try {
      const res = await api.get('/trades/symbols')
      const syms = res.data?.data?.symbols || []
      if (syms.length > 0) {
        const tradeable = syms.filter(s => s.trade_mode === undefined || s.trade_mode > 0)
        setAllServerSymbols(tradeable)
        allServerSymbolsRef.current = tradeable
        setServerSymbolsLoaded(true)
      } else {
        setServerSymbolsLoaded(true)
      }
    } catch {
      setServerSymbolsLoaded(true)
    }
  }

  const addToWatchlist = (sym) => {
    setWatchlist(prev => {
      if (prev.find(s => s.name === sym.name)) return prev
      const next = [...prev, sym]
      try { localStorage.setItem('sv_watchlist', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const removeFromWatchlist = (symName) => {
    setWatchlist(prev => {
      const next = prev.filter(s => s.name !== symName)
      try { localStorage.setItem('sv_watchlist', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const loadTradeData = async () => {
    setRefreshing(true)
    // Fetch positions filtered by selected account (account isolation)
    await fetchPositions(selectedAccountId).catch(() => {})
    setRefreshing(false)
  }

  // Load orders/history only when user clicks that tab — filtered by selected account
  useEffect(() => {
    if (bottomTab === 'orders') fetchOrders(selectedAccountId).catch(() => {})
    if (bottomTab === 'history') fetchTradeHistory(1, 50, selectedAccountId).catch(() => {})
  }, [bottomTab, selectedAccountId])

  // ── Trade Actions ──
  const handlePlaceOrder = async (overrideType) => {
    // Only accept string overrides — ignore React SyntheticEvent from onClick
    const tradeType = (typeof overrideType === 'string') ? overrideType : orderType
    if (!selectedAccountId) return toast.error('Select an MT5 account first')

    // *** CRITICAL: Prevent trade if tick data doesn't match selected symbol ***
    if (tickSymbol !== selectedSymbol || tickData.bid <= 0) {
      return toast.error('Price data not ready. Wait for live prices to load.')
    }

    // Frontend balance check
    if (selectedAcc && parseFloat(selectedAcc.balance || 0) <= 0) {
      return toast.error('Insufficient balance. Please deposit funds before trading.')
    }

    setPlacing(true)
    try {
      await placeOrder({
        mt5AccountId: Number(selectedAccountId),
        symbol: resolveMt5Symbol(selectedSymbol),
        type: tradeType,
        volume: parseFloat(volume) || 0.01,
        sl: sl ? parseFloat(sl) : 0,
        tp: tp ? parseFloat(tp) : 0,
      })
      toast.success(`${tradeType.toUpperCase()} ${volume} ${selectedSymbol} executed!`)
      setTimeout(() => {
        fetchPositions(selectedAccountId)
        fetchAccounts()
      }, 1000)
      setMobilePanel(null)
    } catch (err) {
      toast.error(err?.message || 'Trade failed')
    } finally {
      setPlacing(false)
    }
  }

  const handleClosePosition = async (pos) => {
    try {
      const mt5Login = pos.mt5Login || selectedAcc?.login
      const closeId = pos.tradeId || pos.id  // prefer DB tradeId, fall back to ticket
      await closeTrade(closeId, { mt5Login, ticket: pos.id, mt5AccountId: pos.accountId || (selectedAccountId ? Number(selectedAccountId) : undefined) })
      toast.success(`Closed ${pos.symbol}`)
      setTimeout(() => {
        fetchPositions(selectedAccountId)
        fetchAccounts()  // Refresh live balance after close
      }, 500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close')
    }
  }

  // ── Watchlist filtering ──
  const toggleFav = (name) => {
    setFavorites(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      try { localStorage.setItem('sv_wl_fav', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Search results from server symbols (when user is searching to add)
  // Show all symbols when search is empty, filter from 1 char
  const searchResults = useMemo(() => {
    if (!searchMode) return []
    const q = (watchSearch || '').toLowerCase()
    const watchlistNames = new Set(watchlist.map(s => s.name))
    return allServerSymbols
      .filter(s => !watchlistNames.has(s.name) && (!q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)))
      .slice(0, 50)
  }, [searchMode, watchSearch, allServerSymbols, watchlist])

  const filteredSymbols = useMemo(() => {
    return watchlist.filter(s => {
      const q = (watchSearch || '').toLowerCase()
      const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
      const matchCat = watchCategory === 'All' || categorize(s) === watchCategory
      return matchSearch && matchCat
    })
  }, [watchlist, watchSearch, watchCategory])

  const adjustVolume = (d) => {
    const c = parseFloat(volume) || 0.01
    const step = c < 0.1 ? 0.01 : c < 1 ? 0.1 : 1
    setVolume(String(Math.max(0.01, +(c + d * step).toFixed(2))))
  }

  const selectSymbol = (name) => {
    setSelectedSymbol(name)
    setMobilePanel(null)
  }

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */
  return (
    <div className={`flex flex-col h-full ${D.pageBg} ${D.text} overflow-hidden`}>

      {/* ── TOP BAR ── */}
      <div className={`flex items-center justify-between px-3 py-1.5 ${D.barBg} border-b ${D.border} flex-shrink-0 gap-2 min-h-[40px]`}>
        {/* Left: mobile menu + account selector */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile watchlist toggle */}
          <button onClick={() => setMobilePanel(mobilePanel === 'watchlist' ? null : 'watchlist')} className="lg:hidden p-1.5 rounded hover:bg-[#1e2d45]">
            <Menu className="h-4 w-4 text-slate-400" />
          </button>
          {(accounts || []).length > 0 ? (
            <select
              value={selectedAccountId || ''}
              onChange={(e) => selectAccount(e.target.value)}
              className={`px-2 py-1 rounded ${D.inputBg} border ${D.border} ${D.text} text-[11px] font-medium focus:outline-none truncate max-w-[200px] sm:max-w-[280px]`}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>MT5 #{a.login} — {(a.type || 'live').toUpperCase()} [{(a.market || 'forex').toUpperCase()}] — Bal: ${parseFloat(a.balance || 0).toFixed(2)} | Eq: ${parseFloat(a.equity || a.balance || 0).toFixed(2)}</option>
              ))}
            </select>
          ) : <span className="text-[11px] text-gray-400">No accounts</span>}
        </div>

        {/* Right: P&L + refresh + mobile order btn */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`hidden lg:flex items-center gap-1.5 text-[14px] font-bold font-mono ${totalPnlValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnlValue >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            P&amp;L:&nbsp;{totalPnlValue >= 0 ? '+' : ''}${totalPnlValue.toFixed(2)}
          </div>
          <button onClick={loadTradeData} disabled={refreshing} className="p-1.5 rounded hover:bg-[#1e2d45]">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {/* Mobile order toggle */}
          <button onClick={() => setMobilePanel(mobilePanel === 'order' ? null : 'order')} className="lg:hidden p-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30">
            <ShoppingCart className="h-4 w-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* ── MOBILE ACCOUNT INFO BAR ── */}
      <div className={`lg:hidden flex items-center justify-between px-3 py-1.5 ${D.panelBg} border-b ${D.border} flex-shrink-0 overflow-x-auto gap-3`}>
        <div className="flex items-center gap-3 text-[11px] font-mono whitespace-nowrap">
          <span className={D.textMuted}>Bal: <span className={`${D.text} font-semibold`}>${selectedAcc ? Number(selectedAcc.balance || 0).toFixed(2) : '—'}</span></span>
          <span className={D.textMuted}>Eq: <span className={`${D.text} font-semibold`}>${selectedAcc ? Number(selectedAcc.equity || selectedAcc.balance || 0).toFixed(2) : '—'}</span></span>
          <span className={D.textMuted}>Free: <span className={`${D.textDim} font-medium`}>${selectedAcc ? Number(selectedAcc.freeMargin || 0).toFixed(2) : '—'}</span></span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono whitespace-nowrap">
          <span className={D.textMuted}>Lev: <span className={D.textDim}>1:{selectedAcc?.leverage || 100}</span></span>
          <span className={`text-[13px] font-bold ${totalPnlValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            P&amp;L: {totalPnlValue >= 0 ? '+' : ''}${totalPnlValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── WATCHLIST (desktop: always visible, mobile: overlay) ── */}
        <div className={`
          ${mobilePanel === 'watchlist' ? 'absolute inset-0 z-40' : 'hidden'}
          lg:relative lg:flex lg:z-auto
          w-full lg:w-[220px] xl:w-[240px] flex-shrink-0
        `}>
          <div className={`flex flex-col h-full w-full ${D.panelBg} border-r ${D.border}`}>
            {/* Mobile close */}
            <div className="lg:hidden flex items-center justify-between px-3 py-2 border-b border-[#1e2d45]">
              <span className="text-sm font-semibold text-slate-200">Watchlist</span>
              <button onClick={() => setMobilePanel(null)} className="p-1 rounded hover:bg-[#1e2d45]"><X className="h-4 w-4 text-slate-400" /></button>
            </div>

            {/* Search + Add toggle */}
            <div className="px-2 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <input
                  type="text" value={watchSearch}
                  onChange={(e) => { setWatchSearch(e.target.value); if (searchMode) loadServerSymbols() }}
                  onBlur={() => { setTimeout(() => { if (!watchSearch) setSearchMode(false) }, 200) }}
                  placeholder={searchMode ? "Search all symbols to add..." : "Filter watchlist..."}
                  className={`w-full pl-7 pr-7 py-1.5 rounded ${D.inputBg} border ${D.border} text-[11px] ${D.text} placeholder-slate-500 focus:outline-none focus:border-blue-500/50`}
                />
                {searchMode && (
                  <button onClick={() => { setSearchMode(false); setWatchSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-gray-400 hover:text-gray-700" />
                  </button>
                )}
              </div>
              {!searchMode && (
                <button onClick={() => { setSearchMode(true); loadServerSymbols() }}
                  className="mt-1 w-full flex items-center justify-center gap-1 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-medium transition-colors">
                  <Plus className="h-3 w-3" /> Add Symbol
                </button>
              )}
            </div>

            {/* Search results (add to watchlist mode) */}
            {searchMode && (
              <div className={`border-b ${D.border}`}>
                <div className={`px-2 py-1 text-[9px] text-blue-400 font-medium uppercase bg-blue-500/5`}>
                  {!serverSymbolsLoaded ? 'Loading symbols...' : searchResults.length > 0 ? `${searchResults.length} symbols — tap to add` : 'No matches'}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {searchResults.map(sym => {
                    // Try to get a cached live price for this symbol from watchlist ticks
                    const liveKey = sym.name
                    return (
                      <button key={sym.name} onClick={() => { addToWatchlist(sym); toast.success(`${sym.name} added`) }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] border-b ${D.border} hover:bg-blue-500/10 transition-colors`}>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1">
                            <span className={`font-semibold ${D.text}`}>{sym.name}</span>
                            <span className={`text-[9px] ${D.textMuted}`}>{(sym.description || '').substring(0, 22)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono text-emerald-400">
                            {sym.name === selectedSymbol && tickData.ask > 0 ? fmtPrice(tickData.ask, sym.name) : ''}
                          </span>
                          <Plus className="h-3 w-3 text-blue-400" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Categories */}
            {!searchMode && (
              <div className={`flex px-1 gap-0 border-b ${D.border} overflow-x-auto`}>
                {(accountMarket === 'mcx' ? ['All', 'MCX', 'NSE'] : accountMarket === 'nse' ? ['All', 'NSE', 'MCX'] : ['All', 'Forex', 'Metals', 'Crypto', 'Indices', 'Energy']).map(c => (
                  <button key={c} onClick={() => setWatchCategory(c)}
                    className={`px-2 py-1.5 text-[10px] font-medium whitespace-nowrap ${watchCategory === c ? 'text-blue-400 border-b-2 border-blue-400' : `${D.textMuted} ${isDark ? 'hover:text-slate-100' : 'hover:text-gray-700'}`}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Header */}
            <div className={`grid grid-cols-[1fr_auto_20px] px-2 py-1 text-[9px] font-medium ${D.textMuted} uppercase border-b ${D.border}`}>
              <span>Symbol</span><span className="text-right pr-2">Price</span><span></span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredSymbols.map(sym => {
                const isSelected = selectedSymbol === sym.name
                // Use watchlistPrices for all symbols; fall back to tickData for selected
                const priceEntry = watchlistPrices[sym.name]
                const liveAsk = priceEntry?.ask || (isSelected && tickData.ask > 0 ? tickData.ask : 0)
                const liveBid = priceEntry?.bid || (isSelected && tickData.bid > 0 ? tickData.bid : 0)
                const livePrice = liveAsk || liveBid || null
                return (
                  <div key={sym.name} role="button" tabIndex={0} onClick={() => selectSymbol(sym.name)}
                    onKeyDown={(e) => e.key === 'Enter' && selectSymbol(sym.name)}
                    className={`w-full grid grid-cols-[1fr_auto_20px] items-center px-2 py-1.5 text-[11px] border-b ${D.border} transition-colors group cursor-pointer
                      ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : `${D.rowHover} border-l-2 border-l-transparent`}`}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggleFav(sym.name) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleFav(sym.name) } }}
                        className="flex-shrink-0 cursor-pointer">
                        <Star className={`h-2.5 w-2.5 ${favorites.includes(sym.name) ? 'fill-yellow-400 text-yellow-400' : `${D.textMuted} group-hover:text-slate-300`}`} />
                      </span>
                      <div className="min-w-0">
                        <div className={`font-semibold ${D.text} truncate text-[11px]`}>{sym.name}</div>
                        <div className={`text-[9px] ${D.textMuted} truncate`}>{(sym.description || '').substring(0, 18)}</div>
                      </div>
                    </div>
                    <div className="text-right pr-1 font-mono text-[11px] font-semibold min-w-[70px]">
                      {livePrice
                        ? <span className="text-emerald-400">{fmtPrice(livePrice, sym.name)}</span>
                        : !isMarketOpen(sym.market || categorize(sym).toLowerCase())
                          ? <span className="text-[8px] text-amber-500/70 font-normal">Closed</span>
                          : <span className={`text-[9px] ${D.textMuted}`}>—</span>}
                    </div>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeFromWatchlist(sym.name) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeFromWatchlist(sym.name) } }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-pointer">
                      <X className={`h-2.5 w-2.5 ${D.textMuted} hover:text-red-400`} />
                    </span>
                  </div>
                )
              })}
              {filteredSymbols.length === 0 && <p className={`text-center ${D.textMuted} text-[11px] py-4`}>No symbols</p>}
            </div>
          </div>
        </div>

        {/* ── CENTER: Chart + Bottom ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Symbol Header */}
          <div className={`flex items-center gap-2 px-3 py-1.5 ${D.barBg} border-b ${D.border} flex-shrink-0`}>
            <span className={`text-[13px] font-bold ${D.text}`}>{selectedSymbol}</span>
            <span className={`text-[11px] ${D.textMuted} truncate`}>{watchlist.find(s => s.name === selectedSymbol)?.description || ''}</span>
            {/* Mobile: show P&L here */}
            <div className={`sm:hidden ml-auto text-[10px] font-mono font-semibold ${totalPnlValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              P&L: {totalPnlValue >= 0 ? '+' : ''}${totalPnlValue.toFixed(2)}
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0">
            <MT5Chart
              symbol={resolveMt5Symbol(selectedSymbol)}
              positions={positions}
              isDark={isDark}
              onQuickTrade={(type) => {
                setOrderType(type)
                handlePlaceOrder(type)
              }}
            />
          </div>

          {/* ── Bottom Panel ── */}
          <div className={`${D.panelBg} border-t ${D.border} flex flex-col transition-all flex-shrink-0 ${bottomCollapsed ? 'h-[36px]' : 'h-[200px] sm:h-[220px]'}`}>
            {/* Tabs */}
            <div className={`flex items-center border-b ${D.border} flex-shrink-0 px-1`}>
              {[
                { key: 'positions', label: 'Positions', count: (positions || []).length },
                { key: 'orders', label: 'Orders', count: (orders || []).length },
                { key: 'history', label: 'History', count: null },
              ].map(t => (
                <button key={t.key} onClick={() => { setBottomTab(t.key); setBottomCollapsed(false) }}
                  className={`px-2.5 py-2 text-[11px] font-medium ${bottomTab === t.key && !bottomCollapsed ? 'text-blue-400 border-b-2 border-blue-400' : `${D.textMuted} ${isDark ? 'hover:text-slate-100' : 'hover:text-gray-700'}`}`}>
                  {t.label}
                  {t.count !== null && <span className={`ml-1 px-1 py-px rounded-full text-[9px] ${t.count > 0 ? 'bg-blue-500/20 text-blue-400' : (isDark ? 'bg-[#1a2540] text-slate-600' : 'bg-gray-200 text-gray-500')}`}>{t.count}</span>}
                </button>
              ))}
              <button onClick={() => setBottomCollapsed(!bottomCollapsed)} className={`ml-auto p-1 rounded ${D.textMuted} ${isDark ? 'hover:text-slate-100 hover:bg-white/5' : 'hover:text-gray-700 hover:bg-gray-100'}`}>
                {bottomCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Table content */}
            {!bottomCollapsed && (
              <div className="flex-1 overflow-auto">
                {bottomTab === 'positions' && (
                  <table className="w-full text-[11px]">
                    <thead className={`sticky top-0 ${D.tableBg}`}>
                      <tr className={`${D.textMuted} text-[9px] uppercase`}>
                        <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                        <th className="text-left px-1 py-1.5 font-medium">Side</th>
                        <th className="text-right px-1 py-1.5 font-medium">Lots</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden sm:table-cell">Open</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden sm:table-cell">Current</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden md:table-cell">SL</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden md:table-cell">TP</th>
                        <th className="text-right px-1 py-1.5 font-medium">P&amp;L</th>
                        <th className="text-right px-2 py-1.5 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(positions || []).length === 0
                        ? <tr><td colSpan={9} className={`text-center py-6 ${D.textMuted} text-[11px]`}>No open positions</td></tr>
                        : (positions || []).map(pos => {
                          const flash = flashMap[pos.id]
                          const pnl = pos.pnl || 0
                          return (
                          <tr key={pos.id} className={`border-b ${D.border} ${D.rowHover} transition-colors`}>
                            <td className={`px-2 py-1.5 font-semibold ${D.text}`}>{pos.symbol}</td>
                            <td className="px-1 py-1.5">
                              <span className={`px-1 py-px rounded text-[9px] font-bold ${pos.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {(pos.type || '').toUpperCase()}
                              </span>
                            </td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono`}>{(pos.volume || 0).toFixed(2)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono hidden sm:table-cell`}>{fmtPrice(pos.openPrice, pos.symbol)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono hidden sm:table-cell`}>{fmtPrice(pos.currentPrice, pos.symbol)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textMuted} font-mono hidden md:table-cell`}>{pos.sl ? fmtPrice(pos.sl, pos.symbol) : '—'}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textMuted} font-mono hidden md:table-cell`}>{pos.tp ? fmtPrice(pos.tp, pos.symbol) : '—'}</td>
                            <td className={`text-right px-1 py-1.5 font-mono font-bold text-[12px] transition-colors duration-300
                              ${flash === 'up' ? 'text-emerald-300 bg-emerald-500/20' : flash === 'down' ? 'text-red-300 bg-red-500/20' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                            </td>
                            <td className="text-right px-2 py-1.5">
                              <button onClick={() => handleClosePosition(pos)}
                                className="px-2 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
                                Close
                              </button>
                            </td>
                          </tr>
                        )})}
                    </tbody>
                  </table>
                )}

                {bottomTab === 'orders' && (
                  <table className="w-full text-[11px]">
                    <thead className={`sticky top-0 ${D.tableBg}`}>
                      <tr className={`${D.textMuted} text-[9px] uppercase`}>
                        <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                        <th className="text-left px-1 py-1.5 font-medium">Type</th>
                        <th className="text-right px-1 py-1.5 font-medium">Lots</th>
                        <th className="text-right px-1 py-1.5 font-medium">Price</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden sm:table-cell">SL</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden sm:table-cell">TP</th>
                        <th className="text-right px-2 py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orders || []).length === 0
                        ? <tr><td colSpan={7} className={`text-center py-6 ${D.textMuted} text-[11px]`}>No pending orders</td></tr>
                        : (orders || []).map(ord => (
                          <tr key={ord.id} className={`border-b ${D.border} ${D.rowHover}`}>
                            <td className={`px-2 py-1.5 font-semibold ${D.text}`}>{ord.symbol}</td>
                            <td className="px-1 py-1.5">
                              <span className={`text-[9px] font-bold uppercase ${String(ord.type).toLowerCase().includes('buy') ? 'text-emerald-400' : 'text-red-400'}`}>{ord.type}</span>
                            </td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono`}>{(ord.volume || 0).toFixed(2)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono`}>{fmtPrice(ord.price, ord.symbol)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textMuted} font-mono hidden sm:table-cell`}>{ord.sl ? fmtPrice(ord.sl, ord.symbol) : '—'}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textMuted} font-mono hidden sm:table-cell`}>{ord.tp ? fmtPrice(ord.tp, ord.symbol) : '—'}</td>
                            <td className="text-right px-2 py-1.5"><span className="text-yellow-400 text-[9px] font-medium uppercase">{ord.status}</span></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}

                {bottomTab === 'history' && (
                  <table className="w-full text-[11px]">
                    <thead className={`sticky top-0 ${D.tableBg}`}>
                      <tr className={`${D.textMuted} text-[9px] uppercase`}>
                        <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
                        <th className="text-left px-1 py-1.5 font-medium">Side</th>
                        <th className="text-right px-1 py-1.5 font-medium">Lots</th>
                        <th className="text-right px-1 py-1.5 font-medium hidden sm:table-cell">Price</th>
                        <th className="text-right px-1 py-1.5 font-medium">Profit</th>
                        <th className="text-right px-2 py-1.5 font-medium hidden sm:table-cell">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tradeHistory || []).length === 0
                        ? <tr><td colSpan={6} className={`text-center py-6 ${D.textMuted} text-[11px]`}>No history</td></tr>
                        : (tradeHistory || []).map(d => (
                          <tr key={d.id} className={`border-b ${D.border} ${D.rowHover}`}>
                            <td className={`px-2 py-1.5 font-semibold ${D.text}`}>{d.symbol || '—'}</td>
                            <td className="px-1 py-1.5">
                              {String(d.type || '').toLowerCase().includes('buy')
                                ? <span className="text-emerald-400 text-[9px] font-bold">BUY</span>
                                : String(d.type || '').toLowerCase().includes('sell')
                                ? <span className="text-red-400 text-[9px] font-bold">SELL</span>
                                : <span className={`${D.textMuted} text-[9px]`}>{d.type || '—'}</span>}
                            </td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono`}>{(d.volume || 0).toFixed(2)}</td>
                            <td className={`text-right px-1 py-1.5 ${D.textDim} font-mono hidden sm:table-cell`}>{fmtPrice(d.price, d.symbol)}</td>
                            <td className={`text-right px-1 py-1.5 font-mono font-bold text-[12px] ${(d.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(d.profit || 0) >= 0 ? '+' : ''}{Number(d.profit || 0).toFixed(2)}
                            </td>
                            <td className={`text-right px-2 py-1.5 ${D.textMuted} hidden sm:table-cell text-[10px]`}>
                              {d.time ? new Date(typeof d.time === 'number' ? (d.time > 1e12 ? d.time : d.time * 1000) : d.time).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ORDER PANEL (desktop: always visible, mobile: overlay) ── */}
        <div className={`
          ${mobilePanel === 'order' ? 'absolute inset-0 z-40' : 'hidden'}
          lg:relative lg:flex lg:z-auto
          w-full lg:w-[220px] xl:w-[240px] flex-shrink-0
        `}>
          <div className={`flex flex-col h-full w-full ${D.panelBg} border-l ${D.border}`}>
            {/* Mobile close */}
            <div className={`lg:hidden flex items-center justify-between px-3 py-2 border-b ${D.border}`}>
              <span className={`text-sm font-semibold ${D.text}`}>New Order</span>
              <button onClick={() => setMobilePanel(null)} className={`p-1 rounded hover:${D.inputBg}`}><X className={`h-4 w-4 ${D.textMuted}`} /></button>
            </div>

            {/* ── SELL / BUY PRICE HEADER ── */}
            <div className="grid grid-cols-[1fr_auto_1fr]">
              {/* Sell */}
              <button onClick={() => setOrderType('sell')}
                className={`relative py-3 px-2 text-center transition-all ${
                  orderType === 'sell'
                    ? 'bg-red-600 shadow-inner'
                    : isDark ? 'bg-red-950/60 hover:bg-red-900/60' : 'bg-red-50 hover:bg-red-100 border-r border-red-200'
                }`}>
                <div className={`text-[10px] font-semibold mb-0.5 ${orderType === 'sell' ? 'text-red-100' : 'text-red-500'}`}>SELL</div>
                <div className={`font-bold font-mono leading-none ${orderType === 'sell' ? 'text-white' : 'text-red-500'}`}
                  style={{ fontSize: tickData.bid > 9999 ? '13px' : tickData.bid > 99 ? '15px' : '17px' }}>
                  {tickData.bid > 0 ? fmtPrice(tickData.bid, selectedSymbol) : <span className="text-[13px] opacity-50">—</span>}
                </div>
              </button>

              {/* Spread pill (centre) */}
              <div className={`flex flex-col items-center justify-center px-1.5 ${isDark ? 'bg-[#0d1520]' : 'bg-gray-100'}`}>
                {tickData.spread > 0
                  ? <><div className={`text-[7px] font-medium ${D.textMuted}`}>SPREAD</div>
                     <div className="text-[11px] font-bold text-blue-400 font-mono">{tickData.spread}</div></>
                  : <div className="w-px h-4 bg-current opacity-10" />}
              </div>

              {/* Buy */}
              <button onClick={() => setOrderType('buy')}
                className={`relative py-3 px-2 text-center transition-all ${
                  orderType === 'buy'
                    ? 'bg-emerald-600 shadow-inner'
                    : isDark ? 'bg-emerald-950/60 hover:bg-emerald-900/60' : 'bg-emerald-50 hover:bg-emerald-100 border-l border-emerald-200'
                }`}>
                <div className={`text-[10px] font-semibold mb-0.5 ${orderType === 'buy' ? 'text-emerald-100' : 'text-emerald-600'}`}>BUY</div>
                <div className={`font-bold font-mono leading-none ${orderType === 'buy' ? 'text-white' : 'text-emerald-600'}`}
                  style={{ fontSize: tickData.ask > 9999 ? '13px' : tickData.ask > 99 ? '15px' : '17px' }}>
                  {tickData.ask > 0 ? fmtPrice(tickData.ask, selectedSymbol) : <span className="text-[13px] opacity-50">—</span>}
                </div>
              </button>
            </div>

            {/* Active direction strip */}
            <div className={`flex items-center justify-center gap-2 py-1.5 border-y ${D.border} ${isDark ? 'bg-[#131c2e]' : 'bg-gray-50'}`}>
              <div className={`w-2 h-2 rounded-full ${orderType === 'buy' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
              <span className={`text-[11px] font-semibold ${orderType === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                {orderType === 'buy' ? 'BUY' : 'SELL'} at {execType === 'limit' ? 'Limit' : 'Market'}
              </span>
              <span className={`text-[10px] ${D.textMuted}`}>· {selectedSymbol}</span>
            </div>

            {/* Market / Limit tabs */}
            <div className={`flex border-b ${D.border}`}>
              {['market', 'limit'].map(t => (
                <button key={t} onClick={() => setExecType(t)}
                  className={`flex-1 py-2 text-[11px] font-semibold capitalize transition-colors
                    ${execType === t
                      ? `text-blue-400 border-b-2 border-blue-400 ${isDark ? 'bg-blue-500/5' : 'bg-blue-50'}`
                      : `${D.textMuted} hover:${D.text}`}`}>
                  {t === 'market' ? '⚡ Market' : '📋 Limit'}
                </button>
              ))}
            </div>

            {/* ── FORM ── */}
            <div className="flex-1 flex flex-col px-3 py-2.5 gap-3 overflow-y-auto">

              {/* Limit price input */}
              {execType === 'limit' && (
                <div className={`rounded-lg p-2.5 border ${D.border} ${isDark ? 'bg-[#1a2540]' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-[10px] font-semibold ${D.textMuted} uppercase tracking-wide`}>Entry Price</label>
                    {tickData.bid > 0 && (
                      <button onClick={() => setLimitPrice(fmtPrice(orderType === 'buy' ? tickData.ask : tickData.bid, selectedSymbol))}
                        className="text-[9px] text-blue-400 hover:text-blue-300 font-medium">
                        Use market
                      </button>
                    )}
                  </div>
                  <input type="number" step="any" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder={tickData.ask > 0 ? fmtPrice(tickData.ask, selectedSymbol) : '0.00000'}
                    className={`w-full px-3 py-2 rounded-md ${isDark ? 'bg-[#0d1520] text-white border-[#2a3a55]' : 'bg-white text-gray-900 border-gray-300'} border text-[14px] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-opacity-40`} />
                  {limitPrice && tickData.ask > 0 && (() => {
                    const market = orderType === 'buy' ? tickData.ask : tickData.bid
                    const diff = parseFloat(limitPrice) - market
                    const pct = (diff / market * 100)
                    return (
                      <div className={`mt-1 text-[10px] font-mono ${Math.abs(diff) < 0.00001 ? D.textMuted : diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(getSymbolDigits(selectedSymbol))} ({pct >= 0 ? '+' : ''}{pct.toFixed(3)}% from market)
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[10px] font-semibold ${D.textMuted} uppercase tracking-wide`}>Volume (Lots)</label>
                  <span className={`text-[10px] font-mono ${D.textMuted}`}>min 0.01</span>
                </div>
                {/* Quick preset buttons */}
                <div className="grid grid-cols-5 gap-1 mb-1.5">
                  {['0.01','0.05','0.1','0.5','1.0'].map(v => (
                    <button key={v} onClick={() => setVolume(v)}
                      className={`py-1 rounded text-[10px] font-semibold font-mono transition-colors
                        ${volume === v
                          ? `${orderType === 'buy' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`
                          : `${isDark ? 'bg-[#1a2540] text-slate-400 hover:bg-[#253350] hover:text-white border border-[#2a3a55]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}`}`}>
                      {v}
                    </button>
                  ))}
                </div>
                {/* Manual input */}
                <div className={`flex items-center rounded-lg overflow-hidden border ${D.border}`}>
                  <button type="button" onClick={() => adjustVolume(-1)}
                    className={`w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg transition-colors
                      ${isDark ? 'bg-[#1a2540] text-slate-400 hover:text-white hover:bg-red-900/40' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'}`}>
                    −
                  </button>
                  <input type="number" step="0.01" min="0.01" value={volume} onChange={(e) => setVolume(e.target.value)}
                    className={`flex-1 h-10 px-2 text-[15px] font-mono font-bold text-center focus:outline-none border-x ${D.border}
                      ${isDark ? 'bg-[#0d1520] text-white' : 'bg-white text-gray-900'}`} />
                  <button type="button" onClick={() => adjustVolume(1)}
                    className={`w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg transition-colors
                      ${isDark ? 'bg-[#1a2540] text-slate-400 hover:text-white hover:bg-emerald-900/40' : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                    +
                  </button>
                </div>
              </div>

              {/* TP/SL toggle */}
              <label className={`flex items-center gap-2 cursor-pointer select-none p-2 rounded-lg border ${showSlTp ? (orderType === 'buy' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5') : D.border} transition-colors`}>
                <div className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${showSlTp ? (orderType === 'buy' ? 'bg-emerald-600' : 'bg-red-600') : isDark ? 'bg-[#2a3a55]' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${showSlTp ? 'left-4.5' : 'left-0.5'}`}
                    style={{ left: showSlTp ? '18px' : '2px' }} />
                  <input type="checkbox" className="sr-only" checked={showSlTp} onChange={(e) => setShowSlTp(e.target.checked)} />
                </div>
                <span className={`text-[11px] font-semibold ${showSlTp ? D.text : D.textMuted}`}>Take Profit &amp; Stop Loss</span>
              </label>

              {showSlTp && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] font-semibold text-red-500 mb-1 block flex items-center gap-1`}>
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Stop Loss
                    </label>
                    <input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)}
                      placeholder={tickData.bid > 0 ? fmtPrice(tickData.bid * 0.999, selectedSymbol) : '0.00'}
                      className={`w-full px-2 py-1.5 rounded-md border border-red-500/30 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-red-500/50
                        ${isDark ? 'bg-red-950/20 text-white placeholder-red-900' : 'bg-red-50 text-gray-900 placeholder-red-300'}`} />
                  </div>
                  <div>
                    <label className={`text-[10px] font-semibold text-emerald-500 mb-1 block flex items-center gap-1`}>
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Take Profit
                    </label>
                    <input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)}
                      placeholder={tickData.ask > 0 ? fmtPrice(tickData.ask * 1.001, selectedSymbol) : '0.00'}
                      className={`w-full px-2 py-1.5 rounded-md border border-emerald-500/30 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50
                        ${isDark ? 'bg-emerald-950/20 text-white placeholder-emerald-900' : 'bg-emerald-50 text-gray-900 placeholder-emerald-300'}`} />
                  </div>
                </div>
              )}

              {/* Submit */}
              <button onClick={handlePlaceOrder}
                disabled={placing || tickSymbol !== selectedSymbol || tickData.bid <= 0}
                className={`w-full py-3 rounded-xl font-bold text-[14px] text-white transition-all active:scale-[0.98]
                  ${orderType === 'buy'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-600/30'}
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none`}>
                {placing
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Executing…</span>
                  : tickData.bid <= 0
                    ? (tickUnavailable ? '⚠ Symbol Unavailable' : '⏳ Loading prices…')
                    : <span className="flex items-center justify-center gap-2">
                        {orderType === 'buy' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {orderType === 'buy' ? 'Buy' : 'Sell'} {selectedSymbol}
                        <span className="text-[11px] opacity-80 font-normal">@ {execType === 'limit' && limitPrice ? limitPrice : (orderType === 'buy' ? fmtPrice(tickData.ask, selectedSymbol) : fmtPrice(tickData.bid, selectedSymbol))}</span>
                      </span>}
              </button>

              {/* Account Info — matches MT5 app layout */}
              <div className={`mt-auto pt-2 border-t ${D.border} space-y-0`}>
                {/* Primary metrics — bigger, visible */}
                {[
                  ['Balance',     selectedAcc ? Number(selectedAcc.balance || 0).toFixed(2) : '—',    D.text,         true ],
                  ['Equity',      selectedAcc ? Number(selectedAcc.equity  || 0).toFixed(2) : '—',    D.text,         true ],
                  ['Margin',      selectedAcc ? Number(selectedAcc.margin  || 0).toFixed(2) : '—',    D.textDim,      false],
                  ['Free Margin', selectedAcc ? Number(selectedAcc.freeMargin || 0).toFixed(2) : '—', D.textDim,      false],
                  ['Leverage',    selectedAcc ? `1:${selectedAcc.leverage || 100}` : '—',             D.textMuted,    false],
                ].map(([k, v, cls, bold]) => (
                  <div key={k} className={`flex justify-between items-center py-1 px-1 ${bold ? `border-b ${D.border}` : ''}`}>
                    <span className={`text-[11px] ${D.textMuted}`}>{k}</span>
                    <span className={`font-mono ${bold ? 'text-[13px] font-bold' : 'text-[11px] font-medium'} ${cls}`}>{v}</span>
                  </div>
                ))}
                {/* Floating P&L — highlighted */}
                {selectedAcc && (() => {
                  const fp = floatingPnl(selectedAcc)
                  return (
                    <div className={`flex justify-between items-center py-1.5 px-1 rounded mt-0.5 ${fp >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <span className={`text-[11px] ${D.textMuted}`}>Floating P&amp;L</span>
                      <span className={`font-mono text-[14px] font-bold ${fp >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fp >= 0 ? '+' : ''}{fp.toFixed(2)}
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE QUICK TRADE BAR ── */}
      {mobilePanel === null && (
        <div className={`lg:hidden flex flex-col ${D.barBg} border-t ${D.border} flex-shrink-0`}>
          {/* Row 1: symbol + volume */}
          <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
            <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}
              className={`px-1.5 py-1 rounded ${D.inputBg} border ${D.border} ${D.text} text-[11px] font-semibold focus:outline-none flex-1 min-w-0`}>
              {watchlist.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            {/* Compact volume ± selector */}
            <div className={`flex items-center rounded border ${D.border} overflow-hidden flex-shrink-0`}>
              <button type="button" onClick={() => adjustVolume(-1)}
                className={`w-8 h-8 flex items-center justify-center text-lg font-bold ${isDark ? 'bg-[#1a2540] text-slate-400 active:bg-red-900/40' : 'bg-gray-100 text-gray-600 active:bg-red-50'}`}>
                −
              </button>
              <span className={`text-[11px] font-mono font-bold px-1.5 min-w-[46px] text-center ${D.text} ${isDark ? 'bg-[#0d1520]' : 'bg-white'}`}>{volume}</span>
              <button type="button" onClick={() => adjustVolume(1)}
                className={`w-8 h-8 flex items-center justify-center text-lg font-bold ${isDark ? 'bg-[#1a2540] text-slate-400 active:bg-emerald-900/40' : 'bg-gray-100 text-gray-600 active:bg-emerald-50'}`}>
                +
              </button>
            </div>
          </div>
          {/* Row 2: SELL / BUY */}
          <div className="flex items-center gap-2 px-2 pb-2">
            <button onClick={() => { setOrderType('sell'); handlePlaceOrder('sell') }} disabled={placing || tickData.bid <= 0}
              className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold disabled:opacity-40 shadow shadow-red-600/20 active:scale-95 transition-transform">
              SELL&nbsp;{tickData.bid > 0 ? fmtPrice(tickData.bid, selectedSymbol) : tickUnavailable ? 'N/A' : '…'}
            </button>
            <button onClick={() => { setOrderType('buy'); handlePlaceOrder('buy') }} disabled={placing || tickData.bid <= 0}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold disabled:opacity-40 shadow shadow-emerald-600/20 active:scale-95 transition-transform">
              BUY&nbsp;{tickData.ask > 0 ? fmtPrice(tickData.ask, selectedSymbol) : '…'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradePage
