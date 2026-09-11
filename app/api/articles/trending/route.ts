import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { readArticleKeys } from '@/lib/redis/queries'
import { Topic, Article } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') || 5)))

    const articleIds = await redis.zrange(keys.articlesByRelevance(), 0, limit - 1, { rev: true }) as string[]

    if (articleIds.length === 0) {
      return NextResponse.json({ articles: [], total: 0 })
    }

    const dataMap = await readArticleKeys(articleIds)
    const articles: Article[] = articleIds
      .filter((id) => dataMap.has(id))
      .map((id) => {
        const data = dataMap.get(id)!
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
          entities: (typeof data.entities === 'string' ? JSON.parse(data.entities as string) : data.entities || []) as Article['entities'],
          topic: String(data.topic ?? '') as Topic,
          summary: data.summary ? String(data.summary) : null,
          fetched_at: String(data.fetched_at ?? ''),
          sweep_id: String(data.sweep_id ?? ''),
        }
      })

    return NextResponse.json({ articles, total: articles.length })
  } catch (error) {
    console.error('GET /api/articles/trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending articles' }, { status: 500 })
  }
}
