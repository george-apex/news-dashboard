import { NextRequest, NextResponse } from 'next/server'
import { getSignalBoard, getEntityMovers, getHeatmapData } from '@/lib/services/market-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const relevance = Number(searchParams.get('relevance') || 75)
    const view = searchParams.get('view') || 'signals'

    if (view === 'movers') {
      const movers = await getEntityMovers(20)
      return NextResponse.json({
        data: movers,
        total: movers.length,
        meta: { sweep_id: null, relevance_threshold: relevance, timestamp: new Date().toISOString() },
      })
    }

    if (view === 'scatter') {
      const heatmapData = await getHeatmapData()
      const scatter = heatmapData.scatterData || []
      return NextResponse.json({
        data: scatter,
        total: scatter.length,
        meta: { sweep_id: null, relevance_threshold: relevance, timestamp: new Date().toISOString() },
      })
    }

    const signals = await getSignalBoard(relevance)
    return NextResponse.json({
      data: signals,
      total: signals.length,
      meta: { sweep_id: null, relevance_threshold: relevance, timestamp: new Date().toISOString() },
    })
  } catch (error) {
    console.error('GET /api/signals error:', error)
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 })
  }
}
