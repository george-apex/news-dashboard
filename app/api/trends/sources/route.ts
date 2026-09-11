import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { readSourceQualityKeys } from '@/lib/redis/queries'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redis = getRedisClient()
    const sourceNames = await redis.zrange(keys.sourcesByQuality(), 0, -1) as string[]

    if (sourceNames.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const dataMap = await readSourceQualityKeys(sourceNames)
    const data = sourceNames
      .filter((name) => dataMap.has(name))
      .map((name) => {
        const d = dataMap.get(name)!
        return {
          source: String(d.source ?? name),
          source_type: String(d.source_type ?? ''),
          count: Number(d.total_articles) || 0,
          avg_relevance: Number(d.avg_relevance) || 0,
          avg_sentiment: Number(d.avg_sentiment) || 0,
        }
      })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/trends/sources error:', error)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }
}
