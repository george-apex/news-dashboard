import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { MarketDataStock, MacroIndicators } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redis = getRedisClient()
    const { searchParams } = new URL(request.url)
    const includeSectors = searchParams.get('sectors') !== 'false'
    const includeYieldCurve = searchParams.get('yield') !== 'false'
    const includeSparklines = searchParams.get('sparklines') === 'true'

    const entityNames = await redis.zrange(keys.marketdataByEntity(), 0, -1) as string[]

    const stockPromises = entityNames.map((name) => {
      const entityName = typeof name === 'string' ? name : String(name)
      return redis.hgetall<Record<string, string>>(keys.marketdataEntity(entityName))
    })

    const [macroRaw, ...stockResults] = await Promise.all([
      redis.hgetall<Record<string, string>>(keys.marketdataMacro()),
      ...stockPromises,
    ])

    const stocks: (MarketDataStock & { sparkline?: number[] })[] = []
    const indices: MarketDataStock[] = []
    const sectors: MarketDataStock[] = []

    for (const data of stockResults) {
      if (data && Object.keys(data).length > 0) {
        const stock: MarketDataStock & { sparkline?: number[] } = {
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
          if (includeSparklines) {
            const ohlcv = await redis.get(keys.marketdataOhlcv(data.entity_name || data.ticker || ''))
            if (ohlcv && typeof ohlcv === 'string' && ohlcv.includes(',')) {
              const closes = ohlcv.split(';').filter((l: string) => l.trim()).map((l: string) => {
                const parts = l.split(',')
                return Number(parts[4]) || 0
              }).filter((v: number) => v > 0)
              stock.sparkline = closes
            } else {
              const profileData = await redis.hgetall<Record<string, string>>(keys.entityProfile(data.entity_name || ''))
              if (profileData && profileData.price_trend) {
                try {
                  stock.sparkline = JSON.parse(profileData.price_trend as string)
                } catch {}
              }
            }
          }
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

    let sectorPerformance: { sector: string; avg_change_pct: number; count: number }[] = []
    if (includeSectors) {
      const sectorEtfs = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLRE', 'XLB', 'XLC', 'XOP']
      const sectorPipeline = redis.pipeline()
      for (const etf of sectorEtfs) {
        sectorPipeline.hgetall(keys.marketdataSector(etf))
      }
      const sectorResults = await sectorPipeline.exec<Record<string, string>[]>()
      sectorPerformance = sectorResults
        .filter(r => r && Object.keys(r).length > 0)
        .map(r => ({
          sector: r.name || r.entity_name || r.ticker || '',
          avg_change_pct: Number(r.price_change_pct || r.avg_change_pct || 0),
          count: Number(r.count || 1),
        }))
    }

    let yieldCurve: { maturity: string; value: number; spread_vs_2y: number }[] = []
    if (includeYieldCurve && macro) {
      const dgs2 = Number(macro.dgs2) || 0
      yieldCurve = [
        { maturity: '2Y', value: dgs2, spread_vs_2y: 0 },
        { maturity: '5Y', value: Number(macro.dgs5) || 0, spread_vs_2y: (Number(macro.dgs5) || 0) - dgs2 },
        { maturity: '10Y', value: Number(macro.dgs10) || 0, spread_vs_2y: (Number(macro.dgs10) || 0) - dgs2 },
        { maturity: '30Y', value: Number(macro.dgs30) || 0, spread_vs_2y: (Number(macro.dgs30) || 0) - dgs2 },
      ]
    }

    return NextResponse.json({
      stocks,
      macro,
      indices,
      sectors,
      sectorPerformance,
      yieldCurve,
    })
  } catch (error) {
    console.error('GET /api/marketdata error:', error)
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 })
  }
}
