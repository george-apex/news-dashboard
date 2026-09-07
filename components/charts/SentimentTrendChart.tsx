'use client'

import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, Legend } from 'recharts'
import { SentimentTrendResponse, Topic } from '@/types'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { Skeleton } from '@/components/common/Skeleton'
import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SentimentTrendChartProps {
  data?: SentimentTrendResponse
  loading?: boolean
  topicFilter?: Topic | null
  onTopicChange?: (topic: Topic | null) => void
}

export function SentimentTrendChart({ data, loading, topicFilter, onTopicChange }: SentimentTrendChartProps) {
  const [localTopic, setLocalTopic] = useState<Topic | 'all'>('all')

  if (loading) return <Skeleton className="h-72 w-full rounded-lg" />
  if (!data || data.data.length === 0) return <div className="flex items-center justify-center h-72 text-sm text-muted-foreground">No data</div>

  const chartData = data.data.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
    sentiment: Number((d.avg_sentiment ?? 0).toFixed(3)),
    articles: d.article_count,
    positive: Math.max(Number((d.avg_sentiment ?? 0).toFixed(3)), 0),
    negative: Math.min(Number((d.avg_sentiment ?? 0).toFixed(3)), 0),
  }))

  const handleTopicChange = (v: string) => {
    const val = v === 'all' ? 'all' : (v as Topic)
    setLocalTopic(val)
    onTopicChange?.(val === 'all' ? null : val)
  }

  return (
    <div className="h-72">
      <div className="flex justify-end mb-2">
        <Select value={localTopic} onValueChange={handleTopicChange}>
          <SelectTrigger className="w-40 h-7 text-xs">
            <SelectValue placeholder="All Topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Topics</SelectItem>
            {(Object.entries(TOPIC_LABELS) as [Topic, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="sentGradPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="sentGradNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.02} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="sentiment" domain={[-1, 1]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="articles" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <ReferenceLine yAxisId="sentiment" y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value, name) => {
              const n = String(name)
              if (n === 'Avg Sentiment') return [Number(value).toFixed(3), n]
              if (n === 'Article Volume') return [value, n]
              return [value, n]
            }}
          />
          <Legend verticalAlign="top" height={28} iconType="line" />
          <Bar yAxisId="articles" dataKey="articles" name="Article Volume" fill="hsl(var(--muted))" opacity={0.25} radius={[2, 2, 0, 0]} />
          <Area yAxisId="sentiment" type="monotone" dataKey="positive" name="Avg Sentiment" stroke="#10b981" strokeWidth={0} fill="url(#sentGradPositive)" dot={false} />
          <Area yAxisId="sentiment" type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={0} fill="url(#sentGradNegative)" dot={false} />
          <Area yAxisId="sentiment" type="monotone" dataKey="sentiment" name="Avg Sentiment" stroke="#3b82f6" strokeWidth={2} fill="transparent" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
