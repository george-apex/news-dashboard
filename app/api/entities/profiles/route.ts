import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { EntityProfile } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 120

export async function GET() {
  try {
    const redis = getRedisClient()

    const profileKeys = await redis.keys(keys.entityProfile('*'))

    if (profileKeys.length === 0) {
      return NextResponse.json({ profiles: [] })
    }

    const pipeline = redis.pipeline()
    for (const key of profileKeys) {
      pipeline.hgetall(key)
    }
    const results = await pipeline.exec<Record<string, string>[]>() ?? []

    const profiles: EntityProfile[] = []
    for (const data of results) {
      if (!data || !data.name) continue
      profiles.push({
        name: data.name,
        ticker: data.ticker || '',
        latest_price: parseFloat(data.latest_price) || 0,
        price_change_pct: parseFloat(data.price_change_pct) || 0,
        price_change_direction: (data.price_change_direction as EntityProfile['price_change_direction']) || 'flat',
        mention_count: parseInt(data.mention_count) || 0,
        avg_sentiment: parseFloat(data.avg_sentiment) || 0,
        top_headlines: safeParseArray(data.top_headlines) as EntityProfile['top_headlines'],
        sentiment_trend: safeParseArray(data.sentiment_trend) as number[],
        price_trend: safeParseArray(data.price_trend) as number[],
        correlation: (data.correlation as EntityProfile['correlation']) || 'neutral',
        topics: safeParseArray(data.topics) as string[],
        updated_at: data.updated_at || '',
      })
    }

    profiles.sort((a, b) => b.mention_count - a.mention_count)

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('GET /api/entities/profiles error:', error)
    return NextResponse.json({ error: 'Failed to fetch entity profiles' }, { status: 500 })
  }
}
