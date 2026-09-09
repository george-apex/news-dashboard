import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic, ArticleSearchResult } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ articles: [], total: 0 })
    }

    const articleIds = await redis.zrange(keys.articlesByDate(), 0, -1) as string[]

    const pipeline = redis.pipeline()
    for (const id of articleIds) {
      pipeline.hgetall(keys.article(id))
    }
    const results = await pipeline.exec<Record<string, string>[]>()

    const articles: ArticleSearchResult[] = []
    for (const data of results) {
      if (!data || Object.keys(data).length === 0) continue

      const title = (data.title || '').toLowerCase()
      const summary = (data.summary || '').toLowerCase()
      const entityNames = safeParseArray(data.entities)
        .map((e: unknown) => typeof e === 'string' ? e : (e as Record<string, unknown>)?.name || '')
        .join(' ')
        .toLowerCase()

      if (title.includes(query) || summary.includes(query) || entityNames.includes(query)) {
        articles.push({
          id: data.id,
          title: data.title,
          url: data.url,
          source: data.source,
          date: data.date,
          topic: data.topic as Topic,
          relevance_score: Number(data.relevance_score),
          sentiment_score: Number(data.sentiment_score),
          corroboration_score: data.corroboration_score,
          summary: data.summary ? data.summary.substring(0, 200) + (data.summary.length > 200 ? '...' : '') : null,
          entities: safeParseArray(data.entities) as ArticleSearchResult['entities'],
        })

        if (articles.length >= 20) break
      }
    }

    return NextResponse.json({ articles, total: articles.length })
  } catch (error) {
    console.error('GET /api/articles/search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
