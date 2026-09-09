import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { MarketDataStock, MacroIndicators } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    const indices: MarketDataStock[] = []
    const sectors: MarketDataStock[] = []

    for (const data of stockResults) {
      if (data && Object.keys(data).length > 0) {
        const stock: MarketDataStock = {
          entity_name: data.entity_name || '',
          ticker: data.ticker || '',
          latest_price: data.latest_price || data.price || '0',
          price_change_pct: data.price_change_pct || data.change_pct || '0',
          price_change_direction: (data.price_change_direction as MarketDataStock['price_change_direction']) || 'flat',
          updated_at: data.updated_at || '',
        }

        const name = (data.entity_name || '').toLowerCase()
        if (name.includes('_sector') || name.includes(' sector')) {
          sectors.push(stock)
        } else if (name === 's&p_500' || name === 'nasdaq' || name === 'dow_jones' || name.includes('index')) {
          indices.push(stock)
        } else {
          stocks.push(stock)
        }
      }
    }

    let macro: MacroIndicators | null = null
    if (macroRaw && Object.keys(macroRaw).length > 0) {
      macro = {
        dgs2: macroRaw.dgs2 || '0',
        dgs5: macroRaw.dgs5 || '0',
        dgs10: macroRaw.dgs10 || '0',
        dgs30: macroRaw.dgs30 || '0',
        vix: macroRaw.vix || '0',
        fedfunds: macroRaw.fedfunds || '0',
        unemployment: macroRaw.unemployment || '0',
        cpi: macroRaw.cpi || '0',
        updated_at: macroRaw.updated_at || '',
      }
    }

    return NextResponse.json({ stocks, macro, indices, sectors })
  } catch (error) {
    console.error('GET /api/marketdata error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 })
  }
}
