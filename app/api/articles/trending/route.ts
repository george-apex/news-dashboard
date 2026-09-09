import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic, Article } from '@/types'
import { safeParseArray } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') || 5)))

    const articleIds = await redis.zrange(keys.articlesByRelevance(), 0, limit - 1, { rev: true }) as string[]

    if (articleIds.length === 0) {
      return NextResponse.json({ articles: [], total: 0 })
    }

    const pipeline = redis.pipeline()
    for (const id of articleIds) {
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

    return NextResponse.json({ articles, total: articles.length })
  } catch (error) {
    console.error('GET /api/articles/trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending articles' }, { status: 500 })
  }
}
