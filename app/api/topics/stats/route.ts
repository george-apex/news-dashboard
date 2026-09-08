import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { TOPICS } from '@/lib/utils/constants'
import { Topic, TopicStat } from '@/types'
import { safeParseArray } from '@/lib/utils'

export async function GET() {
  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()

    for (const topic of TOPICS) {
      pipeline.hgetall(keys.topicStats(topic))
    }

    const results = await pipeline.exec<Record<string, string>[]>()
    const topics: TopicStat[] = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data) => ({
        topic: data.topic as Topic,
        article_count: Number(data.article_count),
        avg_sentiment: Number(data.avg_sentiment),
        avg_relevance: Number(data.avg_relevance),
        high_corroboration_count: Number(data.high_corroboration_count),
        top_entities: safeParseArray(data.top_entities) as string[],
        last_updated: data.last_updated,
      }))

    const lastUpdatedData = await redis.get<string>(keys.topicStatsUpdated())
    const last_updated = lastUpdatedData || new Date().toISOString()

    return NextResponse.json({ topics, last_updated })
  } catch (error) {
    console.error('GET /api/topics/stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch topic stats' }, { status: 500 })
  }
}
