import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { EntityStat } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redis = getRedisClient()
    const entityNames = await redis.zrange(keys.entitiesByMentions(), 0, 29, { rev: true }) as string[]

    if (entityNames.length === 0) {
      return NextResponse.json({ nodes: [], links: [] })
    }

    const pipeline = redis.pipeline()
    for (const name of entityNames) {
      pipeline.hgetall(keys.entity(name))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const entityArticles = await (async () => {
      const p = redis.pipeline()
      for (const name of entityNames) {
        p.zrange(keys.entityArticles(name), 0, -1, { rev: true })
      }
      return p.exec<string[][]>()
    })()

    const nodes = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((data) => ({
        id: data.name,
        type: data.type,
        mention_count: Number(data.mention_count),
      }))

    const links: { source: string; target: string; weight: number }[] = []
    const entityArticleSets = entityNames.map((name, i) => ({
      name,
      articles: new Set(entityArticles[i] || []),
    }))

    for (let i = 0; i < entityArticleSets.length; i++) {
      for (let j = i + 1; j < entityArticleSets.length; j++) {
        const a = entityArticleSets[i]
        const b = entityArticleSets[j]
        let overlap = 0
        for (const art of a.articles) {
          if (b.articles.has(art)) overlap++
        }
        if (overlap > 0) {
          links.push({ source: a.name, target: b.name, weight: overlap })
        }
      }
    }

    links.sort((a, b) => b.weight - a.weight)

    return NextResponse.json({ nodes, links: links.slice(0, 100) })
  } catch (error) {
    console.error('GET /api/entities/co-occurrence error:', error)
    return NextResponse.json({ error: 'Failed to fetch co-occurrence data' }, { status: 500 })
  }
}
