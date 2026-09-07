import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic, Article } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()
    const data = await redis.hgetall<Record<string, string>>(keys.article(id))

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const article: Article = {
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

    return NextResponse.json(article)
  } catch (error) {
    console.error('GET /api/articles/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}
