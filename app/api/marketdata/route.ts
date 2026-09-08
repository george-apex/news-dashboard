import { NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { MarketDataStock, MacroIndicators } from '@/types'

export async function GET() {
  try {
    const redis = getRedisClient()

    const entityNames = await redis.zrange(keys.marketdataByEntity(), 0, -1) as string[]

    const stockPromises = entityNames.map((name) => {
      const entityName = typeof name === 'string' ? name : String(name)
      return redis.hgetall<Record<string, string>>(keys.marketdataEntity(entityName))
    })

    const [macroRaw, ...stockResults] = await Promise.all([
      redis.hgetall<Record<string, string>>(keys.marketdataMacro()),
      ...stockPromises,
    ])

    const stocks: MarketDataStock[] = []
    for (const data of stockResults) {
      if (data && Object.keys(data).length > 0) {
        stocks.push({
          entity_name: data.entity_name || '',
          ticker: data.ticker || '',
          latest_price: data.latest_price || '0',
          price_change_pct: data.price_change_pct || '0',
          price_change_direction: (data.price_change_direction as MarketDataStock['price_change_direction']) || 'flat',
          updated_at: data.updated_at || '',
        })
      }
    }

    let macro: MacroIndicators | null = null
    if (macroRaw && Object.keys(macroRaw).length > 0) {
      macro = {
        dgs10: macroRaw.dgs10 || '0',
        vix: macroRaw.vix || '0',
        fedfunds: macroRaw.fedfunds || '0',
        updated_at: macroRaw.updated_at || '',
      }
    }

    return NextResponse.json({ stocks, macro })
  } catch (error) {
    console.error('GET /api/marketdata error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 })
  }
}
