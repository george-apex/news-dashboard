import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { TOPICS } from '@/lib/utils/constants'
import { Topic } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)

    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const now = Date.now()
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : now - 7 * 86400000
    const toMs = dateTo ? new Date(dateTo).getTime() : now

    const cols: string[] = []
    const start = new Date(fromMs)
    const end = new Date(toMs)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      cols.push(d.toISOString().split('T')[0])
    }

    const cells: Record<string, Record<string, { count: number; high_corr_count: number; avg_relevance: number }>> = {}
    for (const topic of TOPICS) {
      cells[topic] = {}
      for (const col of cols) {
        cells[topic][col] = { count: 0, high_corr_count: 0, avg_relevance: 0 }
      }
    }

    const heatmapData = await redis.hgetall<Record<string, string>>('nid:heatmap:corroboration')

    if (heatmapData && Object.keys(heatmapData).length > 0) {
      for (const [field, value] of Object.entries(heatmapData)) {
        const sepIdx = field.lastIndexOf(':')
        if (sepIdx === -1) continue
        const topic = field.substring(0, sepIdx)
        const date = field.substring(sepIdx + 1)
        const count = Number(value) || 0

        if (!cells[topic]) cells[topic] = {}
        if (!cols.includes(date)) continue
        if (!cells[topic][date]) cells[topic][date] = { count: 0, high_corr_count: 0, avg_relevance: 0 }
        cells[topic][date].high_corr_count = count
        cells[topic][date].count = Math.max(cells[topic][date].count, count)
      }
    }

    const rows = TOPICS.filter((t) =>
      cols.some((col) => cells[t]?.[col] && (cells[t][col].count > 0 || cells[t][col].high_corr_count > 0))
    )

    return NextResponse.json({ rows: rows.length > 0 ? rows : TOPICS, cols, cells })
  } catch (error) {
    console.error('GET /api/heatmap/corroboration error:', error)
    return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 })
  }
}
