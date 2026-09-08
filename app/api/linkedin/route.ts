import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { LinkedInPost, Topic } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const sweepId = searchParams.get('sweep_id')
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))

    let postIds: string[]

    if (sweepId) {
      postIds = await redis.smembers(keys.linkedinBySweep(sweepId)) as string[]
    } else {
      postIds = await redis.zrange(keys.linkedinByDate(), 0, limit - 1, { rev: true }) as string[]
    }

    if (postIds.length === 0) {
      return NextResponse.json({ posts: [] })
    }

    postIds = postIds.slice(0, limit)

    const pipeline = redis.pipeline()
    for (const id of postIds) {
      pipeline.hgetall(keys.linkedin(id))
    }
    const results = await pipeline.exec<Record<string, string>[]>()
    const posts: LinkedInPost[] = results
      .map((d, i) => {
        if (!d || Object.keys(d).length === 0) return null
        return {
          id: d.id || postIds[i],
          sweep_id: d.sweep_id,
          topic: d.topic as Topic,
          content: d.content,
          angle: d.angle || '',
          created_at: d.created_at,
          status: d.status as LinkedInPost['status'],
          source_article_url: d.source_article_url || '',
          source_article_title: d.source_article_title || '',
          source_article_id: d.source_article_id || '',
        }
      })
      .filter(Boolean) as LinkedInPost[]

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('GET /api/linkedin error:', error)
    return NextResponse.json({ error: 'Failed to fetch LinkedIn posts' }, { status: 500 })
  }
}
