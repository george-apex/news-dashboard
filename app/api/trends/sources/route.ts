import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redis = getRedisClient()
    const sourceNames = await redis.zrange(keys.sourcesByQuality(), 0, -1) as string[]

    if (sourceNames.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const pipeline = redis.pipeline()
    for (const name of sourceNames) {
      pipeline.hgetall(keys.sourceQuality(name))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const data = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((d) => ({
        source: d.source,
        source_type: d.source_type,
        count: Number(d.total_articles),
        avg_relevance: Number(d.avg_relevance),
        avg_sentiment: Number(d.avg_sentiment),
      }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/trends/sources error:', error)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }
}
