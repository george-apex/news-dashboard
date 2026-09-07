import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { Topic } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic') as Topic | null
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const granularity = searchParams.get('granularity') || 'day'

    if (granularity !== 'day' && granularity !== 'hour') {
      return NextResponse.json({ error: 'Invalid granularity. Use "day" or "hour".' }, { status: 400 })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fromEpoch = dateFrom ? new Date(dateFrom).getTime() / 86400000 : sevenDaysAgo.getTime() / 86400000
    const toEpoch = dateTo ? new Date(dateTo).getTime() / 86400000 : Date.now() / 86400000

    let trendKey = keys.trendSentimentDaily()
    if (topic) {
      trendKey = keys.trendTopicDaily(topic)
    }

    const rawItems = await redis.zrange(trendKey, Math.floor(fromEpoch), Math.ceil(toEpoch)) as string[]

    const data = rawItems.map((item) => {
      try {
        const parsed = JSON.parse(item)
        return {
          date: parsed.date,
          avg_sentiment: Number(parsed.avg_sentiment ?? parsed.sentiment ?? 0),
          article_count: Number(parsed.article_count ?? parsed.count ?? 0),
        }
      } catch {
        return null
      }
    }).filter(Boolean) as { date: string; avg_sentiment: number; article_count: number }[]

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/trends/sentiment error:', error)
    return NextResponse.json({ error: 'Failed to fetch sentiment trend' }, { status: 500 })
  }
}
