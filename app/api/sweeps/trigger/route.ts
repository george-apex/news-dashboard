export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepTriggerBody, Topic, SweepRecord } from '@/types'
import { TOPICS } from '@/lib/utils/constants'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body: SweepTriggerBody = await request.json()
    const redis = getRedisClient()
    const sweepId = randomUUID()
    const now = new Date().toISOString()

    const topics = body.topics && body.topics.length > 0 ? body.topics : TOPICS

    const sweepData: Record<string, string> = {
      id: sweepId,
      started_at: now,
      completed_at: '',
      status: 'running',
      topics: JSON.stringify(topics),
      article_count: '0',
      error: '',
      triggered_by: 'manual',
      pdf_report_url: '',
      linkedin_post: '',
    }

    await redis.hset(keys.sweep(sweepId), sweepData)
    await redis.zadd(keys.sweepsByDate(), { score: new Date(now).getTime(), member: sweepId })

    const agentUrl = process.env.G_RESEARCH_AGENT_API_URL
    if (agentUrl) {
      try {
        await fetch(`${agentUrl}/sweep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topics,
            generate_pdf: body.generate_pdf ?? false,
            generate_linkedin: body.generate_linkedin ?? false,
            sweep_id: sweepId,
          }),
        })
      } catch (err) {
        console.error('Failed to call agent API:', err)
      }
    }

    return NextResponse.json({ sweep_id: sweepId, status: 'running' }, { status: 202 })
  } catch (error) {
    console.error('POST /api/sweeps/trigger error:', error)
    return NextResponse.json({ error: 'Failed to trigger sweep' }, { status: 500 })
  }
}
