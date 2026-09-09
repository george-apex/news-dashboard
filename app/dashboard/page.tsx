'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTopicStats, useTrendingArticles, useSentimentTrend, useTopicDistribution, useSources, useEntities, useTrendingEntities, useCorroborationHeatmap, useMarketData, useSweeps } from '@/lib/hooks/useApiHooks'
import { KPICard } from '@/components/cards/KPICard'
import { TrendingStoryCard } from '@/components/cards/TrendingStoryCard'
import { TopicDonut } from '@/components/charts/TopicDonut'
import { SentimentTrendChart } from '@/components/charts/SentimentTrendChart'
import { EntityCloud } from '@/components/charts/EntityCloud'
import { SourceBreakdownChart } from '@/components/charts/SourceBreakdownChart'
import { CorroborationHeatmap } from '@/components/charts/CorroborationHeatmap'
import { TrendingEntitiesChart } from '@/components/charts/TrendingEntitiesChart'
import { MarketMovers } from '@/components/charts/MarketMovers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'
import { CheckCircle, Loader2, Clock, SkipForward, XCircle } from 'lucide-react'

type TimeRange = '24h' | '7d' | '14d' | '30d' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

function getDateRange(range: TimeRange): { from?: string; to?: string } {
  if (range === 'all') return {}
  const now = new Date()
  const from = new Date()
  switch (range) {
    case '24h': from.setDate(now.getDate() - 1); break
    case '7d': from.setDate(now.getDate() - 7); break
    case '14d': from.setDate(now.getDate() - 14); break
    case '30d': from.setDate(now.getDate() - 30); break
  }
  return { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function DashboardPage() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const { from, to } = useMemo(() => getDateRange(timeRange), [timeRange])

  const { data: topicStats, error: statsError } = useTopicStats()
  const { data: topArticles, isLoading: articlesLoading } = useTrendingArticles(5)
  const { data: sentimentData, isLoading: sentimentLoading } = useSentimentTrend(undefined, from, to)
  const { data: topicDist, isLoading: distLoading } = useTopicDistribution()
  const { data: sourceData, isLoading: sourceLoading } = useSources()
  const { data: entityData, isLoading: entityLoading } = useEntities(undefined, undefined, 'mentions', 50)
  const { data: trendingData, isLoading: trendingLoading } = useTrendingEntities()
  const { data: heatmapData, isLoading: heatmapLoading } = useCorroborationHeatmap(from, to)
  const { data: marketData } = useMarketData()
  const { data: sweepsData } = useSweeps(1, 20)

  const totalArticles = topicStats?.topics?.reduce((s, t) => s + t.article_count, 0) ?? 0
  const highCorr = topicStats?.topics?.reduce((s, t) => s + t.high_corroboration_count, 0) ?? 0
  const avgSentiment = topicStats?.topics?.length
    ? topicStats.topics.reduce((s, t) => s + t.avg_sentiment, 0) / topicStats.topics.length
    : 0
  const sentimentLabel = avgSentiment >= 0.3 ? 'Positive' : avgSentiment <= -0.3 ? 'Negative' : 'Neutral'

  const sortedStocks = marketData?.stocks
    ? [...(marketData.stocks ?? [])].sort((a, b) => parseFloat(b.price_change_pct) - parseFloat(a.price_change_pct))
    : []
  const topGainers = sortedStocks.filter((s) => parseFloat(s.price_change_pct) > 0).slice(0, 3)
  const topLosers = sortedStocks.filter((s) => parseFloat(s.price_change_pct) < 0).reverse().slice(0, 3)

  const runningSweep = sweepsData?.sweeps?.find((s) => s.status === 'running')

  return (
    <div className="p-6 space-y-6">
      {statsError && (
        <ErrorState message="Failed to load dashboard data. Please check your connection." onRetry={() => window.location.reload()} />
      )}

      {marketData?.macro && (
        <div className="flex items-center gap-4 text-xs px-1">
          <span className="text-muted-foreground">VIX:</span>
          <span className={parseFloat(marketData.macro.vix) < 20 ? 'text-emerald-600 font-medium' : parseFloat(marketData.macro.vix) > 30 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
            {marketData.macro.vix}
          </span>
          <span className="text-muted-foreground">10Y:</span>
          <span className="text-foreground font-medium">{marketData.macro.dgs10}%</span>
          <span className="text-muted-foreground">Fed:</span>
          <span className="text-foreground font-medium">{marketData.macro.fedfunds}%</span>
        </div>
      )}

      {runningSweep && runningSweep.pipeline_stages && runningSweep.pipeline_stages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs">
          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          <span className="text-blue-700 dark:text-blue-400 font-medium">Pipeline running:</span>
          {runningSweep.pipeline_stages.map((stage, i) => {
            const icon = stage.status === 'completed' ? <CheckCircle className="h-3 w-3 text-emerald-500" />
              : stage.status === 'running' ? <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              : stage.status === 'failed' ? <XCircle className="h-3 w-3 text-red-500" />
              : stage.status === 'skipped' ? <SkipForward className="h-3 w-3 text-amber-500" />
              : <Clock className="h-3 w-3 text-gray-400" />
            return (
              <span key={i} className="flex items-center gap-1">
                {icon}
                <span className={stage.status === 'running' ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>{stage.label}</span>
                {i < (runningSweep.pipeline_stages?.length ?? 0) - 1 && <span className="text-muted-foreground mx-0.5">→</span>}
              </span>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Topic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <TopicDonut
                data={topicDist}
                loading={distLoading}
                compact
                onTopicClick={(topic) => router.push(`/feed?topic=${topic}`)}
              />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3">
            <KPICard
              title="Total Articles"
              value={totalArticles}
              trend="up"
              trendValue="+12%"
              onClick={() => router.push('/feed')}
            />
            <KPICard
              title="High Corroboration"
              value={highCorr}
              trend="up"
              trendValue="+8%"
              onClick={() => router.push('/feed?corroboration=high')}
            />
            <KPICard
              title="Avg Sentiment"
              value={avgSentiment.toFixed(2)}
              trend={avgSentiment >= 0 ? 'up' : 'down'}
              trendValue={sentimentLabel}
              onClick={() => router.push('/trends')}
            />
            {topGainers.length > 0 && (
              <Card className="p-3">
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Market Movers</div>
                {topGainers.length > 0 && (
                  <div className="mb-1.5">
                    <span className="text-[9px] text-muted-foreground">Gainers: </span>
                    {topGainers.map((s, i) => (
                      <span key={s.entity_name} className="text-[10px]">
                        {i > 0 && <span className="text-muted-foreground">, </span>}
                        <span className="font-medium">{s.ticker || s.entity_name}</span>
                        <span className="text-emerald-600"> +{parseFloat(s.price_change_pct).toFixed(1)}%</span>
                      </span>
                    ))}
                  </div>
                )}
                {topLosers.length > 0 && (
                  <div>
                    <span className="text-[9px] text-muted-foreground">Losers: </span>
                    {topLosers.map((s, i) => (
                      <span key={s.entity_name} className="text-[10px]">
                        {i > 0 && <span className="text-muted-foreground">, </span>}
                        <span className="font-medium">{s.ticker || s.entity_name}</span>
                        <span className="text-red-600"> {parseFloat(s.price_change_pct).toFixed(1)}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trending Stories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {articlesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              topArticles?.articles?.map((a: any) => (
                <TrendingStoryCard key={a.id} article={a} />
              ))
            )}
            <button
              onClick={() => router.push('/feed?corroboration=high&sort=relevance')}
              className="text-xs text-primary hover:underline w-full text-center pt-2"
            >
              View all →
            </button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Sentiment Trends</CardTitle>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-card text-foreground"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <SentimentTrendChart data={sentimentData} loading={sentimentLoading} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entity Cloud</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityCloud
              data={entityData}
              loading={entityLoading}
              onEntityClick={(name) => router.push(`/feed?entity=${encodeURIComponent(name)}`)}
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <SourceBreakdownChart
              data={sourceData}
              loading={sourceLoading}
              onSourceClick={(source) => router.push(`/feed?source=${encodeURIComponent(source)}`)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Corroboration Heatmap</CardTitle>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-card text-foreground"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <CorroborationHeatmap
            data={heatmapData}
            loading={heatmapLoading}
            onCellClick={(topic, date) => router.push(`/feed?topic=${topic}&date_from=${date}&date_to=${date}`)}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trending Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendingEntitiesChart data={trendingData} loading={trendingLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Market Movers (7D)</CardTitle>
          </CardHeader>
          <CardContent>
            <MarketMovers
              stocks={marketData?.stocks}
              loading={!marketData}
              onEntityClick={(name) => router.push(`/feed?entity=${encodeURIComponent(name)}`)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
