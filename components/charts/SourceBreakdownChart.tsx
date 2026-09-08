'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { SourcesResponse, SourceType } from '@/types'
import { SOURCE_TYPE_COLORS } from '@/lib/utils/colors'
import { SOURCE_TYPE_LABELS } from '@/lib/utils/constants'
import { Skeleton } from '@/components/common/Skeleton'

const SOURCE_TYPES: SourceType[] = ['rss', 'api', 'reddit', 'arxiv', 'tavily']

interface SourceBreakdownChartProps {
  data?: SourcesResponse
  loading?: boolean
  onSourceClick?: (source: string) => void
}

export function SourceBreakdownChart({ data, loading, onSourceClick }: SourceBreakdownChartProps) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />
  if (!data || !data.data || data.data.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">No data</div>

  const sourceMap = new Map<string, { source: string; total: number; avg_relevance: number; avg_sentiment: number; byType: Record<string, number> }>()

  for (const d of data.data) {
    const existing = sourceMap.get(d.source)
    if (existing) {
      existing.total += d.count
      existing.avg_relevance = (existing.avg_relevance + d.avg_relevance) / 2
      existing.avg_sentiment = (existing.avg_sentiment + d.avg_sentiment) / 2
      existing.byType[d.source_type] = (existing.byType[d.source_type] || 0) + d.count
    } else {
      sourceMap.set(d.source, {
        source: d.source,
        total: d.count,
        avg_relevance: d.avg_relevance,
        avg_sentiment: d.avg_sentiment,
        byType: { [d.source_type]: d.count },
      })
    }
  }

  const chartData = Array.from(sourceMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((d) => {
      const row: Record<string, string | number> = {
        name: (d.source || '').length > 20 ? (d.source || '').slice(0, 18) + '…' : (d.source || ''),
        fullName: d.source,
        total: d.total,
        avg_relevance: d.avg_relevance,
        avg_sentiment: d.avg_sentiment,
      }
      for (const st of SOURCE_TYPES) {
        row[st] = d.byType[st] || 0
      }
      return row
    })

  return (
    <div className="h-64" role="img" aria-label="Source breakdown chart showing article counts per source, stacked by source type">
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 10, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={75} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value, name, props) => {
              const p = props.payload as Record<string, string | number>
              return [value, `${String(name)} · Relevance: ${Number(p.avg_relevance).toFixed(1)}, Sentiment: ${Number(p.avg_sentiment).toFixed(2)}`]
            }}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
          {SOURCE_TYPES.map((st) => (
            <Bar
              key={st}
              dataKey={st}
              stackId="a"
              fill={SOURCE_TYPE_COLORS[st]}
              name={SOURCE_TYPE_LABELS[st] || st}
              cursor="pointer"
              onClick={(d) => onSourceClick?.(String(d?.payload?.fullName ?? ''))}
              radius={st === SOURCE_TYPES[SOURCE_TYPES.length - 1] ? [0, 4, 4, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
