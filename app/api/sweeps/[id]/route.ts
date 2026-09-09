import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { SweepRecord, PipelineStageInfo, StageStatus, Topic } from '@/types'
import { safeParseArray } from '@/lib/utils'

export const revalidate = 120

function computeDuration(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    return ms > 0 ? ms : null
  } catch {
    return null
  }
}

function buildPipelineStages(data: Record<string, string>, articleCount: number): PipelineStageInfo[] {
  const newsStatus = (data.news_status as StageStatus) || 'pending'
  const marketDataStatus = (data.market_data_status as StageStatus) || 'pending'
  const corroborationStatus = (data.corroboration_status as StageStatus) || 'pending'
  const contentStatus = (data.content_status as StageStatus) || 'pending'

  const stages: PipelineStageInfo[] = [
    {
      label: 'News',
      status: newsStatus,
      started_at: data.news_started_at || null,
      completed_at: data.news_completed_at || null,
      duration_ms: computeDuration(data.news_started_at, data.news_completed_at),
      detail: newsStatus === 'completed' ? `${articleCount} articles` : newsStatus === 'failed' ? (data.error || 'Failed') : null,
    },
    {
      label: 'Market Data',
      status: marketDataStatus,
      started_at: data.market_data_started_at || null,
      completed_at: data.market_data_completed_at || null,
      duration_ms: computeDuration(data.market_data_started_at, data.market_data_completed_at),
      detail: marketDataStatus === 'failed' ? (data.error || 'Failed') : marketDataStatus === 'skipped' ? 'Skipped' : null,
    },
    {
      label: 'Corroboration',
      status: corroborationStatus,
      started_at: null,
      completed_at: data.corroboration_completed_at || null,
      duration_ms: null,
      detail: corroborationStatus === 'failed' ? (data.error || 'Failed') : corroborationStatus === 'skipped' ? 'Skipped' : null,
    },
    {
      label: 'Content',
      status: contentStatus,
      started_at: data.content_started_at || null,
      completed_at: data.content_completed_at || null,
      duration_ms: computeDuration(data.content_started_at, data.content_completed_at),
      detail: contentStatus === 'failed' ? (data.error || 'Failed') : contentStatus === 'skipped' ? 'Skipped' : null,
    },
  ]

  return stages
}

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

    const articleCount = Number(data.article_count || data.total_articles || 0)
    const resolvedArticleCount = articleCount === 0
      ? await redis.scard(keys.articlesBySweep(id)).then((c) => Number(c) || 0).catch(() => 0)
      : articleCount
    const pipelineStages = buildPipelineStages(data, resolvedArticleCount)

    const sweep: SweepRecord = {
      id: data.id,
      started_at: data.started_at || (zScores ? new Date(Number(zScores) * 1000).toISOString() : ''),
      completed_at: data.completed_at || null,
      status: data.status as SweepRecord['status'],
      topics: safeParseArray(data.topics) as Topic[],
      article_count: resolvedArticleCount,
      error: data.error || null,
      triggered_by: (data.triggered_by || 'manual') as SweepRecord['triggered_by'],
      pdf_report_url: data.pdf_report_url || null,
      linkedin_post: data.linkedin_post || null,
      pipeline_stage: data.pipeline_stage as SweepRecord['pipeline_stage'],
      news_status: data.news_status as StageStatus,
      news_started_at: data.news_started_at || null,
      news_completed_at: data.news_completed_at || null,
      market_data_status: data.market_data_status as StageStatus,
      market_data_started_at: data.market_data_started_at || null,
      market_data_completed_at: data.market_data_completed_at || null,
      corroboration_status: data.corroboration_status as StageStatus,
      corroboration_completed_at: data.corroboration_completed_at || null,
      content_status: data.content_status as StageStatus,
      content_started_at: data.content_started_at || null,
      content_completed_at: data.content_completed_at || null,
      pipeline_stages: pipelineStages,
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
