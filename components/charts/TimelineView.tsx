'use client'

import { Article } from '@/types'
import { SentimentDot } from '@/components/common/SentimentDot'
import { TopicBadge } from '@/components/common/TopicBadge'
import { SourceBadge } from '@/components/common/SourceBadge'
import { Badge } from '@/components/common/Badge'
import { RelevanceBar } from '@/components/common/RelevanceBar'
import { getCorroborationColor } from '@/lib/utils/colors'
import { formatDate } from '@/lib/utils/format'
import { format } from 'date-fns'
import { parseISO } from 'date-fns'
import { Skeleton } from '@/components/common/Skeleton'

interface TimelineViewProps {
  articles?: Article[]
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

export function TimelineView({ articles, loading, onLoadMore, hasMore }: TimelineViewProps) {
  if (loading) {
    return (
      <div className="space-y-4" role="img" aria-label="Article timeline">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="pl-6">
            <Skeleton className="h-4 w-3/4 mb-2 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!articles || articles.length === 0) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No articles</div>
  }

  const grouped = articles.reduce<Record<string, Article[]>>((acc, article) => {
    const day = format(parseISO(article.date), 'yyyy-MM-dd')
    if (!acc[day]) acc[day] = []
    acc[day].push(article)
    return acc
  }, {})

  return (
    <div className="space-y-6" role="img" aria-label="Article timeline showing chronological list of articles">
      {Object.entries(grouped).map(([date, arts]) => (
        <div key={date}>
          <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm py-1.5 border-b border-border mb-3">
            <span className="text-xs font-medium text-muted-foreground">{formatDate(date)}</span>
          </div>
          <div className="space-y-3">
            {arts.map((article) => (
              <div
                key={article.id}
                className="relative pl-6 pb-3 border-l-2 border-border last:border-l-primary/30"
              >
                <div className="absolute left-[-5px] top-2 h-2 w-2 rounded-full bg-primary/50" />
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {article.title}
                </a>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <SourceBadge sourceType={article.source_type} />
                  <span className="text-[10px] text-muted-foreground">{article.source}</span>
                  <TopicBadge topic={article.topic} />
                  <SentimentDot score={article.sentiment_score} />
                  <Badge
                    className="text-[9px]"
                    style={{
                      backgroundColor: `${getCorroborationColor(article.corroboration_score)}15`,
                      color: getCorroborationColor(article.corroboration_score),
                    }}
                  >
                    {article.corroboration_score.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <RelevanceBar score={article.relevance_score} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            className="text-xs text-primary hover:underline"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
