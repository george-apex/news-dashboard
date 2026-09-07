import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepRecord, Topic } from '@/types'

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

    const pipeline = redis.pipeline()
    for (const id of sweepIds) {
      pipeline.hgetall(keys.sweep(id))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const sweeps: SweepRecord[] = results
      .filter((r) => r && Object.keys(r).length > 0)
      .map((d) => ({
        id: d.id,
        started_at: d.started_at,
        completed_at: d.completed_at || null,
        status: d.status as SweepRecord['status'],
        topics: typeof d.topics === 'string' ? JSON.parse(d.topics) : [],
        article_count: Number(d.article_count),
        error: d.error || null,
        triggered_by: d.triggered_by as SweepRecord['triggered_by'],
        pdf_report_url: d.pdf_report_url || null,
        linkedin_post: d.linkedin_post || null,
      }))

    return NextResponse.json({ sweeps, total })
  } catch (error) {
    console.error('GET /api/sweeps error:', error)
    return NextResponse.json({ error: 'Failed to fetch sweeps' }, { status: 500 })
  }
}
