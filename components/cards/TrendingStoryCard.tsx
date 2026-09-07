'use client'

import { Article } from '@/types'
import { SentimentDot } from '@/components/common/SentimentDot'
import { TopicBadge } from '@/components/common/TopicBadge'
import { Badge } from '@/components/common/Badge'
import { getCorroborationColor } from '@/lib/utils/colors'
import { formatTimeAgo } from '@/lib/utils/format'
import { ExternalLink } from 'lucide-react'

export function TrendingStoryCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/20 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.1)]"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-xs font-medium text-foreground line-clamp-2 flex-1">{article.title}</h4>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-30" />
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] text-muted-foreground">{article.source}</span>
        <span className="text-[10px] text-muted-foreground">•</span>
        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(article.date)}</span>
      </div>
      <div className="flex items-center gap-2">
        <TopicBadge topic={article.topic} />
        <Badge
          className="text-[9px]"
          style={{
            backgroundColor: `${getCorroborationColor(article.corroboration_score)}15`,
            color: getCorroborationColor(article.corroboration_score),
          }}
        >
          {article.corroboration_score.toUpperCase()}
        </Badge>
        <SentimentDot score={article.sentiment_score} />
        <span className="text-[10px] text-muted-foreground tabular-nums">{article.relevance_score}</span>
      </div>
      {article.summary && (
        <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">{article.summary}</p>
      )}
    </a>
  )
}
