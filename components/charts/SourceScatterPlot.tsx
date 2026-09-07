'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts'
import { SourceQualityResponse } from '@/types'
import { SOURCE_TYPE_COLORS } from '@/lib/utils/colors'
import { Skeleton } from '@/components/common/Skeleton'

interface SourceScatterPlotProps {
  data?: SourceQualityResponse
  loading?: boolean
}

export function SourceScatterPlot({ data, loading }: SourceScatterPlotProps) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />
  if (!data || data.sources.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">No data</div>

  const chartData = data.sources.map((s) => ({
    name: s.source,
    relevance: s.avg_relevance,
    sentiment: s.avg_sentiment,
    size: s.total_articles,
    type: s.source_type,
  }))

  return (
    <div className="h-64" role="img" aria-label="Source quality scatter plot with relevance on X axis and sentiment on Y axis">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
          <XAxis dataKey="relevance" name="Relevance" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
          <YAxis dataKey="sentiment" name="Sentiment" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[-1, 1]} />
          <ZAxis dataKey="size" range={[50, 500]} />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value, name) => [Number(value).toFixed(2), String(name)]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
          />
          <Scatter data={chartData}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={SOURCE_TYPE_COLORS[entry.type as keyof typeof SOURCE_TYPE_COLORS] || '#64748b'}
                opacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
