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
    const cells: Record<string, Record<string, { count: number; high_corr_count: number; avg_relevance: number }>> = {}

    const start = new Date(fromMs)
    const end = new Date(toMs)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      cols.push(d.toISOString().split('T')[0])
    }

    for (const topic of TOPICS) {
      cells[topic] = {}
      for (const col of cols) {
        cells[topic][col] = { count: 0, high_corr_count: 0, avg_relevance: 0 }
      }
    }

    const startSec = Math.floor(fromMs / 1000)
    const endSec = Math.ceil(toMs / 1000)

    for (const topic of TOPICS) {
      const trendKey = keys.trendTopicDaily(topic)
      const exists = await redis.exists(trendKey)

      if (exists) {
        const rawItems = await redis.zrange(trendKey, startSec, endSec) as string[]

        for (const item of rawItems) {
          try {
            const parsed = JSON.parse(item)
            const date = parsed.date || ''
            if (!date) continue
            const highCorr = Number(parsed.high_corr_count || parsed.high_corroboration_count || 0)
            if (!cells[topic]) cells[topic] = {}
            cells[topic][date] = {
              count: Number(parsed.count || parsed.article_count || 0),
              high_corr_count: highCorr,
              avg_relevance: Number(parsed.avg_relevance || 0),
            }
          } catch {}
        }
      } else {
        const articleIds = await redis.smembers(keys.articlesByTopic(topic)) as string[]
        if (articleIds.length > 0) {
          const batchSize = 50
          for (let i = 0; i < articleIds.length; i += batchSize) {
            const batch = articleIds.slice(i, i + batchSize)
            const pipeline = redis.pipeline()
            for (const id of batch) {
              pipeline.hgetall(keys.article(id))
            }
            const results = await pipeline.exec<Record<string, string>[]>()
            for (const data of results) {
              if (!data || !data.date) continue
              const day = new Date(data.date).toISOString().split('T')[0]
              if (!cols.includes(day)) continue
              const corrScore = String(data.corroboration_score || '').toLowerCase()
              const topicKey = data.topic as Topic
              if (!cells[topicKey]) cells[topicKey] = {}
              if (!cells[topicKey][day]) cells[topicKey][day] = { count: 0, high_corr_count: 0, avg_relevance: 0 }
              cells[topicKey][day].count++
              if (corrScore === 'high') cells[topicKey][day].high_corr_count++
              cells[topicKey][day].avg_relevance += Number(data.relevance_score || 0)
            }
          }
          for (const topic of TOPICS) {
            for (const col of cols) {
              const cell = cells[topic]?.[col]
              if (cell && cell.count > 0) {
                cell.avg_relevance = Number((cell.avg_relevance / cell.count).toFixed(2))
              }
            }
          }
        }
      }
    }

    const rows = TOPICS.filter((t) =>
      cols.some((col) => cells[t]?.[col] && (cells[t][col].count > 0 || cells[t][col].high_corr_count > 0))
    )
    if (rows.length === 0) {
      for (const topic of TOPICS) {
        let hasData = false
        for (const col of cols) {
          if (cells[topic]?.[col]?.count > 0) { hasData = true; break }
        }
        if (hasData) rows.push(topic)
      }
    }

    return NextResponse.json({ rows: rows.length > 0 ? rows : TOPICS, cols, cells })
  } catch (error) {
    console.error('GET /api/heatmap/corroboration error:', error)
    return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 })
  }
}
