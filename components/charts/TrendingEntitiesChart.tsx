'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { TrendingEntitiesResponse } from '@/types'
import { Skeleton } from '@/components/common/Skeleton'

interface TrendingEntitiesChartProps {
  data?: TrendingEntitiesResponse
  loading?: boolean
}

export function TrendingEntitiesChart({ data, loading }: TrendingEntitiesChartProps) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />
  if (!data || !data.entities || data.entities.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">No trending entities</div>

  const chartData = data.entities
    .sort((a, b) => b.trend_delta - a.trend_delta)
    .slice(0, 15)
    .map((e) => ({
      name: (e.name || '').length > 20 ? (e.name || '').slice(0, 18) + '…' : (e.name || ''),
      delta: e.trend_delta,
      fill: e.trend_delta >= 0 ? '#10b981' : '#ef4444',
      type: e.type,
      mentions: e.mention_count,
    }))

  return (
    <div className="h-64" role="img" aria-label="Trending entities chart showing top entities by trend delta">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 10, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={75} stroke="hsl(var(--muted-foreground))" />
          <ReferenceLine x={0} stroke="hsl(var(--border))" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value, _name, props) => {
              const p = props.payload as { type: string; mentions: number }
              return [value, `${p.type} · ${p.mentions} mentions`]
            }}
          />
          <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
