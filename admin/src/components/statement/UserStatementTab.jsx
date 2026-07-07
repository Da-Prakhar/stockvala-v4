import React, { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
} from 'recharts'
import { Card } from '../ui/Card'
import { DataTable } from '../ui/DataTable'
import {
  RefreshCw, TrendingUp, TrendingDown, Target, Award, Shield,
  BarChart2, Activity, ArrowUpRight, ArrowDownRight, Minus,
  FileText, FileSpreadsheet,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { useCompanyStore } from '../../store/companyStore'

const C = {
  green: '#22c55e',
  red: '#ef4444',
  blue: '#6366f1',
  amber: '#f59e0b',
  purple: '#a855f7',
  teal: '#14b8a6',
  gray: '#6b7280',
  rose: '#f43f5e',
  sky: '#0ea5e9',
}

const PERIODS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
]

function fmt(n, decimals = 2) {
  return Number(n).toFixed(decimals)
}

function pnlClass(v) {
  return v > 0
    ? 'text-green-600 dark:text-green-400'
    : v < 0
    ? 'text-red-600 dark:text-red-400'
    : 'text-dark-400 dark:text-dark-500'
}

function typeLabel(d) {
  const t = d.type ?? d.Type ?? d.action ?? d.Action
  return t === 0 || String(t).toLowerCase().includes('buy') ? 'BUY' : 'SELL'
}

function isBuyDeal(d) {
  const t = d.type ?? d.Type ?? d.action ?? d.Action
  return t === 0 || String(t).toLowerCase().includes('buy')
}

function volOf(d) {
  const v = parseFloat(d.volume ?? d.Volume ?? 0)
  return v >= 10000 ? v / 10000 : v
}

function profitOf(d) {
  return parseFloat(d.profit ?? d.Profit ?? 0)
}

function commOf(d) {
  return parseFloat(d.commission ?? d.Commission ?? 0)
}

function swapOf(d) {
  return parseFloat(d.storage ?? d.Storage ?? d.swap ?? d.Swap ?? 0)
}

