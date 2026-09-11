import { NextResponse } from 'next/server'
import { getHeatmapData } from '@/lib/services/market-intelligence'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getHeatmapData()
    return NextResponse.json({
      data,
      total: Object.keys(data.cells).length,
      meta: { sweep_id: null, relevance_threshold: 0, timestamp: new Date().toISOString() },
    })
  } catch (error) {
    console.error('GET /api/heatmap/topic-entity error:', error)
    return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 })
  }
}
