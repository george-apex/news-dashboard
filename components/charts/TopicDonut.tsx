'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TopicDistributionResponse, Topic } from '@/types'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { Skeleton } from '@/components/common/Skeleton'

interface TopicDonutProps {
  data?: TopicDistributionResponse
  loading?: boolean
  onTopicClick?: (topic: Topic) => void
}

export function TopicDonut({ data, loading, onTopicClick }: TopicDonutProps) {
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />
  if (!data || data.data.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">No data</div>

  const chartData = data.data.map((d) => ({
    name: d.topic,
    value: d.count,
    color: TOPIC_COLORS[d.topic],
  }))

  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="relative h-64" role="img" aria-label="Topic distribution donut chart showing article counts per topic">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            onClick={(d) => onTopicClick?.(d.name as Topic)}
            cursor="pointer"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value, name) => {
              const v = Number(value)
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0'
              return [`${v} (${pct}%)`, String(name)]
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-[10px] text-muted-foreground">Total</div>
        </div>
      </div>
    </div>
  )
}