function tsOf(d) {
  return d.time ?? d.Time ?? 0
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
const CumTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl border border-dark-700 min-w-[140px]">
      <p className="font-medium text-dark-200 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {p.value >= 0 ? '+' : ''}{Number(p.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div className="bg-dark-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl border border-dark-700">
      <p className="font-medium text-dark-200 mb-1">{label}</p>
      <p className={`font-mono font-bold ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {v >= 0 ? '+' : ''}{Number(v).toFixed(2)}
      </p>
    </div>
  )
}

// ─── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, positive, neutral }) {
  const isGood = positive === true
  const isBad = positive === false
  const color = neutral ? C.blue : isGood ? C.green : isBad ? C.red : C.gray
  const bgClass = neutral
    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30'
    : isGood
    ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30'
    : isBad
    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
    : 'bg-white dark:bg-dark-800 border-dark-200 dark:border-dark-700'
  const valClass = neutral
    ? 'text-blue-700 dark:text-blue-300'
    : isGood
    ? 'text-green-700 dark:text-green-300'
    : isBad
    ? 'text-red-700 dark:text-red-300'
    : 'text-dark-900 dark:text-dark-50'
  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-dark-500 dark:text-dark-400 leading-tight">{label}</p>
        {Icon && <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${valClass}`}>{value}</p>
      {sub && <p className="text-xs text-dark-400 dark:text-dark-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Progress bar row ────────────────────────────────────────────────────────
function ProgressRow({ label, value, maxVal, color, right }) {
  const pct = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-dark-600 dark:text-dark-300 font-medium">{label}</span>
        <span className={`font-bold ${right}`}>{right.includes('green') ? '+' : ''}{fmt(value)}</span>
      </div>
      <div className="w-full bg-dark-100 dark:bg-dark-700 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function UserStatementTab({ client, liveDeals, liveAccounts, mt5Loading }) {
  const [period, setPeriod] = useState('All')
  const [selectedLogin, setSelectedLogin] = useState('all') // 'all' | '<login>'
  const companyName = useCompanyStore(s => s.companyName) || 'StockVala'

  // All available login IDs
  const allLogins = useMemo(() => Object.keys(liveDeals || {}), [liveDeals])

  // Reset to 'all' if liveDeals changes (e.g. period reload)
  // and the previously selected login disappears
  const activeLogin = allLogins.includes(selectedLogin) ? selectedLogin : 'all'

  // All deals flat — filtered by selected account
  const rawDeals = useMemo(() => {
    const out = []
    Object.entries(liveDeals || {}).forEach(([login, list]) => {
      if (activeLogin !== 'all' && login !== activeLogin) return
      ;(list || []).forEach(d => out.push({ ...d, _login: login }))
    })
    return out
  }, [liveDeals, activeLogin])

  // Period-filtered
  const filtered = useMemo(() => {
    const sel = PERIODS.find(p => p.label === period)
    if (!sel?.days) return rawDeals
    const cutoff = Date.now() / 1000 - sel.days * 86400
    return rawDeals.filter(d => tsOf(d) >= cutoff)
  }, [rawDeals, period])

  // Exclude balance/credit/charge deals — keep only trade deals with profit
  const trades = useMemo(() => {
    return filtered.filter(d => {
      const sym = d.symbol ?? d.Symbol
      if (!sym) return false
      const t = d.type ?? d.Type
      if (t === 2 || String(t).toLowerCase() === 'balance') return false
      return true
    })
  }, [filtered])

  // Sorted ascending for charts
  const asc = useMemo(() => [...trades].sort((a, b) => tsOf(a) - tsOf(b)), [trades])
  // Sorted descending for table
  const desc = useMemo(() => [...trades].sort((a, b) => tsOf(b) - tsOf(a)), [trades])

  // ── Core Metrics ────────────────────────────────────────────────────────────
  const m = useMemo(() => {
    if (!trades.length) return null

    const profits = trades.map(profitOf)
    const winners = profits.filter(p => p > 0)
    const losers  = profits.filter(p => p < 0)
    const breaks  = profits.filter(p => p === 0)

    const netProfit     = profits.reduce((s, v) => s + v, 0)
    const totalComm     = trades.reduce((s, d) => s + commOf(d), 0)
    const totalSwap     = trades.reduce((s, d) => s + swapOf(d), 0)
    const grossWin      = winners.reduce((s, v) => s + v, 0)
    const grossLoss     = Math.abs(losers.reduce((s, v) => s + v, 0))
    const profitFactor  = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0
    const winRate       = trades.length > 0 ? (winners.length / trades.length) * 100 : 0
    const avgWin        = winners.length > 0 ? grossWin  / winners.length : 0
    const avgLoss       = losers.length  > 0 ? grossLoss / losers.length  : 0
    const avgTrade      = trades.length  > 0 ? netProfit / trades.length  : 0
    const bestTrade     = profits.length > 0 ? Math.max(...profits) : 0
    const worstTrade    = profits.length > 0 ? Math.min(...profits) : 0
    const totalVol      = trades.reduce((s, d) => s + volOf(d), 0)

    // Drawdown
    let peak = 0, cum = 0, maxDD = 0, maxDDPct = 0
    asc.forEach(d => {
      cum += profitOf(d)
      if (cum > peak) peak = cum
      const dd = peak - cum
      if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? (dd / peak) * 100 : 0 }
    })

    // Consecutive wins/losses
    let maxConsecW = 0, maxConsecL = 0, curW = 0, curL = 0
    asc.forEach(d => {
      const p = profitOf(d)
      if (p > 0) { curW++; curL = 0; maxConsecW = Math.max(maxConsecW, curW) }
      else if (p < 0) { curL++; curW = 0; maxConsecL = Math.max(maxConsecL, curL) }
      else { curW = 0; curL = 0 }
    })

    // Long / short split
    const longs  = trades.filter(isBuyDeal)
    const shorts  = trades.filter(d => !isBuyDeal(d))
    const longP  = longs.reduce((s, d) => s + profitOf(d), 0)
    const shortP = shorts.reduce((s, d) => s + profitOf(d), 0)

    // Expected payoff & Recovery factor
    const expectancy    = winRate / 100 * avgWin - (1 - winRate / 100) * avgLoss
    const recoveryFactor = maxDD > 0 ? netProfit / maxDD : 0

    return {
      count: trades.length, wins: winners.length, losses: losers.length, breaks: breaks.length,
      netProfit, totalComm, totalSwap,
      grossWin, grossLoss, profitFactor, winRate,
      avgWin, avgLoss, avgTrade, bestTrade, worstTrade,
      maxDD, maxDDPct, maxConsecW, maxConsecL,
      totalVol, longCount: longs.length, shortCount: shorts.length, longP, shortP,
      expectancy, recoveryFactor,
    }
  }, [trades, asc])

  // ── Chart: Cumulative P&L + Drawdown ───────────────────────────────────────
  const cumData = useMemo(() => {
    let cum = 0, peak = 0
    return asc.map(d => {
      cum += profitOf(d)
      if (cum > peak) peak = cum
      const dd = -(peak - cum)
      const ts = tsOf(d)
      const date = ts
        ? new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
        : ''
      return { date, cumulative: parseFloat(cum.toFixed(2)), drawdown: parseFloat(dd.toFixed(2)) }
    })
  }, [asc])

  // ── Chart: Monthly P&L ──────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = {}
    asc.forEach(d => {
      const ts = tsOf(d)
      if (!ts) return
      const key = new Date(ts * 1000).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })
      if (!map[key]) map[key] = { month: key, netPnl: 0, trades: 0, wins: 0, losses: 0 }
      const p = profitOf(d)
      map[key].netPnl += p
      map[key].trades++
      if (p > 0) map[key].wins++
      if (p < 0) map[key].losses++
    })
    return Object.values(map).map(r => ({
      ...r,
      netPnl: parseFloat(r.netPnl.toFixed(2)),
      winRate: r.trades > 0 ? Math.round((r.wins / r.trades) * 100) : 0,
    }))
  }, [asc])

  // ── Chart: Symbol breakdown ─────────────────────────────────────────────────
  const symData = useMemo(() => {
    const map = {}
    trades.forEach(d => {
      const sym = d.symbol ?? d.Symbol ?? 'Unknown'
      if (!map[sym]) map[sym] = { symbol: sym, trades: 0, wins: 0, losses: 0, netPnl: 0, volume: 0 }
      const p = profitOf(d)
      map[sym].trades++
      map[sym].netPnl += p
      map[sym].volume += volOf(d)
      if (p > 0) map[sym].wins++
      if (p < 0) map[sym].losses++
    })
    return Object.values(map)
      .map(s => ({
        ...s,
        netPnl: parseFloat(s.netPnl.toFixed(2)),
        volume: parseFloat(s.volume.toFixed(2)),
        winRate: Math.round((s.wins / s.trades) * 100),
      }))
      .sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl))
  }, [trades])

  // ── Column defs ─────────────────────────────────────────────────────────────
  const dealColumns = [
    {
      key: 'time', label: 'Time', sortable: true,
      render: (v, row) => {
        const ts = v ?? row.Time
        return ts
          ? <span className="text-xs font-mono">{new Date(ts * 1000).toLocaleString('en-IN')}</span>
          : '-'
      },
    },
    { key: '_login', label: 'Account', render: v => <span className="font-mono text-xs text-dark-400">{v}</span> },
    {
      key: 'position', label: 'Ticket', sortable: true,
      render: (v, row) => <span className="font-mono text-xs">{v ?? row.Position ?? row.positionId ?? '-'}</span>,
    },
    {
      key: 'symbol', label: 'Symbol', sortable: true,
      render: (v, row) => <span className="font-semibold text-dark-900 dark:text-dark-50">{v ?? row.Symbol ?? '-'}</span>,
    },
    {
      key: 'type', label: 'Dir', render: (v, row) => {
        const buy = isBuyDeal(row)
        return (
          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${buy ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {buy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {typeLabel(row)}
          </span>
        )
      },
    },
    {
      key: 'volume', label: 'Volume', sortable: true,
      render: (v, row) => <span className="font-mono text-xs">{volOf(row).toFixed(2)}</span>,
    },
    {
      key: 'price', label: 'Price', sortable: true,
      render: (v, row) => {
        const p = v ?? row.Price ?? 0
        return <span className="font-mono text-xs">{p ? parseFloat(p).toFixed(5) : '-'}</span>
      },
    },
    {
      key: 'commission', label: 'Comm.', sortable: true,
      render: (v, row) => {
        const c = commOf(row)
        return <span className={`font-mono text-xs ${c < 0 ? 'text-red-500' : 'text-dark-500'}`}>{c.toFixed(2)}</span>
      },
    },
    {
      key: 'storage', label: 'Swap', sortable: true,
      render: (v, row) => {
        const s = swapOf(row)
        return <span className={`font-mono text-xs ${s < 0 ? 'text-red-500' : 'text-dark-500'}`}>{s.toFixed(2)}</span>
      },
    },
    {
      key: 'profit', label: 'Profit', sortable: true,
      render: (v, row) => {
        const p = profitOf(row)
        return (
          <span className={`font-bold text-sm ${pnlClass(p)}`}>
            {p > 0 ? '+' : ''}{p.toFixed(2)}
          </span>
        )
      },
    },
  ]

  const monthlyColumns = [
    { key: 'month', label: 'Month', sortable: true },
    { key: 'trades', label: 'Trades', sortable: true },
    { key: 'wins', label: 'Wins', render: v => <span className="text-green-600 dark:text-green-400 font-semibold">{v}</span> },
    { key: 'losses', label: 'Losses', render: v => <span className="text-red-600 dark:text-red-400 font-semibold">{v}</span> },
    {
      key: 'winRate', label: 'Win %', sortable: true,
      render: v => <span className={v >= 50 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>{v}%</span>,
    },
    {
      key: 'netPnl', label: 'Net P&L', sortable: true,
      render: v => <span className={`font-bold ${pnlClass(v)}`}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>,
    },
  ]

  const symColumns = [
    { key: 'symbol', label: 'Symbol', sortable: true, render: v => <span className="font-semibold font-mono">{v}</span> },
    { key: 'trades', label: 'Trades', sortable: true },
    { key: 'wins', label: 'Wins', render: v => <span className="text-green-600 dark:text-green-400 font-semibold">{v}</span> },
    { key: 'losses', label: 'Losses', render: v => <span className="text-red-600 dark:text-red-400 font-semibold">{v}</span> },
    {
      key: 'winRate', label: 'Win %', sortable: true,
      render: v => <span className={v >= 50 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>{v}%</span>,
    },
    { key: 'volume', label: 'Volume (lots)', sortable: true, render: v => <span className="font-mono">{v.toFixed(2)}</span> },
    {
      key: 'netPnl', label: 'Net P&L', sortable: true,
      render: v => <span className={`font-bold ${pnlClass(v)}`}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>,
    },
  ]

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const mg = 14
    const clientName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Client'
    const accounts = activeLogin === 'all' ? Object.keys(liveDeals || {}).join(' · ') : activeLogin
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const COL_PRIMARY = [79, 70, 229]   // indigo-600
    const COL_DARK    = [15, 23, 42]    // slate-900
    const COL_GRAY    = [248, 250, 252] // slate-50
    const COL_GREEN   = [22, 163, 74]
    const COL_RED     = [220, 38, 38]

    const addPageFooter = () => {
      const total = doc.internal.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setFillColor(241, 245, 249)
        doc.rect(0, pageH - 10, pageW, 10, 'F')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.setFont('helvetica', 'normal')
        doc.text(`Page ${i} of ${total}`, pageW / 2, pageH - 3.5, { align: 'center' })
        doc.text(companyName, mg, pageH - 3.5)
        doc.text(`${clientName} · Generated ${today}`, pageW - mg, pageH - 3.5, { align: 'right' })
      }
    }

    // ── Page 1 header ────────────────────────────────────────────────────────
    doc.setFillColor(...COL_PRIMARY)
    doc.rect(0, 0, pageW, 42, 'F')

    // Diagonal accent stripe
    doc.setFillColor(99, 91, 255)
    doc.triangle(pageW - 60, 0, pageW, 0, pageW, 42, 'F')

    // Company name
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(companyName, mg, 17)

    // "Trade Statement" tag
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(199, 210, 254) // indigo-200
    doc.text('TRADE STATEMENT', mg, 26)

    // Right-side info
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(clientName, pageW - mg, 13, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(199, 210, 254)
    doc.text(`Accounts: ${accounts}`, pageW - mg, 21, { align: 'right' })
    doc.text(`Period: ${period}  |  Generated: ${today}`, pageW - mg, 29, { align: 'right' })

    let y = 52

    // ── Summary KPI table (2-column pairs) ───────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COL_DARK)
    doc.text('Performance Summary', mg, y)
    y += 5

    const kpiRows = m ? [
      ['Net Profit',      `${m.netProfit >= 0 ? '+' : ''}${fmt(m.netProfit)}`,   'Win Rate',          `${fmt(m.winRate, 1)}%`],
      ['Total Trades',    String(m.count),                                          'Winning Trades',    String(m.wins)],
      ['Profit Factor',   m.profitFactor >= 999 ? '∞' : fmt(m.profitFactor),      'Losing Trades',     String(m.losses)],
      ['Max Drawdown',    `-${fmt(m.maxDD)}`,                                       'DD % of Peak',      `${fmt(m.maxDDPct, 1)}%`],
      ['Avg Win',         `+${fmt(m.avgWin)}`,                                      'Avg Loss',          `-${fmt(m.avgLoss)}`],
      ['Best Trade',      `+${fmt(m.bestTrade)}`,                                   'Worst Trade',       fmt(m.worstTrade)],
      ['Expectancy',      `${m.expectancy >= 0 ? '+' : ''}${fmt(m.expectancy)}`,   'Recovery Factor',   fmt(m.recoveryFactor)],
      ['Total Volume',    `${fmt(m.totalVol, 2)} lots`,                             'Avg Trade',         `${m.avgTrade >= 0 ? '+' : ''}${fmt(m.avgTrade)}`],
      ['Long Trades',     `${m.longCount}  (${m.longP >= 0 ? '+' : ''}${fmt(m.longP)})`, 'Short Trades', `${m.shortCount}  (${m.shortP >= 0 ? '+' : ''}${fmt(m.shortP)})`],
      ['Total Commission',fmt(m.totalComm),                                         'Total Swap',        fmt(m.totalSwap)],
      ['Max Consec. Wins',String(m.maxConsecW),                                     'Max Consec. Loss',  String(m.maxConsecL)],
    ] : []

    autoTable(doc, {
      startY: y,
      margin: { left: mg, right: mg },
      theme: 'grid',
      tableWidth: 'auto',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: COL_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COL_GRAY },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COL_DARK, cellWidth: 42 },
        1: { cellWidth: 36 },
        2: { fontStyle: 'bold', textColor: COL_DARK, cellWidth: 42 },
        3: { cellWidth: 36 },
      },
      head: [['Metric', 'Value', 'Metric', 'Value']],
      body: kpiRows,
      willDrawCell: (data) => {
        if ((data.column.index === 1 || data.column.index === 3) && data.section === 'body') {
          const v = String(data.cell.raw)
          if (v.startsWith('+')) data.cell.styles.textColor = COL_GREEN
          else if (v.startsWith('-')) data.cell.styles.textColor = COL_RED
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = doc.lastAutoTable.finalY + 10

    // ── Monthly breakdown ─────────────────────────────────────────────────────
    if (monthlyData.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...COL_DARK)
      doc.text('Monthly Performance', mg, y)
      y += 5

      autoTable(doc, {
        startY: y,
        margin: { left: mg, right: mg },
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: COL_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: COL_GRAY },
        head: [['Month', 'Trades', 'Wins', 'Losses', 'Win Rate', 'Net P&L']],
        body: [...monthlyData].reverse().map(r => [
          r.month, r.trades, r.wins, r.losses, `${r.winRate}%`,
          `${r.netPnl >= 0 ? '+' : ''}${r.netPnl.toFixed(2)}`,
        ]),
        willDrawCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const v = String(data.cell.raw)
            data.cell.styles.textColor = v.startsWith('+') ? COL_GREEN : COL_RED
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.column.index === 2 && data.section === 'body') data.cell.styles.textColor = COL_GREEN
          if (data.column.index === 3 && data.section === 'body') data.cell.styles.textColor = COL_RED
        },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    // ── Symbol breakdown ──────────────────────────────────────────────────────
    if (symData.length > 0) {
      if (y > pageH - 60) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...COL_DARK)
      doc.text('Symbol Performance', mg, y)
      y += 5

      autoTable(doc, {
        startY: y,
        margin: { left: mg, right: mg },
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: COL_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: COL_GRAY },
        head: [['Symbol', 'Trades', 'Wins', 'Losses', 'Win %', 'Volume', 'Net P&L']],
        body: symData.map(r => [
          r.symbol, r.trades, r.wins, r.losses, `${r.winRate}%`,
          r.volume.toFixed(2),
          `${r.netPnl >= 0 ? '+' : ''}${r.netPnl.toFixed(2)}`,
        ]),
        willDrawCell: (data) => {
          if (data.column.index === 6 && data.section === 'body') {
            const v = String(data.cell.raw)
            data.cell.styles.textColor = v.startsWith('+') ? COL_GREEN : COL_RED
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.column.index === 0 && data.section === 'body') data.cell.styles.fontStyle = 'bold'
        },
      })
    }

    // ── Deal history (new page) ───────────────────────────────────────────────
    if (trades.length > 0) {
      doc.addPage()

      doc.setFillColor(...COL_PRIMARY)
      doc.rect(0, 0, pageW, 16, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Full Deal History', mg, 11)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(199, 210, 254)
      doc.text(`${trades.length} trades · ${period}`, pageW - mg, 11, { align: 'right' })

      autoTable(doc, {
        startY: 22,
        margin: { left: mg, right: mg },
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: COL_GRAY },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 18 },
          2: { cellWidth: 16 },
          4: { cellWidth: 10 },
          5: { cellWidth: 13 },
          9: { cellWidth: 18 },
        },
        head: [['Date / Time', 'Account', 'Ticket', 'Symbol', 'Dir', 'Volume', 'Price', 'Comm.', 'Swap', 'Profit']],
        body: desc.map(d => [
          tsOf(d) ? new Date(tsOf(d) * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
          d._login || '-',
          String(d.position ?? d.Position ?? d.positionId ?? '-'),
          String(d.symbol ?? d.Symbol ?? '-'),
          isBuyDeal(d) ? 'BUY' : 'SELL',
          volOf(d).toFixed(2),
          parseFloat(d.price ?? d.Price ?? 0).toFixed(5),
          commOf(d).toFixed(2),
          swapOf(d).toFixed(2),
          `${profitOf(d) >= 0 ? '+' : ''}${profitOf(d).toFixed(2)}`,
        ]),
        willDrawCell: (data) => {
          if (data.column.index === 9 && data.section === 'body') {
            data.cell.styles.textColor = String(data.cell.raw).startsWith('+') ? COL_GREEN : COL_RED
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.column.index === 4 && data.section === 'body') {
            data.cell.styles.textColor = data.cell.raw === 'BUY' ? COL_GREEN : COL_RED
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
    }

    addPageFooter()
    const safeName = clientName.replace(/\s+/g, '_')
    doc.save(`${safeName}_Statement_${period}.pdf`)
  }

  // ── Excel Export ─────────────────────────────────────────────────────────────
  const downloadXLS = () => {
    const wb = XLSX.utils.book_new()
    const clientName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Client'
    const accounts = activeLogin === 'all' ? Object.keys(liveDeals || {}).join(', ') : activeLogin

    // Sheet 1 – Summary
    const summaryRows = [
      [companyName + ' — Trade Statement'],
      [],
      ['Client',    clientName],
      ['Accounts',  accounts],
      ['Period',    period],
      ['Generated', new Date().toLocaleString('en-IN')],
      [],
      ['PERFORMANCE METRICS', ''],
      ['Metric', 'Value'],
      ...(m ? [
        ['Net Profit',          m.netProfit],
        ['Win Rate (%)',         parseFloat(fmt(m.winRate, 2))],
        ['Total Trades',         m.count],
        ['Winning Trades',       m.wins],
        ['Losing Trades',        m.losses],
        ['Breakeven Trades',     m.breaks],
        ['Profit Factor',        parseFloat(fmt(m.profitFactor, 4))],
        ['Max Drawdown',        -m.maxDD],
        ['DD % of Peak',         parseFloat(fmt(m.maxDDPct, 2))],
        ['Avg Win',              m.avgWin],
        ['Avg Loss',            -m.avgLoss],
        ['Best Trade',           m.bestTrade],
        ['Worst Trade',          m.worstTrade],
        ['Expectancy',           m.expectancy],
        ['Avg Trade',            m.avgTrade],
        ['Recovery Factor',      m.recoveryFactor],
        ['Total Volume (lots)',  m.totalVol],
        ['Long Trades',          m.longCount],
        ['Short Trades',         m.shortCount],
        ['Long P&L',             m.longP],
        ['Short P&L',            m.shortP],
        ['Total Commission',     m.totalComm],
        ['Total Swap',           m.totalSwap],
        ['Max Consec. Wins',     m.maxConsecW],
        ['Max Consec. Losses',   m.maxConsecL],
      ] : [['No trade data', '']]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows)
    ws1['!cols'] = [{ wch: 28 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    // Sheet 2 – Monthly Breakdown
    if (monthlyData.length > 0) {
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['Month', 'Trades', 'Wins', 'Losses', 'Win Rate (%)', 'Net P&L'],
        ...[...monthlyData].reverse().map(r => [r.month, r.trades, r.wins, r.losses, r.winRate, r.netPnl]),
      ])
      ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 13 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Breakdown')
    }

    // Sheet 3 – Symbol Breakdown
    if (symData.length > 0) {
      const ws3 = XLSX.utils.aoa_to_sheet([
        ['Symbol', 'Trades', 'Wins', 'Losses', 'Win Rate (%)', 'Volume (lots)', 'Net P&L'],
        ...symData.map(r => [r.symbol, r.trades, r.wins, r.losses, r.winRate, r.volume, r.netPnl]),
      ])
      ws3['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 13 }, { wch: 14 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Symbol Breakdown')
    }

    // Sheet 4 – Deal History
    if (trades.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([
        ['Date / Time', 'Account', 'Ticket', 'Symbol', 'Direction', 'Volume', 'Price', 'Commission', 'Swap', 'Profit'],
        ...desc.map(d => [
          tsOf(d) ? new Date(tsOf(d) * 1000).toLocaleString('en-IN') : '-',
          d._login || '-',
          d.position ?? d.Position ?? d.positionId ?? '-',
          d.symbol ?? d.Symbol ?? '-',
          isBuyDeal(d) ? 'BUY' : 'SELL',
          volOf(d),
          parseFloat(d.price ?? d.Price ?? 0),
          commOf(d),
          swapOf(d),
          profitOf(d),
        ]),
      ])
      ws4['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 9 }, { wch: 8 }, { wch: 12 }, { wch: 11 }, { wch: 9 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws4, 'Deal History')
    }

    const safeName = clientName.replace(/\s+/g, '_')
    XLSX.writeFile(wb, `${safeName}_Statement_${period}.xlsx`)
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (mt5Loading && !trades.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw className="w-9 h-9 text-primary-500 animate-spin" />
        <p className="text-dark-500 dark:text-dark-400 font-medium">Fetching deal history from MT5…</p>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  const noData = !m

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-dark-900 dark:text-dark-50">Trade Statement</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
            {client?.firstName} {client?.lastName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download buttons — only shown when there's data */}
          {!noData && (
            <>
              <button
                onClick={downloadPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm font-semibold transition-all"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={downloadXLS}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 text-sm font-semibold transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </>
          )}

          {/* Period Filter */}
          <div className="flex items-center gap-1 bg-dark-100 dark:bg-dark-800 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p.label}
                onClick={() => setPeriod(p.label)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  period === p.label
                    ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 shadow-sm'
                    : 'text-dark-400 dark:text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Account Selector (only when multiple accounts) ───────────── */}
      {allLogins.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wider">Account:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedLogin('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                activeLogin === 'all'
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-dark-800 border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400'
              }`}
            >
              All Accounts
            </button>
            {allLogins.map(login => {
              const acc = (liveAccounts || {})[login] || {}
              const isActive = activeLogin === login
              return (
                <button
                  key={login}
                  onClick={() => setSelectedLogin(login)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                      : 'bg-white dark:bg-dark-800 border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
                >
                  <span className="font-mono">{login}</span>
                  {acc.accountType && (
                    <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-white/20' : 'bg-dark-100 dark:bg-dark-700 text-dark-400'}`}>
                      {acc.accountType}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {noData ? (
        <Card>
          <div className="py-20 text-center">
            <BarChart2 className="w-14 h-14 text-dark-200 dark:text-dark-600 mx-auto mb-4" />
            <p className="text-dark-600 dark:text-dark-400 font-semibold text-lg">No deal history for this period</p>
            <p className="text-dark-400 dark:text-dark-500 text-sm mt-1">
              Select a wider period or sync live data
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* ── KPI Row 1: Primary ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Net Profit"
              value={`${m.netProfit >= 0 ? '+' : ''}${fmt(m.netProfit)}`}
              sub={`${m.count} trades total`}
              icon={m.netProfit >= 0 ? TrendingUp : TrendingDown}
              positive={m.netProfit >= 0}
            />
            <KpiCard
              label="Win Rate"
              value={`${fmt(m.winRate, 1)}%`}
              sub={`${m.wins}W · ${m.losses}L · ${m.breaks}B`}
              icon={Target}
              positive={m.winRate >= 50}
            />
            <KpiCard
              label="Profit Factor"
              value={m.profitFactor >= 999 ? '∞' : fmt(m.profitFactor)}
              sub={m.profitFactor >= 2 ? 'Excellent' : m.profitFactor >= 1.5 ? 'Good' : m.profitFactor >= 1 ? 'Positive' : 'Negative'}
              icon={Award}
              positive={m.profitFactor >= 1}
            />
            <KpiCard
              label="Max Drawdown"
              value={`-${fmt(m.maxDD)}`}
              sub={`${fmt(m.maxDDPct, 1)}% of peak`}
              icon={Shield}
              positive={false}
            />
            <KpiCard
              label="Total Volume"
              value={fmt(m.totalVol, 2)}
              sub="lots traded"
              icon={Activity}
              neutral
            />
            <KpiCard
              label="Recovery Factor"
              value={fmt(m.recoveryFactor, 2)}
              sub="Profit ÷ Max DD"
              icon={BarChart2}
              positive={m.recoveryFactor >= 1}
            />
          </div>

          {/* ── KPI Row 2: Secondary ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {[
              { label: 'Avg Win', value: `+${fmt(m.avgWin)}`, good: true },
              { label: 'Avg Loss', value: `-${fmt(m.avgLoss)}`, good: false },
              { label: 'Best Trade', value: `+${fmt(m.bestTrade)}`, good: true },
              { label: 'Worst Trade', value: fmt(m.worstTrade), good: false },
              { label: 'Expectancy', value: `${m.expectancy >= 0 ? '+' : ''}${fmt(m.expectancy)}`, good: m.expectancy >= 0 },
              { label: 'Avg Trade', value: `${m.avgTrade >= 0 ? '+' : ''}${fmt(m.avgTrade)}`, good: m.avgTrade >= 0 },
              { label: 'Max Consec. Wins', value: String(m.maxConsecW), good: true },
              { label: 'Max Consec. Loss', value: String(m.maxConsecL), good: false },
            ].map(({ label, value, good }) => (
              <div key={label} className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-xl px-3 py-3 flex flex-col justify-between">
                <p className="text-xs text-dark-400 dark:text-dark-500 leading-tight">{label}</p>
                <p className={`text-base font-bold mt-1.5 ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Chart 1: Cumulative P&L + Drawdown ────────────────────────── */}
          {cumData.length > 1 && (
            <Card>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="font-bold text-dark-900 dark:text-dark-50">Equity Curve & Drawdown</p>
                  <p className="text-xs text-dark-400 mt-0.5">Cumulative P&L vs peak-to-trough drawdown</p>
                </div>
                <div className="flex items-center gap-5 text-xs text-dark-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded inline-block" style={{ background: m.netProfit >= 0 ? C.green : C.red }} />
                    Equity Curve
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded inline-block" style={{ background: C.red, opacity: 0.6 }} />
                    Drawdown
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={cumData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={m.netProfit >= 0 ? C.green : C.red} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={m.netProfit >= 0 ? C.green : C.red} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.red} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="pnl" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="dd" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip content={<CumTooltip />} />
                  <ReferenceLine yAxisId="pnl" y={0} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Area
                    yAxisId="pnl" type="monotone" dataKey="cumulative"
                    stroke={m.netProfit >= 0 ? C.green : C.red} fill="url(#cumFill)"
                    strokeWidth={2.5} dot={false} name="Equity Curve"
                  />
                  <Area
                    yAxisId="dd" type="monotone" dataKey="drawdown"
                    stroke={C.red} fill="url(#ddFill)"
                    strokeWidth={1.5} dot={false} strokeDasharray="3 3"
                    name="Drawdown" strokeOpacity={0.7}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Row: Monthly P&L + Pie Charts ─────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Monthly Bar */}
            <div className="xl:col-span-2">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-dark-900 dark:text-dark-50">Monthly P&L</p>
                    <p className="text-xs text-dark-400 mt-0.5">Green = profitable month</p>
                  </div>
                </div>
                {monthlyData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-dark-400 text-sm">No monthly data</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<BarTooltip />} />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} />
                      <Bar dataKey="netPnl" name="Monthly P&L" radius={[3, 3, 0, 0]} maxBarSize={40}>
                        {monthlyData.map((entry, i) => (
                          <Cell key={i} fill={entry.netPnl >= 0 ? C.green : C.red} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Right column: Pie + Long/Short */}
            <div className="space-y-4">

              {/* Outcome Pie */}
              <Card>
                <p className="font-bold text-dark-900 dark:text-dark-50 mb-1 text-sm">Trade Outcomes</p>
                <p className="text-xs text-dark-400 mb-3">Win · Loss · Breakeven distribution</p>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: `Wins (${m.wins})`, value: m.wins },
                        { name: `Losses (${m.losses})`, value: m.losses },
                        ...(m.breaks > 0 ? [{ name: `B/E (${m.breaks})`, value: m.breaks }] : []),
                      ].filter(d => d.value > 0)}
                      dataKey="value"
                      cx="50%" cy="50%"
                      outerRadius={55} innerRadius={32}
                      strokeWidth={2}
                    >
                      {[C.green, C.red, C.gray].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Long vs Short */}
              <Card>
                <p className="font-bold text-dark-900 dark:text-dark-50 mb-3 text-sm">Long vs Short</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Long ({m.longCount})
                      </span>
                      <span className={`font-bold text-xs ${pnlClass(m.longP)}`}>
                        {m.longP >= 0 ? '+' : ''}{fmt(m.longP)}
                      </span>
                    </div>
                    <div className="w-full bg-dark-100 dark:bg-dark-700 rounded-full h-2.5">
                      <div
                        className="bg-green-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${m.longCount + m.shortCount > 0 ? (m.longCount / (m.longCount + m.shortCount)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                        <ArrowDownRight className="w-3.5 h-3.5" /> Short ({m.shortCount})
                      </span>
                      <span className={`font-bold text-xs ${pnlClass(m.shortP)}`}>
                        {m.shortP >= 0 ? '+' : ''}{fmt(m.shortP)}
                      </span>
                    </div>
                    <div className="w-full bg-dark-100 dark:bg-dark-700 rounded-full h-2.5">
                      <div
                        className="bg-red-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${m.longCount + m.shortCount > 0 ? (m.shortCount / (m.longCount + m.shortCount)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* ── Row: Symbol Chart + Risk Metrics ──────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Symbol horizontal bar */}
            {symData.length > 0 && (
              <Card>
                <p className="font-bold text-dark-900 dark:text-dark-50 mb-1">P&L by Symbol</p>
                <p className="text-xs text-dark-400 mb-4">Top 10 symbols by absolute net profit</p>
                <ResponsiveContainer width="100%" height={Math.min(symData.slice(0, 10).length * 38 + 24, 320)}>
                  <BarChart
                    data={symData.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="symbol" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip content={<BarTooltip />} />
                    <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1.5} />
                    <Bar dataKey="netPnl" name="Net P&L" radius={[0, 3, 3, 0]} maxBarSize={24}>
                      {symData.slice(0, 10).map((e, i) => (
                        <Cell key={i} fill={e.netPnl >= 0 ? C.green : C.red} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Risk & Reward Panel */}
            <Card>
              <p className="font-bold text-dark-900 dark:text-dark-50 mb-1">Risk & Reward Analysis</p>
              <p className="text-xs text-dark-400 mb-4">Key performance ratios for broker review</p>

              <div className="space-y-4">
                <ProgressRow
                  label="Gross Profit"
                  value={m.grossWin}
                  maxVal={m.grossWin + m.grossLoss}
                  color="bg-green-500"
                  right="text-green-600 dark:text-green-400"
                />
                <ProgressRow
                  label="Gross Loss"
                  value={m.grossLoss}
                  maxVal={m.grossWin + m.grossLoss}
                  color="bg-red-500"
                  right="text-red-600 dark:text-red-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                {[
                  { label: 'Profit Factor', value: m.profitFactor >= 999 ? '∞' : fmt(m.profitFactor), good: m.profitFactor >= 1 },
                  { label: 'Win/Loss Ratio', value: m.avgLoss > 0 ? fmt(m.avgWin / m.avgLoss) : '∞', good: m.avgLoss === 0 || m.avgWin / m.avgLoss >= 1 },
                  { label: 'Expectancy', value: `${m.expectancy >= 0 ? '+' : ''}${fmt(m.expectancy)}`, good: m.expectancy >= 0 },
                  { label: 'Recovery Factor', value: fmt(m.recoveryFactor), good: m.recoveryFactor >= 1 },
                  { label: 'Max Drawdown', value: `-${fmt(m.maxDD)}`, good: false },
                  { label: 'DD % of Peak', value: `${fmt(m.maxDDPct, 1)}%`, good: m.maxDDPct <= 20 },
                  { label: 'Total Commission', value: fmt(m.totalComm), good: m.totalComm === 0 },
                  { label: 'Total Swap', value: fmt(m.totalSwap), good: m.totalSwap >= 0 },
                ].map(({ label, value, good }) => (
                  <div key={label} className="bg-dark-50 dark:bg-dark-700/40 rounded-lg p-3 border border-dark-100 dark:border-dark-700">
                    <p className="text-xs text-dark-400 dark:text-dark-500 mb-0.5">{label}</p>
                    <p className={`text-sm font-bold ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Symbol Breakdown Table ─────────────────────────────────────── */}
          {symData.length > 0 && (
            <Card noPadding>
              <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-dark-900 dark:text-dark-50">Symbol Breakdown</p>
                  <p className="text-xs text-dark-400 mt-0.5">Performance per instrument</p>
                </div>
                <span className="text-xs bg-dark-100 dark:bg-dark-700 px-2.5 py-1 rounded-full text-dark-500 dark:text-dark-400">
                  {symData.length} symbols
                </span>
              </div>
              <div className="overflow-x-auto">
                <DataTable columns={symColumns} data={symData} pageSize={10} />
              </div>
            </Card>
          )}

          {/* ── Monthly Breakdown Table ────────────────────────────────────── */}
          {monthlyData.length > 0 && (
            <Card noPadding>
              <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700">
                <p className="font-bold text-dark-900 dark:text-dark-50">Monthly Breakdown</p>
                <p className="text-xs text-dark-400 mt-0.5">Month-by-month performance summary</p>
              </div>
              <div className="overflow-x-auto">
                <DataTable columns={monthlyColumns} data={[...monthlyData].reverse()} pageSize={24} />
              </div>
            </Card>
          )}

          {/* ── Full Deal History ──────────────────────────────────────────── */}
          <Card noPadding>
            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold text-dark-900 dark:text-dark-50">Full Deal History</p>
                <p className="text-xs text-dark-400 mt-0.5">All trade executions in selected period</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {m.wins} wins
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  {m.losses} losses
                </span>
                <span className="bg-dark-100 dark:bg-dark-700 px-2.5 py-1 rounded-full text-dark-500 dark:text-dark-400">
                  {trades.length} total
                </span>
              </div>
            </div>
            {trades.length === 0 ? (
              <p className="text-dark-400 text-center py-10 text-sm">No deals found for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <DataTable columns={dealColumns} data={desc} pageSize={25} />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
