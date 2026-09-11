import { NextRequest, NextResponse } from 'next/server'
import { getEntityDashboard, getRelatedArticles } from '@/lib/services/market-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const decodedName = decodeURIComponent(name)
    const dashboard = await getEntityDashboard(decodedName)

    if (!dashboard.profile) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const withRelated = searchParams.get('related') === 'true'

    let relatedArticles: any[] = []
    if (withRelated && dashboard.articles.length > 0) {
      const firstArticle = dashboard.articles[0]
      if (firstArticle?.id) {
        relatedArticles = await getRelatedArticles(firstArticle.id, 10)
      }
    }

    return NextResponse.json({
      data: {
        ...dashboard,
        relatedArticles,
      },
      total: 1,
      meta: { sweep_id: null, relevance_threshold: 0, timestamp: new Date().toISOString() },
    })
  } catch (error) {
    console.error('GET /api/entities/[name] error:', error)
    return NextResponse.json({ error: 'Failed to fetch entity' }, { status: 500 })
  }
}
