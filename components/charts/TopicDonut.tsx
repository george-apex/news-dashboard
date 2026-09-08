'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TopicDistributionResponse, Topic } from '@/types'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { Skeleton } from '@/components/common/Skeleton'

interface TopicDonutProps {
  data?: TopicDistributionResponse
  loading?: boolean
  onTopicClick?: (topic: Topic) => void
  compact?: boolean
}

export function TopicDonut({ data, loading, onTopicClick, compact }: TopicDonutProps) {
  if (loading) return <Skeleton className={compact ? 'h-40 w-full rounded-lg' : 'h-64 w-full rounded-lg'} />
  if (!data || data.data.length === 0) return <div className={`flex items-center justify-center ${compact ? 'h-40' : 'h-64'} text-sm text-muted-foreground`}>No data</div>

  const chartData = data.data.map((d) => ({
    name: d.topic,
    value: d.count,
    color: TOPIC_COLORS[d.topic],
  }))

  const total = chartData.reduce((s, d) => s + d.value, 0)
  const innerR = compact ? 40 : 60
  const outerR = compact ? 65 : 90
  const containerH = compact ? 140 : 256

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: containerH, height: containerH }} role="img" aria-label="Topic distribution donut chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
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
              <div className="text-lg font-bold tabular-nums">{total}</div>
              <div className="text-[9px] text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          {chartData.map((d) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0'
            return (
              <button
                key={d.name}
                onClick={() => onTopicClick?.(d.name as Topic)}
                className="flex items-center gap-2 w-full text-left hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
              >
                <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] text-foreground truncate flex-1">{TOPIC_LABELS[d.name as Topic] || d.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-64" role="img" aria-label="Topic distribution donut chart showing article counts per topic">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerR}
            outerRadius={outerR}
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
