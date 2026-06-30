import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle, TrendingUp, TrendingDown, Activity, RefreshCw,
  Zap, Shield, BarChart2, Clock, Users, DollarSign, Wifi, WifiOff,
  ChevronDown, ChevronUp, Flame
} from 'lucide-react'
import api from '../utils/api'

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */
const fmtMoney = (v) => {
  const n = parseFloat(v) || 0
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`
  return n < 0 ? `-${s}` : `+${s}`
}

const fmtDuration = (sec) => {
  if (!sec && sec !== 0) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

const riskColor = (score) => {
  if (score >= 70) return 'text-red-500'
  if (score >= 40) return 'text-amber-500'
  if (score >= 20) return 'text-orange-400'
  return 'text-emerald-500'
}

const riskBg = (score) => {
  if (score >= 70) return 'bg-red-500'
  if (score >= 40) return 'bg-amber-500'
  if (score >= 20) return 'bg-orange-400'
  return 'bg-emerald-500'
}

const marginTextColor = (lvl) => {
  if (lvl < 100) return 'text-red-500'
  if (lvl < 120) return 'text-orange-500'
  if (lvl < 150) return 'text-amber-500'
  return 'text-emerald-500'
}

/* ────────────────────────────────────────────────────────────────────
   Reusable sub-components (Tailwind — matches CRM design system)
   ──────────────────────────────────────────────────────────────────── */
const KpiCard = ({ icon: Icon, label, value, sub, colorClass, pulse }) => (
  <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4 relative overflow-hidden">
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">{label}</span>
      {pulse && <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
    </div>
    <div className={`text-2xl font-black tracking-tight font-mono ${colorClass}`}>{value}</div>
    {sub && <div className="text-xs text-dark-400 dark:text-dark-500 mt-1">{sub}</div>}
  </div>
)

const SectionCard = ({ title, count, icon: Icon, iconClass, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
      >
        <div className={`p-1.5 rounded-lg ${iconClass} bg-opacity-10 dark:bg-opacity-20`}>
          <Icon className={`w-4 h-4 ${iconClass}`} />
        </div>
        <span className="font-semibold text-dark-900 dark:text-dark-50 text-sm">{title}</span>
        {count !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${iconClass} bg-opacity-15 dark:bg-opacity-25`}>{count}</span>
        )}
        <div className="flex-1" />
        {open ? <ChevronUp className="w-4 h-4 text-dark-400" /> : <ChevronDown className="w-4 h-4 text-dark-400" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const Empty = ({ msg }) => (
  <div className="py-8 text-center text-sm text-dark-400 dark:text-dark-500">{msg}</div>
)

const Bar = ({ pct, colorClass }) => (
  <div className="flex-1 h-1.5 rounded-full bg-dark-100 dark:bg-dark-700 overflow-hidden">
    <div className={`h-full rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
  </div>
)

/* ── Row components ────────────────────────────────────────────────── */
const ScalperRow = ({ acc, i }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-100 dark:border-dark-700 text-sm hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors">
    <span className="w-5 text-xs text-dark-400 font-bold shrink-0">#{i + 1}</span>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-dark-900 dark:text-dark-50 truncate">{acc.name}</div>
      <div className="text-xs text-dark-400 font-mono">{acc.login}</div>
    </div>
    <div className="flex gap-2 items-center shrink-0 flex-wrap justify-end">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">&lt;5m: {acc.scalp5}</span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">&lt;10m: {acc.scalp10}</span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">&lt;15m: {acc.scalp15}</span>
      <span className="text-xs text-dark-400">avg {fmtDuration(acc.avgDurationSec)}</span>
      <span className={`text-xs font-bold w-14 text-right ${acc.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
        {fmtMoney(acc.realizedPnl)}
      </span>
      <div className="flex items-center gap-1 w-20">
        <Bar pct={acc.riskScore} colorClass={riskBg(acc.riskScore)} />
        <span className={`text-xs font-black w-6 ${riskColor(acc.riskScore)}`}>{acc.riskScore}</span>
      </div>
    </div>
  </div>
)

const WinnerRow = ({ acc, i, isWinner }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-100 dark:border-dark-700 text-sm hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors">
    <span className="w-5 text-xs text-dark-400 font-bold shrink-0">#{i + 1}</span>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-dark-900 dark:text-dark-50 truncate">{acc.name}</div>
      <div className="text-xs text-dark-400 font-mono">{acc.login} · {acc.deals} deals</div>
    </div>
    <div className="flex items-center gap-4 shrink-0">
      <div className="text-center">
        <div className={`text-lg font-black ${isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{acc.winRate}%</div>
        <div className="text-[9px] text-dark-400 uppercase">Win Rate</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${acc.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtMoney(acc.realizedPnl)}</div>
        <div className="text-[9px] text-dark-400">{acc.wins}W / {acc.losses}L</div>
      </div>
    </div>
  </div>
)

const StopOutRow = ({ acc, i }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-100 dark:border-dark-700 text-sm hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors">
    <span className="w-5 text-xs text-dark-400 font-bold shrink-0">#{i + 1}</span>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-dark-900 dark:text-dark-50 truncate">{acc.name}</div>
      <div className="text-xs text-dark-400 font-mono">{acc.login}</div>
    </div>
    <div className="flex items-center gap-4 shrink-0">
      <div className="text-center">
        <div className={`text-lg font-black ${marginTextColor(acc.marginLevel)}`}>{acc.marginLevel}%</div>
        <div className="text-[9px] text-dark-400 uppercase">Margin Lvl</div>
      </div>
      <div className="text-right min-w-[70px]">
        <div className="text-sm font-semibold text-dark-700 dark:text-dark-300">${(acc.equity || 0).toFixed(0)}</div>
        <div className="text-[9px] text-dark-400">equity</div>
      </div>
      <div className="text-right min-w-[60px]">
        <div className={`text-sm font-bold ${acc.openPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtMoney(acc.openPnl)}</div>
        <div className="text-[9px] text-dark-400">open P&L</div>
      </div>
    </div>
  </div>
)

const ExposureRow = ({ row }) => {
  const total = row.buyLots + row.sellLots || 1
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-100 dark:border-dark-700 text-sm hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors">
      <div className="w-20 font-black font-mono text-dark-800 dark:text-dark-100 shrink-0">{row.symbol}</div>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-600 w-7 shrink-0">BUY</span>
          <Bar pct={(row.buyLots / total) * 100} colorClass="bg-emerald-500" />
          <span className="text-[10px] text-emerald-600 w-10 text-right">{row.buyLots.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-red-500 w-7 shrink-0">SELL</span>
          <Bar pct={(row.sellLots / total) * 100} colorClass="bg-red-500" />
          <span className="text-[10px] text-red-500 w-10 text-right">{row.sellLots.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-right shrink-0 min-w-[70px]">
        <div className={`text-sm font-bold ${row.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtMoney(row.netPnl)}</div>
        <div className="text-[9px] text-dark-400">{row.traders} traders</div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Main page
   ──────────────────────────────────────────────────────────────────── */
export default function RiskMonitorPage() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [hours, setHours]       = useState(24)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.get(`/admin/mt5/risk-monitor?hours=${hours}`)
      setData(res.data?.data || res.data)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load risk data')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => { setLoading(true); load() }, [load])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (autoRefresh) timerRef.current = setInterval(load, 30000)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, load])

  const s = data?.summary || {}
  const brokerPositive = (s.brokerNetPnl || 0) >= 0

  return (
    <div className="space-y-5">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-900 dark:text-dark-50">B-Book Risk Monitor</h1>
            <p className="text-xs text-dark-400 dark:text-dark-500">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
              {autoRefresh && <span className="ml-2 text-emerald-500">● Live</span>}
            </p>
          </div>
        </div>

        {/* Scan-window buttons */}
        <div className="flex gap-1.5">
          {[6, 24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                hours === h
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-dark-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:border-primary-400'
              }`}>
              {h < 24 ? `${h}h` : h < 168 ? `${h / 24}d` : '7d'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              autoRefresh
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-dark-200 dark:border-dark-600 text-dark-400'
            }`}>
            {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {autoRefresh ? 'Auto' : 'Paused'}
          </button>
          <button onClick={() => { setLoading(true); load() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-dark-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:border-primary-400 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20 gap-3 text-dark-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Scanning all accounts…</span>
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard icon={Users}         label="Active Traders"   value={s.activeTraders ?? 0}         colorClass="text-primary-600 dark:text-primary-400" sub={`of ${s.totalAccounts ?? 0} accounts`} />
            <KpiCard icon={Activity}      label="Open Positions"   value={s.openPositions ?? 0}         colorClass="text-blue-600 dark:text-blue-400"   sub={`${hours}h scan`} />
            <KpiCard icon={DollarSign}    label="Broker Net P&L"   value={fmtMoney(s.brokerNetPnl)}     colorClass={brokerPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'} sub="from open positions" pulse />
            <KpiCard icon={AlertTriangle} label="Stop-Out Risk"    value={s.stopOutAlerts ?? 0}         colorClass={s.stopOutAlerts > 0 ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'} sub="margin < 120%" pulse={s.stopOutAlerts > 0} />
            <KpiCard icon={Zap}           label="Scalper Alerts"   value={s.scalperAlerts ?? 0}         colorClass={s.scalperAlerts > 0 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'} sub="< 15-min trades" />
            <KpiCard icon={Flame}         label="High-Risk Traders" value={s.highRiskTraders ?? 0}      colorClass={s.highRiskTraders > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'} sub="risk score ≥ 40" />
          </div>

          {/* ── Main grid: 2 columns ────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Scalpers */}
            <SectionCard title="Scalpers" count={data.scalpers?.length} icon={Zap} iconClass="text-amber-500">
              {!data.scalpers?.length
                ? <Empty msg="No scalpers detected in this window" />
                : data.scalpers.map((a, i) => <ScalperRow key={a.login} acc={a} i={i} />)
              }
            </SectionCard>

            {/* Stop-Out Risk */}
            <SectionCard title="Stop-Out Risk" count={data.stopOutRisk?.length} icon={AlertTriangle} iconClass="text-orange-500">
              {!data.stopOutRisk?.length
                ? <Empty msg="No accounts near stop-out" />
                : data.stopOutRisk.map((a, i) => <StopOutRow key={a.login} acc={a} i={i} />)
              }
            </SectionCard>

            {/* Serial Winners */}
            <SectionCard title="Serial Winners" count={data.winners?.length} icon={TrendingUp} iconClass="text-emerald-600 dark:text-emerald-400">
              {!data.winners?.length
                ? <Empty msg="No serial winners found in this window" />
                : data.winners.map((a, i) => <WinnerRow key={a.login} acc={a} i={i} isWinner={true} />)
              }
            </SectionCard>

            {/* Serial Losers */}
            <SectionCard title="Serial Losers" count={data.losers?.length} icon={TrendingDown} iconClass="text-dark-400" defaultOpen={false}>
              {!data.losers?.length
                ? <Empty msg="No serial losers found in this window" />
                : data.losers.map((a, i) => <WinnerRow key={a.login} acc={a} i={i} isWinner={false} />)
              }
            </SectionCard>
          </div>

          {/* Symbol Exposure — full width */}
          <SectionCard title="Symbol Exposure" count={data.exposure?.length} icon={BarChart2} iconClass="text-purple-600 dark:text-purple-400">
            {!data.exposure?.length
              ? <Empty msg="No open positions" />
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2">
                  {data.exposure.map(row => <ExposureRow key={row.symbol} row={row} />)}
                </div>
              )
            }
          </SectionCard>

          {/* High-Risk Accounts Table */}
          {data.highRisk?.length > 0 && (
            <SectionCard title="High-Risk Account Summary" count={data.highRisk?.length} icon={Flame} iconClass="text-red-500">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700/50">
                      {['Login', 'Name', 'Risk Score', 'Win Rate', 'Scalp <15m', 'Avg Duration', 'Realized P&L', 'Open P&L', 'Margin Lvl'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-dark-500 dark:text-dark-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.highRisk.map(acc => (
                      <tr key={acc.login} className="border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-primary-600 dark:text-primary-400">{acc.login}</td>
                        <td className="px-4 py-3 font-semibold text-dark-800 dark:text-dark-200 max-w-[140px] truncate">{acc.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bar pct={acc.riskScore} colorClass={riskBg(acc.riskScore)} />
                            <span className={`font-black w-6 ${riskColor(acc.riskScore)}`}>{acc.riskScore}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-bold ${acc.winRate >= 65 ? 'text-emerald-600 dark:text-emerald-400' : acc.winRate <= 35 ? 'text-red-500' : 'text-dark-500'}`}>
                          {acc.winRate !== null ? `${acc.winRate}%` : '—'}
                        </td>
                        <td className={`px-4 py-3 font-bold ${acc.scalp15 > 0 ? 'text-amber-500' : 'text-dark-400'}`}>{acc.scalp15}</td>
                        <td className="px-4 py-3 text-dark-500">{fmtDuration(acc.avgDurationSec)}</td>
                        <td className={`px-4 py-3 font-bold font-mono ${acc.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtMoney(acc.realizedPnl)}</td>
                        <td className={`px-4 py-3 font-mono ${acc.openPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtMoney(acc.openPnl)}</td>
                        <td className={`px-4 py-3 font-bold ${marginTextColor(acc.marginLevel)}`}>{acc.marginLevel}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
