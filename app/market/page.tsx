'use client'

import { useState, useMemo } from 'react'
import { useMarketData } from '@/lib/hooks/useApiHooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'
import { MarketDataStock, MacroIndicators } from '@/types'
import { formatTimeAgo } from '@/lib/utils/format'
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${String(remSecs).padStart(2, '0')}s`
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
  if (direction === 'down') return <ArrowDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

function MacroCard({ label, value, unit, icon: Icon, color, sublabel }: {
  label: string
  value: string
  unit?: string
  icon: typeof Activity
  color: string
  sublabel?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-4.5 w-4.5" style={{ color }} />
          </div>
          <div className="flex-1">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['10Y Treasury', 'VIX', 'Fed Funds'].map((label) => (
          <Card key={label}>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No macro data available
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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MacroCard
          label="10Y Treasury"
          value={macro.dgs10}
          unit="%"
          icon={TrendingUp}
          color="#3b82f6"
          sublabel={dgs10 > 4.5 ? 'Elevated yields' : 'Moderate yields'}
        />
        <MacroCard
          label="VIX"
          value={macro.vix}
          icon={Activity}
          color={vixColor}
          sublabel={vixSub}
        />
        <MacroCard
          label="Fed Funds Rate"
          value={macro.fedfunds}
          unit="%"
          icon={DollarSign}
          color="#8b5cf6"
        />
      </div>
      {macro.updated_at && (
        <div className="text-[10px] text-muted-foreground text-right">
          Last updated: {formatTimeAgo(macro.updated_at)}
        </div>
      )}
    </div>
  )
}

type SortKey = 'entity_name' | 'latest_price' | 'price_change_pct'
type SortDir = 'asc' | 'desc'

function StockTable({ stocks }: { stocks: MarketDataStock[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('entity_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    const arr = [...stocks]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'entity_name') {
        cmp = a.entity_name.localeCompare(b.entity_name)
      } else if (sortKey === 'latest_price') {
        cmp = parseFloat(a.latest_price) - parseFloat(b.latest_price)
      } else {
        cmp = parseFloat(a.price_change_pct) - parseFloat(b.price_change_pct)
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
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Dir</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => {
                const change = parseFloat(stock.price_change_pct) || 0
                const price = parseFloat(stock.latest_price) || 0
                const changeColor = change >= 0 ? 'text-emerald-600' : 'text-red-600'
                return (
                  <tr key={stock.entity_name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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
    direction: s.price_change_direction,
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
                formatter={(value) => [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, '7D Change']}
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

function MarketSentimentSummary({ stocks }: { stocks: MarketDataStock[] }) {
  const up = stocks.filter((s) => parseFloat(s.price_change_pct) > 0).length
  const down = stocks.filter((s) => parseFloat(s.price_change_pct) < 0).length
  const flat = stocks.filter((s) => parseFloat(s.price_change_pct) === 0).length
  const avgChange = stocks.length > 0
    ? stocks.reduce((s, st) => s + (parseFloat(st.price_change_pct) || 0), 0) / stocks.length
    : 0
  const majorityUp = up > down

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${majorityUp ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            {majorityUp ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
          </div>
          <div>
            <div className="text-sm font-medium">
              Markets this week: <span className="text-emerald-600">{up} up</span>, <span className="text-red-600">{down} down</span>{flat > 0 && <span className="text-gray-400">, {flat} flat</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              Average change: <span className={avgChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>{avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%</span>
            </div>
          </div>
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Market Data</h2>
        {data?.macro?.updated_at && (
          <span className="text-[10px] text-muted-foreground">
            Last refreshed: {formatTimeAgo(data.macro.updated_at)}
          </span>
        )}
      </div>

      <MacroIndicatorsSection macro={data?.macro ?? null} />

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : (
        <>
          {data && data.stocks && data.stocks.length > 0 && (
            <>
              <MarketSentimentSummary stocks={data.stocks} />
              <StockTable stocks={data.stocks} />
              <PriceMovementChart stocks={data.stocks} />
            </>
          )}
          {data && (!data.stocks || data.stocks.length === 0) && (
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
