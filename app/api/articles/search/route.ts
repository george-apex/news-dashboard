import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { readArticleKeys } from '@/lib/redis/queries'
import { Topic, ArticleSearchResult } from '@/types'

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

    const dataMap = await readArticleKeys(articleIds)

    const articles: ArticleSearchResult[] = []
    for (const id of articleIds) {
      const data = dataMap.get(id)
      if (!data) continue

      const d = data as Record<string, any>
      const title = (d.title || '').toLowerCase()
      const summary = (d.summary || '').toLowerCase()
      const entityNames = (typeof d.entities === 'string' ? JSON.parse(d.entities) : (Array.isArray(d.entities) ? d.entities : []))
        .map((e: unknown) => typeof e === 'string' ? e : (e as Record<string, unknown>)?.name || '')
        .join(' ')
        .toLowerCase()

      if (title.includes(query) || summary.includes(query) || entityNames.includes(query)) {
        articles.push({
          id: String(d.id ?? ''),
          title: String(d.title ?? ''),
          url: String(d.url ?? ''),
          source: String(d.source ?? ''),
          date: String(d.date ?? ''),
          topic: String(d.topic ?? '') as Topic,
          relevance_score: Number(d.relevance_score) || 0,
          sentiment_score: Number(d.sentiment_score) || 0,
          corroboration_score: String(d.corroboration_score ?? 'low'),
          summary: d.summary ? String(d.summary).substring(0, 200) + (String(d.summary).length > 200 ? '...' : '') : null,
          entities: (typeof d.entities === 'string' ? JSON.parse(d.entities) : d.entities || []) as ArticleSearchResult['entities'],
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
