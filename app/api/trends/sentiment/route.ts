import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic') as Topic | null
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let trendKey = keys.trendSentimentDaily()
    if (topic) {
      trendKey = keys.trendTopicDaily(topic)
    }

    const rawItems = await redis.zrange(trendKey, 0, -1) as Array<string | Record<string, unknown>>

    let data = rawItems.map((item) => {
      let parsed: Record<string, unknown>
      if (typeof item === 'string') {
        try {
          parsed = JSON.parse(item)
        } catch {
          return null
        }
      } else if (typeof item === 'object' && item !== null) {
        parsed = item as Record<string, unknown>
      } else {
        return null
      }
      return {
        date: String(parsed.date ?? ''),
        avg_sentiment: Number(parsed.avg_sentiment ?? parsed.sentiment ?? 0),
        article_count: Number(parsed.article_count ?? parsed.count ?? 0),
      }
    }).filter((d): d is { date: string; avg_sentiment: number; article_count: number } => d !== null && d.date !== '')

    if (dateFrom) {
      data = data.filter((d) => d.date >= dateFrom)
    }
    if (dateTo) {
      data = data.filter((d) => d.date <= dateTo)
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/trends/sentiment error:', error)
    return NextResponse.json({ error: 'Failed to fetch sentiment trend' }, { status: 500 })
  }
}
