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
      id: data.id,
      sweep_id: data.sweep_id,
      topic: data.topic as Topic,
      content: data.content,
      angle: data.angle || '',
      created_at: data.created_at,
      status: data.status as LinkedInPost['status'],
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error('GET /api/linkedin/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch LinkedIn post' }, { status: 500 })
  }
}
