'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { RelevanceSlider } from '@/components/filters/RelevanceSlider'
import { ArrowUp, ArrowDown, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const TOPIC_COLORS: Record<string, string> = {
  capital_markets: '#6366f1',
  ai_industry: '#10b981',
  ai_sovereignty: '#f59e0b',
  open_weight: '#ef4444',
  agentic_ai: '#8b5cf6',
  ai_fintech: '#06b6d4',
  ai_regulation: '#ec4899',
}

function SignalBoard({ relevance }: { relevance: number }) {
  const { data, error, isLoading } = useSWR(`/api/signals?relevance=${relevance}`, fetcher, { refreshInterval: 120000 })

  if (error) return <ErrorState message="Failed to load signals." onRetry={() => window.location.reload()} />
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>

  const signals = data?.data || []
  if (signals.length === 0) return <EmptyState message="No divergence signals detected at this threshold." />

  return (
    <div className="space-y-2">
      {signals.map((s: any) => {
        const isNeg = s.divergenceType === 'negative_news_rising_price'
        const borderColor = isNeg ? 'border-l-amber-500' : 'border-l-emerald-500'
        return (
          <Card key={s.entity} className={`border-l-4 ${borderColor}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/entities/${encodeURIComponent(s.entity)}`} className="text-sm font-medium hover:text-primary transition-colors">
                    {s.entity}
                  </Link>
                  {s.ticker && <span className="text-xs text-muted-foreground ml-1">({s.ticker})</span>}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isNeg ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isNeg ? 'Neg News / Up Price' : 'Pos News / Down Price'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{s.divergenceDescription}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>Mentions: {s.mention_count}</span>
                <span>Signal: {s.signal_strength}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MoversTable({ relevance }: { relevance: number }) {
  const { data, error, isLoading } = useSWR(`/api/signals?view=movers&relevance=${relevance}`, fetcher, { refreshInterval: 120000 })

  if (error) return <ErrorState message="Failed to load movers." onRetry={() => window.location.reload()} />
  if (isLoading) return <div className="h-48 rounded-lg bg-muted animate-pulse" />

  const movers = data?.data || []
  if (movers.length === 0) return <EmptyState message="No movers data available." />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 px-2">Entity</th>
            <th className="text-right py-2 px-2">Price %</th>
            <th className="text-right py-2 px-2">Mentions</th>
            <th className="text-right py-2 px-2">Sentiment</th>
            <th className="text-right py-2 px-2">Score</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((m: any) => {
            const isUp = m.price_change_direction === 'up'
            return (
              <tr key={m.name} className="border-b hover:bg-muted/50">
                <td className="py-1.5 px-2">
                  <Link href={`/entities/${encodeURIComponent(m.name)}`} className="hover:text-primary transition-colors">
                    {m.name} {m.ticker && <span className="text-muted-foreground">({m.ticker})</span>}
                  </Link>
                </td>
                <td className={`text-right py-1.5 px-2 tabular-nums ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {m.price_change_pct >= 0 ? '+' : ''}{m.price_change_pct.toFixed(2)}%
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums">{m.mention_count}</td>
                <td className="text-right py-1.5 px-2 tabular-nums">{m.avg_sentiment.toFixed(2)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums font-medium">{m.mover_score.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ScatterWidget() {
  const { data, error, isLoading } = useSWR('/api/signals?view=scatter', fetcher, { refreshInterval: 120000 })

  if (error) return <ErrorState message="Failed to load scatter data." onRetry={() => window.location.reload()} />
  if (isLoading) return <div className="h-64 rounded-lg bg-muted animate-pulse" />

  const scatter = data?.data || []
  if (scatter.length === 0) return <EmptyState message="No scatter data available." />

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <XAxis type="number" dataKey="avg_sentiment" name="Sentiment" domain={[-1, 1]} tick={{ fontSize: 10 }} label={{ value: 'Sentiment', position: 'bottom', offset: -5, fontSize: 10 }} />
          <YAxis type="number" dataKey="total_count" name="Articles" tick={{ fontSize: 10 }} label={{ value: 'Articles', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <ZAxis type="number" dataKey="total_count" range={[50, 500]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(val: any, name: any) => [name === 'Sentiment' ? Number(val).toFixed(2) : val, String(name)]} />
          <Scatter data={scatter} fill="#6366f1">
            {scatter.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.entity ? '#6366f1' : '#9ca3af'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function SignalsContent() {
  const searchParams = useSearchParams()
  const relevance = Number(searchParams.get('relevance') || 75)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Signal Dashboard</h1>
        <div className="ml-auto">
          <RelevanceSlider />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Divergence Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SignalBoard relevance={relevance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-emerald-500" /> News-Driven Movers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MoversTable relevance={relevance} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Entity Distribution (Sentiment × Article Count)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScatterWidget />
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignalsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}</div></div>}>
      <SignalsContent />
    </Suspense>
  )
}
