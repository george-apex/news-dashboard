import { getRedisClient } from './client'
import { keys } from './keys'
import { Article, Topic, EntityStat, SweepRecord } from '@/types'

export async function getArticle(id: string): Promise<Article | null> {
  const redis = getRedisClient()
  const data = await redis.hgetall<Record<string, string>>(keys.article(id))
  if (!data || Object.keys(data).length === 0) return null
  return deserializeArticle(data)
}

export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  if (ids.length === 0) return []
  const redis = getRedisClient()
  const pipeline = redis.pipeline()
  for (const id of ids) {
    pipeline.hgetall(keys.article(id))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  return results
    .filter((r) => r && Object.keys(r).length > 0)
    .map(deserializeArticle)
}

export async function getArticlesByDateRange(
  startDate: number,
  endDate: number,
  page: number,
  limit: number
): Promise<{ ids: string[]; total: number }> {
  const redis = getRedisClient()
  const total = await redis.zcount(keys.articlesByDate(), startDate, endDate)
  const offset = (page - 1) * limit
  const ids = await redis.zrange(keys.articlesByDate(), startDate, endDate, { rev: true })
  const sliced = ids.slice(offset, offset + limit) as string[]
  return { ids: sliced, total }
}

export async function getArticleIdsByTopic(topic: Topic): Promise<string[]> {
  const redis = getRedisClient()
  return redis.smembers(keys.articlesByTopic(topic)) as Promise<string[]>
}

export async function getArticleIdsBySourceType(sourceType: string): Promise<string[]> {
  const redis = getRedisClient()
  return redis.smembers(keys.articlesBySourceType(sourceType)) as Promise<string[]>
}

export async function getArticleIdsByCorroboration(level: string): Promise<string[]> {
  const redis = getRedisClient()
  return redis.smembers(keys.articlesByCorroboration(level)) as Promise<string[]>
}

export async function getArticleIdsBySource(source: string): Promise<string[]> {
  const redis = getRedisClient()
  return redis.smembers(keys.articlesBySource(source)) as Promise<string[]>
}

export async function getArticleIdsByEntity(entity: string): Promise<string[]> {
  const redis = getRedisClient()
  return redis.smembers(keys.entityArticles(entity)) as Promise<string[]>
}

export async function getSweep(id: string): Promise<SweepRecord | null> {
  const redis = getRedisClient()
  const data = await redis.hgetall<Record<string, string>>(keys.sweep(id))
  if (!data || Object.keys(data).length === 0) return null
  return deserializeSweep(data)
}

export async function getEntityStat(name: string): Promise<EntityStat | null> {
  const redis = getRedisClient()
  const data = await redis.hgetall<Record<string, string>>(keys.entity(name))
  if (!data || Object.keys(data).length === 0) return null
  return deserializeEntity(data)
}

export async function getTopicStat(topic: Topic) {
  const redis = getRedisClient()
  const data = await redis.hgetall<Record<string, string>>(keys.topicStats(topic))
  if (!data || Object.keys(data).length === 0) return null
  return data
}

export async function getAllTopicStats() {
  const redis = getRedisClient()
  const pipeline = redis.pipeline()
  const { TOPICS } = await import('@/lib/utils/constants')
  for (const topic of TOPICS) {
    pipeline.hgetall(keys.topicStats(topic))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  return results.filter((r) => r && Object.keys(r).length > 0)
}

export async function getTrendData(key: string, fromScore: number, toScore: number) {
  const redis = getRedisClient()
  return redis.zrange(key, fromScore, toScore) as Promise<string[]>
}

export async function getSourceQualityList() {
  const redis = getRedisClient()
  const sourceNames = await redis.zrange(keys.sourcesByQuality(), 0, -1) as string[]
  if (sourceNames.length === 0) return []
  const pipeline = redis.pipeline()
  for (const name of sourceNames) {
    pipeline.hgetall(keys.sourceQuality(name))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  return results.filter((r) => r && Object.keys(r).length > 0)
}

export async function getEntityNamesSorted(limit: number) {
  const redis = getRedisClient()
  return redis.zrange(keys.entitiesByMentions(), 0, limit - 1, { rev: true }) as Promise<string[]>
}

export async function getLinkedInPost(id: string) {
  const redis = getRedisClient()
  return redis.hgetall<Record<string, string>>(keys.linkedin(id))
}

function deserializeArticle(data: Record<string, string>): Article {
  return {
    id: data.id,
    title: data.title,
    url: data.url,
    date: data.date,
    source: data.source,
    source_type: data.source_type as Article['source_type'],
    relevance_score: Number(data.relevance_score),
    corroboration_score: data.corroboration_score as Article['corroboration_score'],
    source_count: Number(data.source_count),
    sentiment_score: Number(data.sentiment_score),
    entities: typeof data.entities === 'string' ? JSON.parse(data.entities) : [],
    topic: data.topic as Topic,
    summary: data.summary || null,
    fetched_at: data.fetched_at,
    sweep_id: data.sweep_id,
  }
}

function deserializeSweep(data: Record<string, string>): SweepRecord {
  return {
    id: data.id,
    started_at: data.started_at,
    completed_at: data.completed_at || null,
    status: data.status as SweepRecord['status'],
    topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
    article_count: Number(data.article_count),
    error: data.error || null,
    triggered_by: data.triggered_by as SweepRecord['triggered_by'],
    pdf_report_url: data.pdf_report_url || null,
    linkedin_post: data.linkedin_post || null,
  }
}

function deserializeEntity(data: Record<string, string>): EntityStat {
  return {
    name: data.name,
    type: data.type as EntityStat['type'],
    mention_count: Number(data.mention_count),
    avg_sentiment: Number(data.avg_sentiment),
    topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
    first_seen: data.first_seen,
    last_seen: data.last_seen,
    trend_direction: data.trend_direction as EntityStat['trend_direction'],
  }
}
