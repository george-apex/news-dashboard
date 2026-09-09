'use client'

import { EntityProfile } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { TopicBadge } from '@/components/common/TopicBadge'
import { ArrowUp, ArrowDown, Minus, CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div style={{ width: 80, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function CorrelationBadge({ correlation }: { correlation: EntityProfile['correlation'] }) {
  if (correlation === 'aligned') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Aligned
      </span>
    )
  }
  if (correlation === 'divergent') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        Divergent
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <MinusCircle className="h-3 w-3" />
      Neutral
    </span>
  )
}

export function EntityProfileCard({ profile, onHeadlineClick }: { profile: EntityProfile; onHeadlineClick?: (url: string) => void }) {
  const price = profile.latest_price
  const change = profile.price_change_pct
  const isUp = change > 0
  const isDown = change < 0
  const priceColor = isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-gray-500'
  const sentimentColor = profile.avg_sentiment > 0.1 ? 'text-emerald-600' : profile.avg_sentiment < -0.1 ? 'text-red-600' : 'text-gray-500'
  const sentimentTrendColor = profile.sentiment_trend.length >= 2
    ? (profile.sentiment_trend[profile.sentiment_trend.length - 1] || 0) >= (profile.sentiment_trend[0] || 0) ? '#10b981' : '#ef4444'
    : '#6b7280'
  const priceTrendColor = profile.price_trend.length >= 2
    ? (profile.price_trend[profile.price_trend.length - 1] || 0) >= (profile.price_trend[0] || 0) ? '#10b981' : '#ef4444'
    : '#6b7280'

  const DirectionIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{profile.name}</span>
              {profile.ticker && <span className="text-xs text-muted-foreground">({profile.ticker})</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span>{profile.mention_count} article{profile.mention_count !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span className={sentimentColor}>
                Sentiment: {profile.avg_sentiment >= 0 ? '+' : ''}{profile.avg_sentiment.toFixed(2)}
              </span>
            </div>
            {profile.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.topics.slice(0, 3).map((t) => (
                  <TopicBadge key={t} topic={t as any} />
                ))}
              </div>
            )}
          </div>
          {price > 0 && (
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold tabular-nums">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`flex items-center justify-end gap-0.5 text-xs font-medium tabular-nums ${priceColor}`}>
                <DirectionIcon className="h-3 w-3" />
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {profile.top_headlines.length > 0 && (
          <div className="space-y-1">
            {profile.top_headlines.slice(0, 3).map((h, i) => (
              <button
                key={i}
                onClick={() => onHeadlineClick?.(h.url)}
                className="block w-full text-left text-[11px] hover:text-primary transition-colors"
              >
                <span className="line-clamp-1">{h.title}</span>
                <span className="text-[9px] text-muted-foreground ml-1">rel: {Math.round(h.relevance_score)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-4 pt-2 border-t border-border">
          <div>
            <div className="text-[9px] text-muted-foreground mb-0.5">Sentiment (7D)</div>
            <Sparkline data={profile.sentiment_trend} color={sentimentTrendColor} />
          </div>
          {profile.price_trend.length >= 2 && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-0.5">Price (7D)</div>
              <Sparkline data={profile.price_trend} color={priceTrendColor} />
            </div>
          )}
          <div className="ml-auto">
            <CorrelationBadge correlation={profile.correlation} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
