'use client'

import { SourceQualityResponse } from '@/types'

export function SourceQualityTable({ data }: { data?: SourceQualityResponse }) {
  if (!data || data.sources.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No source quality data</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground font-medium">Source</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Articles</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Avg Relevance</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Avg Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {data.sources.map((source) => (
            <tr key={source.source} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="p-2 text-foreground font-medium">{source.source}</td>
              <td className="p-2 text-muted-foreground">{source.source_type}</td>
              <td className="p-2 text-foreground tabular-nums">{source.total_articles}</td>
              <td className="p-2 tabular-nums">{(source.avg_relevance ?? 0).toFixed(1)}</td>
              <td className="p-2 tabular-nums">{(source.avg_sentiment ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
