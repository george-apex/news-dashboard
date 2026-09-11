import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { safeParseArray } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redis = getRedisClient()
    const sweepIds = await redis.zrange(keys.sweepsByDate(), 0, 0, { rev: true }) as string[]

    if (!sweepIds || sweepIds.length === 0) {
      return NextResponse.json({ data: null, meta: { sweep_id: null, relevance_threshold: 0, timestamp: new Date().toISOString() } })
    }

    const latestId = sweepIds[0]
    const sweepData = await redis.hgetall<Record<string, string>>(keys.sweep(latestId))

    if (!sweepData || Object.keys(sweepData).length === 0) {
      return NextResponse.json({ data: null, meta: { sweep_id: null, relevance_threshold: 0, timestamp: new Date().toISOString() } })
    }

    const isActive = sweepData.status === 'running'

    let pipelineStages = []
    try {
      pipelineStages = safeParseArray(sweepData.pipeline_stages) as any[]
    } catch {}

    return NextResponse.json({
      data: {
        id: sweepData.id,
        status: sweepData.status,
        started_at: sweepData.started_at,
        completed_at: sweepData.completed_at || null,
        article_count: Number(sweepData.article_count || 0),
        topics: safeParseArray(sweepData.topics),
        pipeline_stages: pipelineStages,
        is_active: isActive,
      },
      meta: {
        sweep_id: latestId,
        relevance_threshold: 0,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/sweeps/latest error:', error)
    return NextResponse.json({ error: 'Failed to fetch latest sweep' }, { status: 500 })
  }
}
