import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { LinkedInPost, Topic } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()
    const data = await redis.hgetall<Record<string, string>>(keys.linkedin(id))

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const post: LinkedInPost = {
      id: data.id || id,
      sweep_id: data.sweep_id,
      topic: data.topic as Topic,
      content: data.content,
      angle: data.angle || '',
      created_at: data.created_at,
      status: data.status as LinkedInPost['status'],
      source_article_url: data.source_article_url || '',
      source_article_title: data.source_article_title || '',
      source_article_id: data.source_article_id || '',
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error('GET /api/linkedin/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch LinkedIn post' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()

    const data = await redis.hgetall(keys.linkedin(id))
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const pipeline = redis.pipeline()
    pipeline.del(keys.linkedin(id))
    pipeline.zrem(keys.linkedinByDate(), id)
    if (data.sweep_id) {
      pipeline.srem(keys.linkedinBySweep(String(data.sweep_id)), id)
    }
    await pipeline.exec()

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('DELETE /api/linkedin/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete LinkedIn post' }, { status: 500 })
  }
}
