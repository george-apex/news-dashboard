'use client'

import { EntityStat } from '@/types'
import { SentimentDot } from '@/components/common/SentimentDot'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils/format'

export function EntityTable({ entities }: { entities: EntityStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Mentions</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Avg Sentiment</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Topics</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Trend</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr key={entity.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="p-2 text-foreground font-medium">{entity.name}</td>
              <td className="p-2 text-muted-foreground capitalize">{entity.type}</td>
              <td className="p-2 text-foreground tabular-nums">{entity.mention_count}</td>
              <td className="p-2">
                <div className="flex items-center gap-1.5">
                  <SentimentDot score={entity.avg_sentiment} />
                  <span className="tabular-nums">{(entity.avg_sentiment ?? 0).toFixed(2)}</span>
                </div>
              </td>
              <td className="p-2 text-muted-foreground">{entity.topics.length} topics</td>
              <td className="p-2">
                <div className="flex items-center gap-1">
                  {entity.trend_direction === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                  {entity.trend_direction === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                  {entity.trend_direction === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                  <span className={entity.trend_direction === 'up' ? 'text-emerald-500' : entity.trend_direction === 'down' ? 'text-red-500' : 'text-muted-foreground'}>
                    {entity.trend_direction}
                  </span>
                </div>
              </td>
              <td className="p-2 text-muted-foreground">{formatTimeAgo(entity.last_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
