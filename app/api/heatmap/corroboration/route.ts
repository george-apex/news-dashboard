import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { TOPICS } from '@/lib/utils/constants'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)

    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const _granularity = searchParams.get('granularity') || 'day'

    const now = Date.now()
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : now - 7 * 86400000
    const toMs = dateTo ? new Date(dateTo).getTime() : now
    const fromEpoch = Math.floor(fromMs / 86400000)
    const toEpoch = Math.ceil(toMs / 86400000)

    const cols: string[] = []
    const cells: Record<string, Record<string, { count: number; high_corr_count: number; avg_relevance: number }>> = {}

    for (let d = fromEpoch; d <= toEpoch; d++) {
      const date = new Date(d * 86400000).toISOString().split('T')[0]
      cols.push(date)
    }

    for (const topic of TOPICS) {
      cells[topic] = {}
      const rawItems = await redis.zrange(keys.trendTopicDaily(topic), fromEpoch, toEpoch) as string[]

      for (const item of rawItems) {
        try {
          const parsed = JSON.parse(item)
          const date = parsed.date || ''
          cells[topic][date] = {
            count: Number(parsed.count || 0),
            high_corr_count: Number(parsed.high_corr_count || 0),
            avg_relevance: Number(parsed.avg_relevance || 0),
          }
        } catch {}
      }

      for (const col of cols) {
        if (!cells[topic][col]) {
          cells[topic][col] = { count: 0, high_corr_count: 0, avg_relevance: 0 }
        }
      }
    }

    return NextResponse.json({ rows: TOPICS, cols, cells })
  } catch (error) {
    console.error('GET /api/heatmap/corroboration error:', error)
    return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 })
  }
}
