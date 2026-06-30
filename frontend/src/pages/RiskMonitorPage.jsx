import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle, TrendingUp, TrendingDown, Activity, RefreshCw,
  Zap, Shield, BarChart2, Clock, Users, DollarSign, Eye,
  ArrowUpRight, ArrowDownRight, Target, Flame, ChevronDown, ChevronUp,
  Wifi, WifiOff
} from 'lucide-react'
import api from '../utils/api'

/* ────────────────────────────────────────────────────────────────────
   Colour helpers
   ──────────────────────────────────────────────────────────────────── */
const C = {
  bg:      '#080d17',
  panel:   '#0d1525',
  border:  '#1a2640',
  border2: '#243350',
  text:    '#e2e8f0',
  muted:   '#64748b',
  dim:     '#334155',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  purple:  '#8b5cf6',
  cyan:    '#06b6d4',
  orange:  '#f97316',
}

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
  if (score >= 70) return C.red
  if (score >= 40) return C.amber
  if (score >= 20) return C.orange
  return C.green
}
const marginColor = (lvl) => {
  if (lvl < 100) return C.red
  if (lvl < 120) return C.orange
  if (lvl < 150) return C.amber
  return C.green
}

/* ────────────────────────────────────────────────────────────────────
   Micro components
   ──────────────────────────────────────────────────────────────────── */
