'use client'

import { useState } from 'react'
import { useSentimentTrend, useTopicDistribution, useArticles, useCorroborationHeatmap } from '@/lib/hooks/useApiHooks'
import { SentimentTrendChart } from '@/components/charts/SentimentTrendChart'
import { TopicDonut } from '@/components/charts/TopicDonut'
import { TimelineView } from '@/components/charts/TimelineView'
import { CorroborationHeatmap } from '@/components/charts/CorroborationHeatmap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Topic } from '@/types'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { ErrorState } from '@/components/common/ErrorState'

export default function TrendsPage() {
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [timelinePage, setTimelinePage] = useState(1)

  const { data: sentimentData, isLoading: sentimentLoading, error: sentimentError } = useSentimentTrend(
    selectedTopic !== 'all' ? selectedTopic : undefined
  )
  const { data: topicDist, isLoading: distLoading, error: distError } = useTopicDistribution()
  const { data: timelineData, isLoading: timelineLoading, error: timelineError } = useArticles({
    sort: 'date',
    limit: 100,
    topic: selectedTopic !== 'all' ? selectedTopic : undefined,
    page: timelinePage,
  })
  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useCorroborationHeatmap()

  const hasError = sentimentError || distError || timelineError || heatmapError

  return (
    <div className="p-6 space-y-6">
      {hasError && (
        <ErrorState message="Failed to load trend data. Please check your connection." onRetry={() => window.location.reload()} />
      )}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Trends</h2>
        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
          <SelectTrigger className="w-44 h-8 text-xs">
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

      <Tabs defaultValue="sentiment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
        </TabsList>

        <TabsContent value="sentiment">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sentiment Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <SentimentTrendChart data={sentimentData} loading={sentimentLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Topic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <TopicDonut data={topicDist} loading={distLoading} />
              {topicDist && (
                <div className="mt-4 space-y-2">
                  <div className="grid grid-cols-5 gap-2 text-[10px] text-muted-foreground font-medium px-2">
                    <span>Topic</span>
                    <span>Count</span>
                    <span>%</span>
                    <span>Avg Sentiment</span>
                    <span>Avg Relevance</span>
                  </div>
                  {topicDist.data.map((d) => {
                    const total = topicDist.data.reduce((s, x) => s + x.count, 0)
                    return (
                      <div key={d.topic} className="grid grid-cols-5 gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TOPIC_COLORS[d.topic] }} />
                          {d.topic.replace(/_/g, ' ')}
                        </span>
                        <span className="tabular-nums">{d.count}</span>
                        <span className="tabular-nums">{total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%</span>
                        <span className="tabular-nums">{d.avg_sentiment.toFixed(2)}</span>
                        <span className="tabular-nums">—</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">News Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineView
                articles={timelineData?.articles}
                loading={timelineLoading}
                hasMore={timelineData?.has_more}
                onLoadMore={() => setTimelinePage((p) => p + 1)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Corroboration Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <CorroborationHeatmap data={heatmapData} loading={heatmapLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
