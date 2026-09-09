import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { EntityStat, EntityType, Topic } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 120

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as EntityType | null
    const topic = searchParams.get('topic') as Topic | null
    const sort = searchParams.get('sort') || 'mentions'
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))

    let entityNames: string[]

    if (sort === 'trend') {
      entityNames = await redis.zrange(keys.entitiesByTrend(), 0, limit - 1, { rev: true }) as string[]
    } else if (sort === 'sentiment') {
      entityNames = await redis.zrange(keys.entitiesByMentions(), 0, 200, { rev: true }) as string[]
    } else {
      entityNames = await redis.zrange(keys.entitiesByMentions(), 0, limit - 1, { rev: true }) as string[]
    }

    if (topic) {
      const topicEntities = await redis.smembers(keys.entitiesByTopic(topic)) as string[]
      entityNames = entityNames.filter((n) => topicEntities.includes(n))
    }

    entityNames = entityNames.slice(0, limit)

    if (entityNames.length === 0) {
      return NextResponse.json({ entities: [] })
    }

    const pipeline = redis.pipeline()
    for (const name of entityNames) {
      pipeline.hgetall(keys.entity(name))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    let entities: EntityStat[] = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data) => ({
        name: data.name,
        type: data.type as EntityStat['type'],
        mention_count: Number(data.mention_count),
        avg_sentiment: Number(data.avg_sentiment),
        topics: safeParseArray(data.topics) as Topic[],
        first_seen: data.first_seen,
        last_seen: data.last_seen,
        trend_direction: (data.trend_direction || 'stable') as EntityStat['trend_direction'],
      }))
      .filter((e) => e.name && e.name.trim() !== '' && e.mention_count > 0)

    if (type) {
      entities = entities.filter((e) => e.type === type)
    }

    if (sort === 'sentiment') {
      entities.sort((a, b) => Math.abs(b.avg_sentiment) - Math.abs(a.avg_sentiment))
    }

    return NextResponse.json({ entities: entities.slice(0, limit) })
  } catch (error) {
    console.error('GET /api/entities error:', error)
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 })
  }
}
