import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { EntityStat } from '@/types'

export async function GET() {
  try {
    const redis = getRedisClient()
    const entityNames = await redis.zrange(keys.entitiesByMentions(), 0, 49, { rev: true }) as string[]

    if (entityNames.length === 0) {
      return NextResponse.json({ entities: [] })
    }

    const pipeline = redis.pipeline()
    for (const name of entityNames) {
      pipeline.hgetall(keys.entity(name))
    }
    const results = await pipeline.exec<Record<string, string>[]>()

    const mentionScores = await (async () => {
      const p = redis.pipeline()
      for (const name of entityNames) {
        p.zscore(keys.entitiesByMentions(), name)
      }
      return p.exec<number[]>()
    })()

    const allEntities = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data, i) => ({
        name: data.name,
        type: data.type as EntityStat['type'],
        mention_count: Number(data.mention_count || 0),
        avg_sentiment: Number(data.avg_sentiment || 0),
        topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
        first_seen: data.first_seen,
        last_seen: data.last_seen,
        trend_direction: (data.trend_direction || 'stable') as EntityStat['trend_direction'],
        trend_delta: mentionScores[i] || 0,
      }))
      .filter((e) => e.name && e.name.trim() !== '' && e.mention_count > 0)

    const trending = allEntities
      .filter((e) => e.trend_direction === 'up')
      .sort((a, b) => b.mention_count - a.mention_count)

    if (trending.length > 0) {
      return NextResponse.json({ entities: trending.slice(0, 20) })
    }

    const fallback = allEntities
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 20)
    return NextResponse.json({ entities: fallback })
  } catch (error) {
    console.error('GET /api/entities/trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending entities' }, { status: 500 })
  }
}
