'use client'

import { useState, useMemo } from 'react'
import { useMarketData } from '@/lib/hooks/useApiHooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'
import { MarketDataStock, MacroIndicators } from '@/types'
import { formatTimeAgo } from '@/lib/utils/format'
import {
  ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Activity,
  DollarSign, BarChart3, Shield, Landmark, Gauge, Percent,
  Briefcase, AlertTriangle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
} from 'recharts'

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'up') return <ArrowUp className={`h-3.5 w-3.5 text-emerald-500 ${className ?? ''}`} />
  if (direction === 'down') return <ArrowDown className={`h-3.5 w-3.5 text-red-500 ${className ?? ''}`} />
  return <Minus className={`h-3.5 w-3.5 text-gray-400 ${className ?? ''}`} />
}

function MacroCard({ label, value, unit, icon: Icon, color, sublabel, lastUpdated }: {
  label: string
  value: string
  unit?: string
  icon: typeof Activity
  color: string
  sublabel?: string
  lastUpdated?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-4.5 w-4.5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-lg font-semibold tabular-nums">
              {value}{unit && <span className="text-sm text-muted-foreground ml-0.5">{unit}</span>}
            </div>
            {sublabel && <div className="text-[10px] text-muted-foreground">{sublabel}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MacroIndicatorsSection({ macro }: { macro: MacroIndicators | null }) {
  if (!macro) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              No data
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const vix = parseFloat(macro.vix) || 0
  const vixColor = vix < 20 ? '#10b981' : vix <= 30 ? '#f59e0b' : '#ef4444'
  const vixSub = vix < 20 ? 'Low volatility' : vix <= 30 ? 'Moderate volatility' : 'High volatility'

  const dgs10 = parseFloat(macro.dgs10) || 0
  const fed = parseFloat(macro.fedfunds) || 0
  const fedColor = fed > 5 ? '#ef4444' : fed < 3 ? '#10b981' : '#f59e0b'
  const fedSub = fed > 5 ? 'Tight' : fed < 3 ? 'Accommodative' : 'Neutral'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MacroCard label="10Y Treasury" value={macro.dgs10} unit="%" icon={TrendingUp} color="#3b82f6" sublabel={dgs10 > 4.5 ? 'Elevated yields' : 'Moderate yields'} />
        <MacroCard label="VIX" value={macro.vix} icon={Activity} color={vixColor} sublabel={vixSub} />
        <MacroCard label="Fed Funds Rate" value={macro.fedfunds} unit="%" icon={DollarSign} color={fedColor} sublabel={fedSub} />
        <MacroCard label="2Y Treasury" value={macro.dgs2} unit="%" icon={Landmark} color="#6366f1" />
        <MacroCard label="5Y Treasury" value={macro.dgs5} unit="%" icon={Landmark} color="#8b5cf6" />
        <MacroCard label="30Y Treasury" value={macro.dgs30} unit="%" icon={Landmark} color="#a855f7" />
        <MacroCard label="Unemployment" value={macro.unemployment} unit="%" icon={Briefcase} color="#06b6d4" />
        <MacroCard label="CPI Inflation" value={macro.cpi} unit="%" icon={Percent} color="#f97316" />
      </div>
      {macro.updated_at && (
        <div className="text-[10px] text-muted-foreground text-right">
          Last updated: {formatTimeAgo(macro.updated_at)}
        </div>
      )}
    </div>
  )
}

function YieldCurveChart({ macro }: { macro: MacroIndicators | null }) {
  if (!macro) return null

  const dgs2 = parseFloat(macro.dgs2) || 0
  const dgs5 = parseFloat(macro.dgs5) || 0
  const dgs10 = parseFloat(macro.dgs10) || 0
  const dgs30 = parseFloat(macro.dgs30) || 0

  if (dgs2 === 0 && dgs5 === 0 && dgs10 === 0 && dgs30 === 0) return null

  const isInverse = dgs2 > dgs10

  const chartData = [
    { maturity: '2Y', yield: dgs2 },
    { maturity: '5Y', yield: dgs5 },
    { maturity: '10Y', yield: dgs10 },
    { maturity: '30Y', yield: dgs30 },
  ]

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Yield Curve
        </CardTitle>
        {isInverse && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            Inverted — recession signal
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="maturity" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Yield']} contentStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="yield" stroke={isInverse ? '#ef4444' : '#3b82f6'} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function SectorPerformanceChart({ sectors }: { sectors: MarketDataStock[] }) {
  if (sectors.length === 0) return null

  const chartData = [...sectors]
    .map((s) => ({
      name: s.entity_name.replace(/_Sector| Sector/gi, '').replace(/_/g, ' '),
      change: parseFloat(s.price_change_pct) || 0,
    }))
    .sort((a, b) => b.change - a.change)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Sector Performance (7D)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
              <Tooltip formatter={(value) => { const v = Number(value); return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, '7D Change'] }} contentStyle={{ fontSize: 11 }} />
              <ReferenceLine x={0} stroke="#666" />
              <Bar dataKey="change" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.change >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function MarketSummaryCard({ stocks, macro }: { stocks: MarketDataStock[]; macro: MacroIndicators | null }) {
  if (stocks.length === 0 && !macro) return null

  const up = stocks.filter((s) => parseFloat(s.price_change_pct) > 0).length
  const down = stocks.filter((s) => parseFloat(s.price_change_pct) < 0).length
  const avgChange = stocks.length > 0
    ? stocks.reduce((s, st) => s + (parseFloat(st.price_change_pct) || 0), 0) / stocks.length
    : 0

  const sorted = [...stocks].sort((a, b) => parseFloat(b.price_change_pct) - parseFloat(a.price_change_pct))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  const vix = macro ? parseFloat(macro.vix) || 0 : null
  const vixLabel = vix === null ? '' : vix < 20 ? 'Low volatility' : vix <= 30 ? 'Moderate' : 'High volatility'
  const vixColor = vix === null ? '' : vix < 20 ? 'text-emerald-600' : vix <= 30 ? 'text-amber-600' : 'text-red-600'

  const dgs2 = macro ? parseFloat(macro.dgs2) || 0 : 0
  const dgs10 = macro ? parseFloat(macro.dgs10) || 0 : 0
  const curveStatus = dgs2 > dgs10 ? 'Inverted' : dgs10 - dgs2 > 1 ? 'Steep' : 'Normal'
  const curveColor = curveStatus === 'Inverted' ? 'text-red-600' : curveStatus === 'Steep' ? 'text-emerald-600' : 'text-amber-600'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Market Summary</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Stocks</div>
            <div>
              <span className="text-emerald-600">{up} up</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-red-600">{down} down</span>
            </div>
            <div className="text-muted-foreground">Avg change: <span className={avgChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>{avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%</span></div>
          </div>
          {vix !== null && (
            <div>
              <div className="text-muted-foreground">VIX</div>
              <div className={`font-medium ${vixColor}`}>{vix.toFixed(2)}</div>
              <div className="text-muted-foreground">{vixLabel}</div>
            </div>
          )}
          {macro && (
            <div>
              <div className="text-muted-foreground">Rates</div>
              <div>10Y: <span className="font-medium">{macro.dgs10}%</span></div>
              <div>Fed: <span className="font-medium">{macro.fedfunds}%</span></div>
            </div>
          )}
          {macro && (
            <div>
              <div className="text-muted-foreground">Yield Curve</div>
              <div className={`font-medium ${curveColor}`}>{curveStatus}</div>
            </div>
          )}
        </div>
        {best && worst && best.entity_name !== worst.entity_name && (
          <div className="mt-3 pt-3 border-t border-border text-xs flex gap-6">
            <div>
              <span className="text-muted-foreground">Best: </span>
              <span className="font-medium">{best.ticker || best.entity_name}</span>
              <span className="text-emerald-600 ml-1">+{parseFloat(best.price_change_pct).toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Worst: </span>
              <span className="font-medium">{worst.ticker || worst.entity_name}</span>
              <span className="text-red-600 ml-1">{parseFloat(worst.price_change_pct).toFixed(2)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IndexCards({ indices }: { indices: MarketDataStock[] }) {
  if (indices.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {indices.map((idx) => {
        const change = parseFloat(idx.price_change_pct) || 0
        const price = parseFloat(idx.latest_price) || 0
        const isUp = change >= 0
        const displayName = idx.entity_name.replace(/_/g, ' ')
        return (
          <Card key={idx.entity_name} className={`border-l-2 ${isUp ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
            <CardContent className="p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{displayName}</div>
              <div className="text-xl font-semibold tabular-nums mt-0.5">
                {price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </div>
              <div className={`text-xs font-medium tabular-nums mt-1 ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                <DirectionIcon direction={idx.price_change_direction} className="inline h-3 w-3 mr-0.5" />
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

type SortKey = 'entity_name' | 'latest_price' | 'price_change_pct' | 'price_change_direction'
type SortDir = 'asc' | 'desc'

function StockTable({ stocks }: { stocks: MarketDataStock[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('price_change_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const arr = [...stocks]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'entity_name') {
        cmp = a.entity_name.localeCompare(b.entity_name)
      } else if (sortKey === 'latest_price') {
        cmp = parseFloat(a.latest_price) - parseFloat(b.latest_price)
      } else if (sortKey === 'price_change_pct') {
        cmp = parseFloat(a.price_change_pct) - parseFloat(b.price_change_pct)
      } else {
        cmp = a.price_change_direction.localeCompare(b.price_change_direction)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [stocks, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'entity_name' ? 'asc' : 'desc')
    }
  }

  const SortIndicator = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className={`ml-1 text-[9px] ${active ? 'text-foreground' : 'text-muted-foreground/40'}`}>
      {dir === 'asc' ? '▲' : '▼'}
    </span>
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Stock Prices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('entity_name')}>
                  Entity <SortIndicator active={sortKey === 'entity_name'} dir={sortDir} />
                </th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Ticker</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('latest_price')}>
                  Price <SortIndicator active={sortKey === 'latest_price'} dir={sortDir} />
                </th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('price_change_pct')}>
                  7D Change <SortIndicator active={sortKey === 'price_change_pct'} dir={sortDir} />
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('price_change_direction')}>
                  Dir <SortIndicator active={sortKey === 'price_change_direction'} dir={sortDir} />
                </th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => {
                const change = parseFloat(stock.price_change_pct) || 0
                const price = parseFloat(stock.latest_price) || 0
                const changeColor = change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                const rowBg = change > 0 ? 'hover:bg-emerald-500/5' : change < 0 ? 'hover:bg-red-500/5' : 'hover:bg-muted/30'
                return (
                  <tr key={stock.entity_name} className={`border-b border-border/50 ${rowBg} transition-colors`}>
                    <td className="py-2 px-3 font-medium">{stock.entity_name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{stock.ticker}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${price.toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${changeColor}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <DirectionIcon direction={stock.price_change_direction} />
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatTimeAgo(stock.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function PriceMovementChart({ stocks }: { stocks: MarketDataStock[] }) {
  if (stocks.length === 0) return null

  const chartData = stocks.map((s) => ({
    name: s.ticker || s.entity_name,
    change: parseFloat(s.price_change_pct) || 0,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">7-Day Price Movement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(value) => { const v = Number(value); return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, '7D Change'] }}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="change" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.change >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MarketDataPage() {
  const { data, isLoading, error } = useMarketData()

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message="Failed to load market data" onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const stocks = data?.stocks ?? []
  const indices = data?.indices ?? []
  const sectors = data?.sectors ?? []
  const macro = data?.macro ?? null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Market Data</h2>
        {macro?.updated_at && (
          <span className="text-[10px] text-muted-foreground">
            Last refreshed: {formatTimeAgo(macro.updated_at)}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : (
        <>
          <MacroIndicatorsSection macro={macro} />

          <MarketSummaryCard stocks={stocks} macro={macro} />

          {indices.length > 0 && <IndexCards indices={indices} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <YieldCurveChart macro={macro} />
            <SectorPerformanceChart sectors={sectors} />
          </div>

          {stocks.length > 0 && (
            <>
              <StockTable stocks={stocks} />
              <PriceMovementChart stocks={stocks} />
            </>
          )}

          {stocks.length === 0 && indices.length === 0 && sectors.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No market data available yet. Market data appears after a sweep fetches stock information.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
