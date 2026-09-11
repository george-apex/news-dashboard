import { getRedisClient } from './client'
import { keys } from './keys'
import { Article, Topic, EntityStat, SweepRecord } from '@/types'

export async function getArticle(id: string): Promise<Article | null> {
  const redis = getRedisClient()
  const data = await readArticleKey(redis, id)
  if (!data) return null
  return deserializeArticle(data)
}

export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  if (ids.length === 0) return []
  const dataMap = await readArticleKeys(ids)
  return ids
    .filter((id) => dataMap.has(id))
    .map((id) => deserializeArticle(dataMap.get(id)!))
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
  const keyType = await redis.type(keys.entityArticles(entity))
  if (keyType === 'zset') {
    return redis.zrange(keys.entityArticles(entity), 0, -1, { rev: true }) as Promise<string[]>
  }
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

export async function readArticleKey(redis: ReturnType<typeof getRedisClient>, id: string): Promise<Record<string, unknown> | null> {
  const key = keys.article(id)
  const keyType = await redis.type(key)
  if (keyType === 'string') {
    const raw = await redis.get(key)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>)
  }
  if (keyType === 'hash') {
    const data = await redis.hgetall<Record<string, string>>(key)
    if (!data || Object.keys(data).length === 0) return null
    return data as unknown as Record<string, unknown>
  }
  return null
}

async function readMixedKeys(redis: ReturnType<typeof getRedisClient>, keyFn: (id: string) => string, ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>()
  if (ids.length === 0) return result

  const typePipeline = redis.pipeline()
  for (const id of ids) {
    typePipeline.type(keyFn(id))
  }
  const types = await typePipeline.exec<string[]>()

  const stringIds: string[] = []
  const hashIds: string[] = []
  for (let i = 0; i < ids.length; i++) {
    if (types[i] === 'string') stringIds.push(ids[i])
    else if (types[i] === 'hash') hashIds.push(ids[i])
  }

  if (stringIds.length > 0) {
    const pipe = redis.pipeline()
    for (const id of stringIds) pipe.get(keyFn(id))
    const raws = await pipe.exec<(string | null)[]>()
    for (let i = 0; i < stringIds.length; i++) {
      if (raws[i] != null) {
        const parsed = typeof raws[i] === 'string' ? JSON.parse(raws[i]!) : raws[i]
        result.set(stringIds[i], parsed as Record<string, unknown>)
      }
    }
  }

  if (hashIds.length > 0) {
    const pipe = redis.pipeline()
    for (const id of hashIds) pipe.hgetall(keyFn(id))
    const raws = await pipe.exec<Record<string, string>[]>()
    for (let i = 0; i < hashIds.length; i++) {
      if (raws[i] && Object.keys(raws[i]).length > 0) {
        result.set(hashIds[i], raws[i] as unknown as Record<string, unknown>)
      }
    }
  }

  return result
}

export async function readArticleKeys(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const redis = getRedisClient()
  return readMixedKeys(redis, keys.article, ids)
}

export async function readArticleKeysOrdered(ids: string[]): Promise<Record<string, unknown>[]> {
  const dataMap = await readArticleKeys(ids)
  return ids.filter((id) => dataMap.has(id)).map((id) => dataMap.get(id)!)
}

export async function readSourceQualityKeys(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const redis = getRedisClient()
  return readMixedKeys(redis, keys.sourceQuality, ids)
}

function deserializeArticle(data: Record<string, unknown>): Article {
  const entities = data.entities
  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    url: String(data.url ?? ''),
    date: String(data.date ?? ''),
    source: String(data.source ?? ''),
    source_type: String(data.source_type ?? '') as Article['source_type'],
    relevance_score: Number(data.relevance_score) || 0,
    corroboration_score: String(data.corroboration_score ?? 'low') as Article['corroboration_score'],
    source_count: Number(data.source_count) || 0,
    sentiment_score: Number(data.sentiment_score) || 0,
    entities: typeof entities === 'string' ? JSON.parse(entities) : Array.isArray(entities) ? entities : [],
    topic: String(data.topic ?? '') as Topic,
    summary: data.summary ? String(data.summary) : null,
    fetched_at: String(data.fetched_at ?? ''),
    sweep_id: String(data.sweep_id ?? ''),
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
