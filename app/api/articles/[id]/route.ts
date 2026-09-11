import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, keys } from '@/lib/redis'
import { readArticleKey } from '@/lib/redis/queries'
import { Topic, Article, MarketDataStock, MacroIndicators, MarketContext } from '@/types'

export const revalidate = 120
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const redis = getRedisClient()
    const data = await readArticleKey(redis, id)

    if (!data) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const article: Article = {
      id: String(data.id ?? ''),
      title: String(data.title ?? ''),
      url: String(data.url ?? ''),
      date: String(data.date ?? ''),
      source: String(data.source ?? ''),
      source_type: String(data.source_type ?? '') as Article['source_type'],
      relevance_score: Number(data.relevance_score) || 0,
      corroboration_score: String(data.corroboration_score ?? 'low') as Article['corroboration_score'],
      source_count: Number(data.source_count) || 0,
      sentiment_score: Number(data.sentiment_score) || 0,
      entities: (typeof data.entities === 'string' ? JSON.parse(data.entities as string) : data.entities || []) as Article['entities'],
      topic: String(data.topic ?? '') as Topic,
      summary: data.summary ? String(data.summary) : null,
      fetched_at: String(data.fetched_at ?? ''),
      sweep_id: String(data.sweep_id ?? ''),
    }

    let marketContext: MarketContext | null = null

    const entityNames = article.entities.map((e) => e.name)
    if (entityNames.length > 0) {
      const stockPromises = entityNames.map((name) =>
        redis.hgetall<Record<string, string>>(keys.marketdataEntity(name))
      )
      const [macroRaw, ...stockResults] = await Promise.all([
        redis.hgetall<Record<string, string>>(keys.marketdataMacro()),
        ...stockPromises,
      ])

      const stocks: MarketDataStock[] = []
      for (const sd of stockResults) {
        if (sd && Object.keys(sd).length > 0) {
          stocks.push({
            entity_name: sd.entity_name || '',
            ticker: sd.ticker || '',
            latest_price: sd.latest_price || sd.price || '0',
            price_change_pct: sd.price_change_pct || sd.change_pct || '0',
            price_change_direction: (sd.price_change_direction as MarketDataStock['price_change_direction']) || 'flat',
            updated_at: sd.updated_at || '',
          })
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

      if (stocks.length > 0) {
        marketContext = { stocks, macro }
      }
    }

    return NextResponse.json({ ...article, market_context: marketContext })
  } catch (error) {
    console.error('GET /api/articles/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}
