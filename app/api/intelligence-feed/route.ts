import { NextRequest, NextResponse } from 'next/server'
import { getArticleWithMarketData, getRelatedArticles } from '@/lib/services/market-intelligence'
import { getRedisClient, keys } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const relevance = Number(searchParams.get('relevance') || 75)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
    const withRelated = searchParams.get('related') === 'true'

    const redis = getRedisClient()
    const articleIds = await redis.zrange(keys.articlesByRelevance(), 0, 199, { rev: true }) as string[]

    if (!articleIds || articleIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, meta: { sweep_id: null, relevance_threshold: relevance, timestamp: new Date().toISOString() } })
    }

    const offset = (page - 1) * limit
    const pagedIds = articleIds.slice(offset, offset + limit)

    const results = []
    for (const id of pagedIds) {
      const item = await getArticleWithMarketData(id)
      if (item && item.financialRelevance >= relevance) {
        const entry: any = {
          article: item.article,
          marketData: item.marketData,
          financialRelevance: item.financialRelevance,
          hasMarketData: item.hasMarketData,
        }
        if (withRelated) {
          entry.relatedArticles = await getRelatedArticles(id, 5)
        }
        results.push(entry)
      }
    }

    return NextResponse.json({
      data: results,
      total: results.length,
      meta: {
        sweep_id: null,
        relevance_threshold: relevance,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/intelligence-feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch intelligence feed' }, { status: 500 })
  }
}
