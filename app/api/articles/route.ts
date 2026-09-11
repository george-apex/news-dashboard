import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic, CorroborationLevel, Article } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)

    const topic = searchParams.get('topic')
    const source = searchParams.get('source')
    const sourceType = searchParams.get('source_type')
    const sentimentMin = searchParams.get('sentiment_min')
    const sentimentMax = searchParams.get('sentiment_max')
    const corroboration = searchParams.get('corroboration') as CorroborationLevel | null
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const minRelevance = Number(searchParams.get('min_relevance') || 0)
    const entity = searchParams.get('entity')
    const sort = searchParams.get('sort') || 'date'
    const order = searchParams.get('order') || 'desc'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
    const search = searchParams.get('search')

    let articleIds: string[] | null = null

    const intersect = (current: string[] | null, newIds: string[]): string[] => {
      if (current === null) return newIds
      return current.filter((id) => newIds.includes(id))
    }

    if (topic) {
      const topics = topic.split(',')
      const sets: string[][] = []
      for (const t of topics) {
        const ids = await redis.smembers(keys.articlesByTopic(t as Topic))
        sets.push(ids as string[])
      }
      articleIds = intersect(articleIds, sets.flat())
    }

    if (sourceType) {
      const ids = await redis.smembers(keys.articlesBySourceType(sourceType))
      articleIds = intersect(articleIds, ids as string[])
    }

    if (corroboration) {
      const corrIds = await redis.smembers(keys.articlesByCorroboration(corroboration.toLowerCase())) as string[]
      articleIds = intersect(articleIds, corrIds)
    }

    if (source) {
      const ids = await redis.smembers(keys.articlesBySource(source))
      articleIds = intersect(articleIds, ids as string[])
    }

    if (entity) {
      const ids = await redis.zrange(keys.entityArticles(entity), 0, -1, { rev: true })
      articleIds = intersect(articleIds, ids as string[])
    }

    if (articleIds === null) {
      const startEpoch = dateFrom ? new Date(dateFrom).getTime() : 0
      const endEpoch = dateTo ? new Date(dateTo).getTime() : Date.now()
      const allIds = await redis.zrange(keys.articlesByDate(), startEpoch, endEpoch)
      articleIds = allIds as string[]
    } else if (dateFrom || dateTo) {
      const startEpoch = dateFrom ? new Date(dateFrom).getTime() : 0
      const endEpoch = dateTo ? new Date(dateTo).getTime() : Date.now()
      const dateIds = await redis.zrange(keys.articlesByDate(), startEpoch, endEpoch) as string[]
      articleIds = articleIds.filter((id) => dateIds.includes(id))
    }

    if (articleIds.length === 0) {
      return NextResponse.json({ articles: [], total: 0, page, limit, has_more: false })
    }

    if (sort === 'date' || sort === 'relevance' || sort === 'sentiment') {
      const sortKey = sort === 'date' ? keys.articlesByDate()
        : sort === 'relevance' ? keys.articlesByRelevance()
        : keys.articlesBySentiment()
      const scored = await redis.zscore(sortKey, articleIds[0]).catch(() => null)
      if (scored !== null) {
        const pipeline = redis.pipeline()
        for (const id of articleIds) {
          pipeline.zscore(sortKey, id)
        }
        const scores = await pipeline.exec<number[]>()
        const paired = articleIds.map((id, i) => ({ id, score: scores[i] ?? 0 }))
        paired.sort((a, b) => order === 'desc' ? b.score - a.score : a.score - b.score)
        articleIds = paired.map((p) => p.id)
      }
    }

    const total = articleIds.length
    const offset = (page - 1) * limit
    const pagedIds = articleIds.slice(offset, offset + limit)

    const pipeline = redis.pipeline()
    for (const id of pagedIds) {
      pipeline.hgetall(keys.article(id))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const articles: Article[] = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data) => ({
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
        entities: safeParseArray(data.entities) as Article['entities'],
        topic: data.topic as Topic,
        summary: data.summary || null,
        fetched_at: data.fetched_at,
        sweep_id: data.sweep_id,
      }))
      .filter((a) => {
        if (minRelevance > 0 && a.relevance_score < minRelevance) return false
        if (sentimentMin && a.sentiment_score < Number(sentimentMin)) return false
        if (sentimentMax && a.sentiment_score > Number(sentimentMax)) return false
        if (corroboration) {
          const cs = String(a.corroboration_score).toLowerCase()
          if (cs !== corroboration.toLowerCase()) return false
        }
        if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })

    const filteredTotal = articles.length
    return NextResponse.json({
      articles,
      total: filteredTotal,
      page,
      limit,
      has_more: offset + limit < total,
    })
  } catch (error) {
    console.error('GET /api/articles error:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
