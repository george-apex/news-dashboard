'use client'

import { EntitiesResponse } from '@/types'
import { getSentimentColor } from '@/lib/utils/colors'
import { Skeleton } from '@/components/common/Skeleton'

interface EntityCloudProps {
  data?: EntitiesResponse
  loading?: boolean
  onEntityClick?: (name: string) => void
}

export function EntityCloud({ data, loading, onEntityClick }: EntityCloudProps) {
  if (loading) return <Skeleton className="h-48 w-full rounded-lg" />
  if (!data || !data.entities || data.entities.length === 0) return <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No entities</div>

  const maxMentions = Math.max(...data.entities.map((e) => e.mention_count), 1)

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-4 min-h-[12rem]" role="img" aria-label="Entity cloud showing entities sized by mention count and colored by sentiment">
      {data.entities.filter((e) => e.mention_count > 0).slice(0, 50).map((entity) => {
        const size = 10 + Math.log2((entity.mention_count / maxMentions) * 32 + 1) * 5
        const color = getSentimentColor(entity.avg_sentiment)
        return (
          <button
            key={entity.name}
            className="transition-all hover:opacity-100 hover:scale-110"
            style={{
              fontSize: `${size}px`,
              color,
              opacity: 0.6 + (entity.mention_count / maxMentions) * 0.4,
              lineHeight: 1.2,
            }}
            onClick={() => onEntityClick?.(entity.name)}
            title={`${entity.name} · ${entity.mention_count} mentions · ${(entity.avg_sentiment ?? 0).toFixed(2)} sentiment`}
          >
            {entity.name}
          </button>
        )
      })}
    </div>
  )
}
