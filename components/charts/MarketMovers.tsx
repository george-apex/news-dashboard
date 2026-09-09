'use client'

import { MarketDataStock } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MarketMoversProps {
  stocks?: MarketDataStock[]
  loading?: boolean
  onEntityClick?: (name: string) => void
}

export function MarketMovers({ stocks, loading, onEntityClick }: MarketMoversProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No market data available
      </div>
    )
  }

  const sorted = [...stocks].sort(
    (a, b) => Math.abs(parseFloat(b.price_change_pct) || 0) - Math.abs(parseFloat(a.price_change_pct) || 0)
  )

  const gainers = sorted
    .filter((s) => parseFloat(s.price_change_pct) > 0)
    .slice(0, 3)
  const losers = sorted
    .filter((s) => parseFloat(s.price_change_pct) < 0)
    .slice(0, 3)

  const formatPrice = (val: string) => {
    const n = parseFloat(val)
    return isNaN(n) ? '—' : `$${n.toFixed(2)}`
  }

  const formatPct = (val: string) => {
    const n = parseFloat(val)
    return isNaN(n) ? '0.00' : n.toFixed(2)
  }

  return (
    <div className="space-y-3">
      {gainers.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Gainers (7D)</div>
          <div className="space-y-1">
            {gainers.map((s) => (
              <button
                key={s.entity_name}
                onClick={() => onEntityClick?.(s.entity_name)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-500/5 transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1 truncate">
                  {s.ticker || s.entity_name}
                </span>
                <span className="text-xs text-emerald-600 font-medium tabular-nums">
                  +{formatPct(s.price_change_pct)}%
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatPrice(s.latest_price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Losers (7D)</div>
          <div className="space-y-1">
            {losers.map((s) => (
              <button
                key={s.entity_name}
                onClick={() => onEntityClick?.(s.entity_name)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-red-500/5 transition-colors"
              >
                <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1 truncate">
                  {s.ticker || s.entity_name}
                </span>
                <span className="text-xs text-red-600 font-medium tabular-nums">
                  {formatPct(s.price_change_pct)}%
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatPrice(s.latest_price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {gainers.length === 0 && losers.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-4">
          No significant movers
        </div>
      )}
    </div>
  )
}
