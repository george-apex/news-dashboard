import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { TOPICS } from '@/lib/utils/constants'
import { Topic, TopicStat } from '@/types'

export async function GET() {
  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()

    for (const topic of TOPICS) {
      pipeline.hgetall(keys.topicStats(topic))
    }

    const results = await pipeline.exec<Record<string, string>[]>()
    const data = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((d) => ({
        topic: d.topic as Topic,
        count: Number(d.article_count),
        avg_sentiment: Number(d.avg_sentiment),
        avg_relevance: Number(d.avg_relevance),
      }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/trends/topic-distribution error:', error)
    return NextResponse.json({ error: 'Failed to fetch topic distribution' }, { status: 500 })
  }
}
