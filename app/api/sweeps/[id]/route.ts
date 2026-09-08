import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepRecord } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()
    const data = await redis.hgetall<Record<string, string>>(keys.sweep(id))

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Sweep not found' }, { status: 404 })
    }

    const zScores = await redis.zscore(keys.sweepsByDate(), id).catch(() => null)

    const sweep: SweepRecord & { is_stale?: boolean } = {
      id: data.id,
      started_at: data.started_at || (zScores ? new Date(Number(zScores) * 1000).toISOString() : ''),
      completed_at: data.completed_at || null,
      status: data.status as SweepRecord['status'],
      topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
      article_count: Number(data.article_count || data.total_articles || 0),
      error: data.error || null,
      triggered_by: (data.triggered_by || 'manual') as SweepRecord['triggered_by'],
      pdf_report_url: data.pdf_report_url || null,
      linkedin_post: data.linkedin_post || null,
    }

    if (sweep.status === 'running' && sweep.started_at) {
      const elapsed = Date.now() - new Date(sweep.started_at).getTime()
      if (elapsed > 10 * 60 * 1000) {
        sweep.is_stale = true
      }
    }

    return NextResponse.json(sweep)
  } catch (error) {
    console.error('GET /api/sweeps/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch sweep' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()

    const articleIds = await redis.smembers(keys.articlesBySweep(id)) as string[]

    const pipeline = redis.pipeline()
    pipeline.del(keys.sweep(id))
    pipeline.zrem(keys.sweepsByDate(), id)
    pipeline.del(keys.articlesBySweep(id))
    await pipeline.exec()

    return NextResponse.json({ success: true, id, article_count: articleIds.length })
  } catch (error) {
    console.error('DELETE /api/sweeps/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete sweep' }, { status: 500 })
  }
}
