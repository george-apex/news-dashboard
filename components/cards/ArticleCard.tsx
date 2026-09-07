'use client'

import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Article, CorroborationLevel } from '@/types'
import { SentimentDot } from '@/components/common/SentimentDot'
import { RelevanceBar } from '@/components/common/RelevanceBar'
import { TopicBadge } from '@/components/common/TopicBadge'
import { SourceBadge } from '@/components/common/SourceBadge'
import { Badge } from '@/components/common/Badge'
import { getCorroborationColor } from '@/lib/utils/colors'
import { formatTimeAgo } from '@/lib/utils/format'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CORROBORATION_LABELS: Record<CorroborationLevel, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
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
            {expanded ? 'Hide summary' : 'Show summary'}
          </button>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {article.summary}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
