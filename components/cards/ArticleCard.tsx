'use client'

import { ExternalLink, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { Article, CorroborationLevel, MarketDataStock, MacroIndicators } from '@/types'
import { SentimentDot } from '@/components/common/SentimentDot'
import { RelevanceBar } from '@/components/common/RelevanceBar'
import { TopicBadge } from '@/components/common/TopicBadge'
import { SourceBadge } from '@/components/common/SourceBadge'
import { Badge } from '@/components/common/Badge'
import { getCorroborationColor } from '@/lib/utils/colors'
import { formatTimeAgo } from '@/lib/utils/format'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/api/client'

const CORROBORATION_LABELS: Record<CorroborationLevel, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />
  if (direction === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-gray-400" />
}

function MarketContextPanel({ articleId }: { articleId: string }) {
  const { data, isLoading } = useApi<{
    id: string
    market_context: {
      stocks: MarketDataStock[]
      macro: MacroIndicators | null
    } | null
  } | null>(`/articles/${articleId}`)

  if (isLoading) {
    return <div className="h-8 bg-muted animate-pulse rounded mt-2" />
  }

  const context = data?.market_context
  if (!context || context.stocks.length === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="text-[10px] text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
        <Activity className="h-3 w-3" /> Market Context
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {context.stocks.map((stock) => {
          const change = parseFloat(stock.price_change_pct) || 0
          const price = parseFloat(stock.latest_price) || 0
          return (
            <div key={stock.entity_name} className="flex items-center gap-1.5 text-[10px]">
              <span className="font-medium">{stock.ticker || stock.entity_name}</span>
              <span className="text-muted-foreground">${price.toFixed(2)}</span>
              <span className={change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
              <DirectionIcon direction={stock.price_change_direction} />
            </div>
          )
        })}
      </div>
      {context.macro && (
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span>VIX: <span className={parseFloat(context.macro.vix) < 20 ? 'text-emerald-600' : parseFloat(context.macro.vix) > 30 ? 'text-red-600' : 'text-amber-600'}>{context.macro.vix}</span></span>
          <span>10Y: {context.macro.dgs10}%</span>
          <span>Fed: {context.macro.fedfunds}%</span>
        </div>
      )}
    </div>
  )
}

export function ArticleCard({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.1)]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex-1"
        >
          {article.title}
          <ExternalLink className="inline h-3 w-3 ml-1 opacity-40" />
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SourceBadge sourceType={article.source_type} />
        <span className="text-[10px] text-muted-foreground">{article.source}</span>
        <span className="text-[10px] text-muted-foreground">•</span>
        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(article.date)}</span>
        <TopicBadge topic={article.topic} />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Sentiment:</span>
          <SentimentDot score={article.sentiment_score} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Relevance:</span>
          <RelevanceBar score={article.relevance_score} />
        </div>
        <Badge
          className="text-[10px]"
          style={{
            backgroundColor: `${getCorroborationColor(article.corroboration_score)}15`,
            color: getCorroborationColor(article.corroboration_score),
          }}
        >
          {(() => {
            const cs = article.corroboration_score
            if (typeof cs === 'string') return CORROBORATION_LABELS[cs] ?? cs.toUpperCase()
            if (typeof cs === 'number') return cs >= 0.7 ? 'HIGH' : cs >= 0.4 ? 'MED' : 'LOW'
            return '—'
          })()}
          {article.source_count > 0 && ` (${article.source_count})`}
        </Badge>
      </div>

      {article.entities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {article.entities.map((e) => (
            <button key={e.name} onClick={() => router.push(`/feed?entity=${encodeURIComponent(e.name)}`)} className="rounded-md bg-secondary/50 px-1.5 py-0.5 text-[10px] text-secondary-foreground cursor-pointer hover:bg-secondary">
              {e.name}
            </button>
          ))}
        </div>
      )}

      {article.summary && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          {expanded && (
            <>
              {article.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {article.summary}
                </p>
              )}
              {article.entities.length > 0 && (
                <MarketContextPanel articleId={article.id} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