const Badge = ({ children, color = C.muted }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '2px 6px',
    borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44`,
    textTransform: 'uppercase', whiteSpace: 'nowrap'
  }}>{children}</span>
)

const KpiCard = ({ icon: Icon, label, value, sub, color, pulse }) => (
  <div style={{
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: '16px 20px', position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ position: 'absolute', inset: 0, background: `${color}08`, pointerEvents: 'none' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: color + '22', borderRadius: 8, padding: 8, display: 'flex' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{label}</span>
      </div>
      {pulse && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
    </div>
    <div style={{ marginTop: 12, fontSize: 26, fontWeight: 800, color, fontFamily: 'monospace', letterSpacing: -1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
  </div>
)

const SectionHeader = ({ title, count, icon: Icon, color = C.cyan, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
    <div style={{ background: color + '22', borderRadius: 8, padding: 6, display: 'flex' }}>
      <Icon size={14} color={color} />
    </div>
    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
    {count !== undefined && (
      <span style={{ fontSize: 11, color, background: color + '20', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>{count}</span>
    )}
    <div style={{ flex: 1 }} />
    {children}
  </div>
)

const ProgressBar = ({ pct, color }) => (
  <div style={{ height: 4, borderRadius: 9, background: C.border, overflow: 'hidden', flex: 1 }}>
    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 9, transition: 'width .4s' }} />
  </div>
)

/* ────────────────────────────────────────────────────────────────────
   Row components
   ──────────────────────────────────────────────────────────────────── */
const ScalperRow = ({ acc, rank }) => {
  const col = riskColor(acc.riskScore)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ width: 20, color: C.muted, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>#{rank}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</div>
        <div style={{ color: C.muted, fontSize: 10 }}>{acc.login}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 3, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge color={C.orange}>&lt;5m: {acc.scalp5}</Badge>
        <Badge color={C.amber}>&lt;10m: {acc.scalp10}</Badge>
        <Badge color={C.cyan}>&lt;15m: {acc.scalp15}</Badge>
        <span style={{ color: C.muted }}>avg {fmtDuration(acc.avgDurationSec)}</span>
        <span style={{ color: acc.realizedPnl >= 0 ? C.green : C.red, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>
          {fmtMoney(acc.realizedPnl)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 60 }}>
          <ProgressBar pct={acc.riskScore} color={col} />
          <span style={{ color: col, fontWeight: 800, fontSize: 11, width: 28 }}>{acc.riskScore}</span>
        </div>
      </div>
    </div>
  )
}

const WinnerRow = ({ acc, rank, isWinner }) => {
  const winCol = isWinner ? C.green : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ width: 20, color: C.muted, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>#{rank}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
        <div style={{ color: C.muted, fontSize: 10 }}>{acc.login} · {acc.deals} deals</div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ textAlign: 'center', minWidth: 48 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: winCol }}>{acc.winRate}%</div>
          <div style={{ fontSize: 9, color: C.muted }}>WIN RATE</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 60 }}>
          <div style={{ fontWeight: 700, color: acc.realizedPnl >= 0 ? C.green : C.red }}>{fmtMoney(acc.realizedPnl)}</div>
          <div style={{ fontSize: 9, color: C.muted }}>{acc.wins}W / {acc.losses}L</div>
        </div>
      </div>
    </div>
  )
}

const StopOutRow = ({ acc, rank }) => {
  const col = marginColor(acc.marginLevel)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ width: 20, color: C.muted, fontWeight: 700, fontSize: 11 }}>#{rank}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
        <div style={{ color: C.muted, fontSize: 10 }}>{acc.login}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: col }}>{acc.marginLevel}%</div>
          <div style={{ fontSize: 9, color: C.muted }}>MARGIN LVL</div>
        </div>
        <div style={{ minWidth: 70, textAlign: 'right' }}>
          <div style={{ color: C.text, fontSize: 11 }}>${(acc.equity || 0).toFixed(0)}</div>
          <div style={{ fontSize: 9, color: C.muted }}>equity</div>
        </div>
        <div style={{ minWidth: 70, textAlign: 'right' }}>
          <div style={{ color: acc.openPnl >= 0 ? C.green : C.red, fontWeight: 700 }}>{fmtMoney(acc.openPnl)}</div>
          <div style={{ fontSize: 9, color: C.muted }}>open P&L</div>
        </div>
      </div>
    </div>
  )
}

const ExposureRow = ({ row }) => {
  const max = 5
  const buyW  = Math.min(100, (row.buyLots / max) * 100)
  const sellW = Math.min(100, (row.sellLots / max) * 100)
  const pnlCol = row.netPnl >= 0 ? C.green : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <div style={{ width: 80, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>{row.symbol}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: C.green, width: 22, flexShrink: 0 }}>BUY</span>
          <ProgressBar pct={buyW} color={C.green} />
          <span style={{ fontSize: 10, color: C.green, width: 38, textAlign: 'right' }}>{row.buyLots.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: C.red, width: 22, flexShrink: 0 }}>SELL</span>
          <ProgressBar pct={sellW} color={C.red} />
          <span style={{ fontSize: 10, color: C.red, width: 38, textAlign: 'right' }}>{row.sellLots.toFixed(2)}</span>
        </div>
      </div>
      <div style={{ minWidth: 56, textAlign: 'right' }}>
        <div style={{ fontWeight: 700, color: pnlCol, fontSize: 12 }}>{fmtMoney(row.netPnl)}</div>
        <div style={{ fontSize: 9, color: C.muted }}>{row.traders} traders</div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Collapsible section
   ──────────────────────────────────────────────────────────────────── */
const Section = ({ title, count, icon, color, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: open ? `1px solid ${C.border}` : 'none', userSelect: 'none' }}
      >
        <SectionHeader title={title} count={count} icon={icon} color={color}>
          {open ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
        </SectionHeader>
      </div>
      {open && (
        <div>{children}</div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Main page
   ──────────────────────────────────────────────────────────────────── */
const RiskMonitorPage = () => {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [hours, setHours]     = useState(24)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef(null)

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

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 30000)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, load])

  const s = data?.summary || {}
  const brokerPnlPositive = (s.brokerNetPnl || 0) >= 0

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ background: C.red + '22', borderRadius: 10, padding: 8, display: 'flex' }}>
            <Shield size={20} color={C.red} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>B-Book Risk Monitor</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
              {autoRefresh && <span style={{ marginLeft: 8, color: C.green }}>● Live</span>}
            </div>
          </div>
        </div>

        {/* Scan window selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[6, 24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${hours === h ? C.cyan : C.border}`, background: hours === h ? C.cyan + '22' : 'transparent', color: hours === h ? C.cyan : C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {h < 24 ? `${h}h` : h < 168 ? `${h / 24}d` : '7d'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAutoRefresh(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${autoRefresh ? C.green : C.border}`, background: autoRefresh ? C.green + '15' : 'transparent', color: autoRefresh ? C.green : C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {autoRefresh ? <Wifi size={13} /> : <WifiOff size={13} />}
            {autoRefresh ? 'Auto' : 'Paused'}
          </button>
          <button onClick={() => { setLoading(true); load() }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
        {error && (
          <div style={{ background: C.red + '15', border: `1px solid ${C.red}40`, borderRadius: 10, padding: '12px 16px', color: C.red, marginBottom: 16, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: C.muted }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Scanning all accounts…</span>
          </div>
        )}

        {data && (
          <>
            {/* ── KPI row ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard icon={Users}       label="Active Traders"  value={s.activeTraders ?? 0}       color={C.cyan}   sub={`of ${s.totalAccounts ?? 0} accounts`} />
              <KpiCard icon={Activity}    label="Open Positions"  value={s.openPositions ?? 0}       color={C.blue}   sub={`${hours}h scan window`} />
              <KpiCard icon={DollarSign}  label="Broker Net P&L"  value={fmtMoney(s.brokerNetPnl)}   color={brokerPnlPositive ? C.green : C.red} sub="from open positions" pulse />
              <KpiCard icon={AlertTriangle} label="Stop-Out Risk" value={s.stopOutAlerts ?? 0}       color={s.stopOutAlerts > 0 ? C.orange : C.green} sub="margin level < 120%" pulse={s.stopOutAlerts > 0} />
              <KpiCard icon={Zap}         label="Scalper Alerts"  value={s.scalperAlerts ?? 0}       color={s.scalperAlerts > 0 ? C.amber : C.green} sub="< 15-min trades" />
              <KpiCard icon={Flame}       label="High-Risk Traders" value={s.highRiskTraders ?? 0}   color={s.highRiskTraders > 0 ? C.red : C.green} sub="risk score ≥ 40" />
            </div>

            {/* ── Two-column grid ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Scalpers */}
              <Section title="Scalpers" count={data.scalpers?.length} icon={Zap} color={C.amber}>
                {data.scalpers?.length === 0
                  ? <div style={{ padding: '24px 16px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No scalpers detected in this window</div>
                  : data.scalpers?.map((a, i) => <ScalperRow key={a.login} acc={a} rank={i + 1} />)
                }
              </Section>

              {/* Stop-Out Risk */}
              <Section title="Stop-Out Risk" count={data.stopOutRisk?.length} icon={AlertTriangle} color={C.orange}>
                {data.stopOutRisk?.length === 0
                  ? <div style={{ padding: '24px 16px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No accounts near stop-out</div>
                  : data.stopOutRisk?.map((a, i) => <StopOutRow key={a.login} acc={a} rank={i + 1} />)
                }
              </Section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Serial Winners */}
              <Section title="Serial Winners" count={data.winners?.length} icon={TrendingUp} color={C.green}>
                {data.winners?.length === 0
                  ? <div style={{ padding: '24px 16px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No serial winners found</div>
                  : data.winners?.map((a, i) => <WinnerRow key={a.login} acc={a} rank={i + 1} isWinner={true} />)
                }
              </Section>

              {/* Serial Losers */}
              <Section title="Serial Losers" count={data.losers?.length} icon={TrendingDown} color={C.dim} defaultOpen={false}>
                {data.losers?.length === 0
                  ? <div style={{ padding: '24px 16px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No serial losers found</div>
                  : data.losers?.map((a, i) => <WinnerRow key={a.login} acc={a} rank={i + 1} isWinner={false} />)
                }
              </Section>
            </div>

            {/* Symbol Exposure */}
            <Section title="Symbol Exposure" count={data.exposure?.length} icon={BarChart2} color={C.purple}>
              {data.exposure?.length === 0
                ? <div style={{ padding: '24px 16px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No open positions</div>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {data.exposure?.map(row => <ExposureRow key={row.symbol} row={row} />)}
                  </div>
                )
              }
            </Section>

            {/* High Risk Accounts — full table */}
            {data.highRisk?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Section title="High-Risk Account Summary" count={data.highRisk?.length} icon={Flame} color={C.red}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border2}` }}>
                          {['Login', 'Name', 'Risk Score', 'Win Rate', 'Scalp<15m', 'Avg Duration', 'Realized P&L', 'Open P&L', 'Margin Lvl'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.highRisk.map(acc => {
                          const col = riskColor(acc.riskScore)
                          return (
                            <tr key={acc.login} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: C.cyan }}>{acc.login}</td>
                              <td style={{ padding: '9px 14px', color: C.text, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</td>
                              <td style={{ padding: '9px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ProgressBar pct={acc.riskScore} color={col} />
                                  <span style={{ color: col, fontWeight: 800, width: 28 }}>{acc.riskScore}</span>
                                </div>
                              </td>
                              <td style={{ padding: '9px 14px', color: acc.winRate >= 65 ? C.green : acc.winRate <= 35 ? C.red : C.muted }}>
                                {acc.winRate !== null ? `${acc.winRate}%` : '—'}
                              </td>
                              <td style={{ padding: '9px 14px', color: acc.scalp15 > 0 ? C.amber : C.muted, fontWeight: 700 }}>{acc.scalp15}</td>
                              <td style={{ padding: '9px 14px', color: C.muted }}>{fmtDuration(acc.avgDurationSec)}</td>
                              <td style={{ padding: '9px 14px', color: acc.realizedPnl >= 0 ? C.green : C.red, fontWeight: 700, fontFamily: 'monospace' }}>{fmtMoney(acc.realizedPnl)}</td>
                              <td style={{ padding: '9px 14px', color: acc.openPnl >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>{fmtMoney(acc.openPnl)}</td>
                              <td style={{ padding: '9px 14px', color: marginColor(acc.marginLevel), fontWeight: 700 }}>{acc.marginLevel}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        button { transition: all .15s; }
        button:hover { opacity: .85 }
      `}</style>
    </div>
  )
}

export default RiskMonitorPage
