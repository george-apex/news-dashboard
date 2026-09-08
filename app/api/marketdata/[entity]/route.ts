import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { MarketDataStock } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params
    const redis = getRedisClient()
    const data = await redis.hgetall<Record<string, string>>(keys.marketdataEntity(entity))

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Entity market data not found' }, { status: 404 })
    }

    const stock: MarketDataStock = {
      entity_name: data.entity_name || entity,
      ticker: data.ticker || '',
      latest_price: data.latest_price || '0',
      price_change_pct: data.price_change_pct || '0',
      price_change_direction: (data.price_change_direction as MarketDataStock['price_change_direction']) || 'flat',
      updated_at: data.updated_at || '',
    }

    return NextResponse.json(stock)
  } catch (error) {
    console.error('GET /api/marketdata/[entity] error:', error)
    return NextResponse.json({ error: 'Failed to fetch entity market data' }, { status: 500 })
  }
}
