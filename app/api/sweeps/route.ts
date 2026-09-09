import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepRecord, Topic } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 120

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))

    const total = await redis.zcard(keys.sweepsByDate())
    const offset = (page - 1) * limit
    const sweepIds = await redis.zrange(keys.sweepsByDate(), offset, offset + limit - 1, { rev: true }) as string[]

    if (sweepIds.length === 0) {
      return NextResponse.json({ sweeps: [], total: 0 })
    }

    const zScores = await (async () => {
      const p = redis.pipeline()
      for (const id of sweepIds) {
        p.zscore(keys.sweepsByDate(), id)
      }
      return p.exec<number[]>()
    })()

    const pipeline = redis.pipeline()
    for (const id of sweepIds) {
      pipeline.hgetall(keys.sweep(id))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const sweeps: (SweepRecord & { is_stale?: boolean })[] = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((d, i) => {
        const startedAt = d.started_at || (zScores[i] ? new Date(Number(zScores[i]) * 1000).toISOString() : '')
        const status = d.status as SweepRecord['status']
        let isStale = false
        if (status === 'running' && startedAt) {
          const elapsed = Date.now() - new Date(startedAt).getTime()
          if (elapsed > 10 * 60 * 1000) isStale = true
        }
        const articleCount = Number(d.article_count || d.total_articles || 0)
        return {
          id: d.id,
          started_at: startedAt,
          completed_at: d.completed_at || (status === 'completed' ? null : null),
          status,
          topics: safeParseArray(d.topics) as Topic[],
          article_count: articleCount,
          error: d.error || null,
          triggered_by: (d.triggered_by || 'manual') as SweepRecord['triggered_by'],
          pdf_report_url: d.pdf_report_url || null,
          linkedin_post: d.linkedin_post || null,
          ...(isStale ? { is_stale: true } : {}),
        }
      })

    for (const sweep of sweeps) {
      if (sweep.article_count === 0 && sweep.id) {
        try {
          const count = await redis.scard(keys.articlesBySweep(sweep.id))
          if (count > 0) sweep.article_count = count
        } catch {}
      }
    }

    return NextResponse.json({ sweeps, total })
  } catch (error) {
    console.error('GET /api/sweeps error:', error)
    return NextResponse.json({ error: 'Failed to fetch sweeps' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const redis = getRedisClient()
    const sweepIds = await redis.zrange(keys.sweepsByDate(), 0, -1) as string[]

    if (sweepIds.length > 0) {
      const pipeline = redis.pipeline()
      for (const id of sweepIds) {
        pipeline.del(keys.sweep(id))
        pipeline.zrem(keys.sweepsByDate(), id)
        pipeline.del(keys.articlesBySweep(id))
      }
      await pipeline.exec()
    }

    return NextResponse.json({ success: true, deleted: sweepIds.length })
  } catch (error) {
    console.error('DELETE /api/sweeps error:', error)
    return NextResponse.json({ error: 'Failed to clear sweeps' }, { status: 500 })
  }
}
