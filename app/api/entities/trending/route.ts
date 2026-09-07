import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { EntityStat, EntityType } from '@/types'

export async function GET() {
  try {
    const redis = getRedisClient()
    const entityNames = await redis.zrange(keys.entitiesByTrend(), 0, 19, { rev: true }) as string[]

    if (entityNames.length === 0) {
      return NextResponse.json({ entities: [] })
    }

    const pipeline = redis.pipeline()
    for (const name of entityNames) {
      pipeline.hgetall(keys.entity(name))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const trendScores = await (async () => {
      const p = redis.pipeline()
      for (const name of entityNames) {
        p.zscore(keys.entitiesByTrend(), name)
      }
      return p.exec<number[]>()
    })()

    const entities = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data, i) => ({
        name: data.name,
        type: data.type as EntityStat['type'],
        mention_count: Number(data.mention_count),
        avg_sentiment: Number(data.avg_sentiment),
        topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
        first_seen: data.first_seen,
        last_seen: data.last_seen,
        trend_direction: (data.trend_direction || 'stable') as EntityStat['trend_direction'],
        trend_delta: trendScores[i] || 0,
      }))
      .filter((e) => e.trend_direction === 'up')
      .sort((a, b) => b.trend_delta - a.trend_delta)

    return NextResponse.json({ entities })
  } catch (error) {
    console.error('GET /api/entities/trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending entities' }, { status: 500 })
  }
}
