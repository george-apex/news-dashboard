import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepRecord, Topic } from '@/types'

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

    const sweep: SweepRecord = {
      id: data.id,
      started_at: data.started_at,
      completed_at: data.completed_at || null,
      status: data.status as SweepRecord['status'],
      topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
      article_count: Number(data.article_count),
      error: data.error || null,
      triggered_by: data.triggered_by as SweepRecord['triggered_by'],
      pdf_report_url: data.pdf_report_url || null,
      linkedin_post: data.linkedin_post || null,
    }

    return NextResponse.json(sweep)
  } catch (error) {
    console.error('GET /api/sweeps/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch sweep' }, { status: 500 })
  }
}
