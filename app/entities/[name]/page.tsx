'use client'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'
import { RelevanceBar } from '@/components/common/RelevanceBar'
import { TopicBadge } from '@/components/common/TopicBadge'
import { ArrowUp, ArrowDown, Minus, CheckCircle2, AlertTriangle, MinusCircle, ArrowLeft, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts'
import { OHLCVChart } from '@/components/charts/OHLCVChart'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function CorrelationCard({ correlation, signalStrength, correlationRaw }: { correlation: string; signalStrength: string; correlationRaw: number }) {
  const corrIcon = correlation === 'aligned' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    : correlation === 'divergent' ? <AlertTriangle className="h-4 w-4 text-amber-600" />
    : <MinusCircle className="h-4 w-4 text-muted-foreground" />
  const corrColor = correlation === 'aligned' ? 'text-emerald-600' : correlation === 'divergent' ? 'text-amber-600' : 'text-muted-foreground'
  const strengthColor = signalStrength === 'strong' ? 'bg-emerald-100 text-emerald-700' : signalStrength === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Correlation</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          {corrIcon}
          <span className={`text-sm font-medium capitalize ${corrColor}`}>{correlation}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Signal:</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${strengthColor}`}>{signalStrength}</span>
        </div>
        <div className="text-xs text-muted-foreground">Raw: {correlationRaw.toFixed(3)}</div>
      </CardContent>
    </Card>
  )
}

function SentimentTimeline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <div className="text-xs text-muted-foreground p-4">No sentiment data available</div>
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis dataKey="i" hide />
          <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} width={30} />
          <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'Sentiment']} />
          <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function PriceChart({ priceTrend, headlines, ohlcv }: { priceTrend: number[]; headlines: { title: string; url: string; relevance_score: number }[]; ohlcv?: string }) {
  if (ohlcv && ohlcv.includes(',')) {
    return <OHLCVChart csvData={ohlcv} headlines={headlines} />
  }
  if (!priceTrend || priceTrend.length < 2) return <div className="text-xs text-muted-foreground p-4">No price data available</div>
  const chartData = priceTrend.map((v, i) => ({ i, v }))
  const lastVal = priceTrend[priceTrend.length - 1] || 0
  const firstVal = priceTrend[0] || 0
  const color = lastVal >= firstVal ? '#10b981' : '#ef4444'

  const eventIdx = headlines.length > 0 ? Math.min(Math.floor(priceTrend.length * 0.7), priceTrend.length - 1) : -1

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis dataKey="i" hide />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
          {eventIdx >= 0 && (
            <ReferenceDot x={eventIdx} y={priceTrend[eventIdx]} r={4} fill="#6366f1" stroke="white" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function EntityDetailPage() {
  const params = useParams()
  const name = decodeURIComponent(params.name as string)

  const { data, error, isLoading } = useSWR(`/api/entities/${encodeURIComponent(name)}`, fetcher)

  if (error) return <div className="p-6"><ErrorState message="Failed to load entity." onRetry={() => window.location.reload()} /></div>
  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}</div>

  const dashboard = data?.data
  if (!dashboard?.profile) return <div className="p-6"><ErrorState message="Entity not found." /></div>

  const profile = dashboard.profile
  const articles = dashboard.articles || []
  const related = dashboard.relatedEntities || []
  const isUp = profile.price_change_direction === 'up'
  const isDown = profile.price_change_direction === 'down'
  const priceColor = isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-gray-500'
  const DirectionIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus
  const sentimentColor = profile.avg_sentiment > 0.3 ? 'bg-emerald-100 text-emerald-700' : profile.avg_sentiment < -0.3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/entities" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{profile.name}</h1>
            {profile.ticker && <span className="text-sm text-muted-foreground">({profile.ticker})</span>}
            <span className="text-[10px] px-1.5 py-0.5 rounded capitalize bg-blue-100 text-blue-700">{profile.tier} tier</span>
            {profile.sector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{profile.sector}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{profile.mention_count} articles</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${sentimentColor}`}>
              Sentiment: {profile.avg_sentiment >= 0 ? '+' : ''}{profile.avg_sentiment.toFixed(2)}
            </span>
          </div>
        </div>
        {profile.latest_price > 0 && (
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">${profile.latest_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums ${priceColor}`}>
              <DirectionIcon className="h-3.5 w-3.5" />
              {profile.price_change_pct >= 0 ? '+' : ''}{profile.price_change_pct.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {profile.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.topics.map((t: string) => <TopicBadge key={t} topic={t as any} />)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Price Trend</CardTitle></CardHeader>
            <CardContent>
              <PriceChart priceTrend={profile.price_trend} headlines={profile.top_headlines} ohlcv={dashboard.marketData?.ohlcv_7d} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sentiment Timeline</CardTitle></CardHeader>
            <CardContent>
              <SentimentTimeline data={profile.sentiment_trend} />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <CorrelationCard correlation={profile.correlation} signalStrength={profile.signal_strength} correlationRaw={profile.correlation_raw} />
          {related.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Related Entities</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {related.map((name: string) => (
                    <Link key={name} href={`/entities/${encodeURIComponent(name)}`} className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors">
                      {name}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {articles.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Articles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {articles.slice(0, 10).map((a: any) => (
              <div key={a.id || a.url} className="flex items-start gap-2 text-sm">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:text-primary transition-colors line-clamp-1">
                  {a.title}
                </a>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{a.source}</span>
                <RelevanceBar score={Number(a.relevance_score) || 0} className="shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
