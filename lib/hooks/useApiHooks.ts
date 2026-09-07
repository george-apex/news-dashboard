import { useApi } from '@/lib/api/client'
import { ArticlesResponse, ArticlesQueryParams, TopicStatsResponse, EntitiesResponse, TrendingEntitiesResponse, SentimentTrendResponse, TopicDistributionResponse, SourcesResponse, SweepsResponse, SweepRecord, LinkedInPostsResponse, LinkedInPost, HeatmapResponse, SourceQualityResponse, CoOccurrenceResponse } from '@/types'

function buildQuery(params: ArticlesQueryParams): string {
  const searchParams = new URLSearchParams()
  if (params.topic) searchParams.set('topic', params.topic)
  if (params.source) searchParams.set('source', params.source)
  if (params.source_type) searchParams.set('source_type', params.source_type)
  if (params.sentiment_min !== undefined) searchParams.set('sentiment_min', String(params.sentiment_min))
  if (params.sentiment_max !== undefined) searchParams.set('sentiment_max', String(params.sentiment_max))
  if (params.corroboration) searchParams.set('corroboration', params.corroboration)
  if (params.date_from) searchParams.set('date_from', params.date_from)
  if (params.date_to) searchParams.set('date_to', params.date_to)
  if (params.min_relevance) searchParams.set('min_relevance', String(params.min_relevance))
  if (params.entity) searchParams.set('entity', params.entity)
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.order) searchParams.set('order', params.order)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export function useArticles(params: ArticlesQueryParams = {}, refreshInterval = 60000) {
  return useApi<ArticlesResponse>(`/articles${buildQuery(params)}`, refreshInterval)
}

export function useArticle(id: string | null) {
  return useApi<ArticlesResponse['articles'][0]>(id ? `/articles/${id}` : null)
}

export function useTopicStats() {
  return useApi<TopicStatsResponse>('/topics/stats', 30000)
}

export function useEntities(type?: string, topic?: string, sort?: string, limit?: number) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (topic) params.set('topic', topic)
  if (sort) params.set('sort', sort)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return useApi<EntitiesResponse>(`/entities${qs ? `?${qs}` : ''}`, 30000)
}

export function useTrendingEntities() {
  return useApi<TrendingEntitiesResponse>('/entities/trending', 30000)
}

export function useCoOccurrence() {
  return useApi<CoOccurrenceResponse>('/entities/co-occurrence', 60000)
}

export function useSentimentTrend(topic?: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams()
  if (topic) params.set('topic', topic)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const qs = params.toString()
  return useApi<SentimentTrendResponse>(`/trends/sentiment${qs ? `?${qs}` : ''}`, 30000)
}

export function useTopicDistribution() {
  return useApi<TopicDistributionResponse>('/trends/topic-distribution', 30000)
}

export function useSources() {
  return useApi<SourcesResponse>('/trends/sources', 30000)
}

export function useSweeps(page = 1, limit = 20) {
  return useApi<SweepsResponse>(`/sweeps?page=${page}&limit=${limit}`, 30000)
}

export function useSweep(id: string | null) {
  return useApi<SweepRecord>(id ? `/sweeps/${id}` : null, id ? 5000 : 0)
}

export function useLinkedInPosts(sweepId?: string, limit = 20) {
  const params = new URLSearchParams()
  if (sweepId) params.set('sweep_id', sweepId)
  params.set('limit', String(limit))
  return useApi<LinkedInPostsResponse>(`/linkedin?${params.toString()}`, 30000)
}

export function useLinkedInPost(id: string | null) {
  return useApi<LinkedInPost>(id ? `/linkedin/${id}` : null)
}

export function useCorroborationHeatmap(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const qs = params.toString()
  return useApi<HeatmapResponse>(`/heatmap/corroboration${qs ? `?${qs}` : ''}`, 30000)
}

export function useSourceQuality() {
  return useApi<SourceQualityResponse>('/sources/quality', 30000)
}
