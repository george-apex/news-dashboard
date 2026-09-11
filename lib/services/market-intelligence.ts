import { getRedisClient } from '@/lib/redis'
import { keys } from '@/lib/redis'
import { TOPICS } from '@/lib/utils/constants'
import { EntityProfile, MarketDataStock } from '@/types'

export async function getEntityDashboard(name: string) {
  const redis = getRedisClient()
  const pipeline = redis.pipeline()

  pipeline.hgetall(keys.entityProfile(name))
  pipeline.hgetall(keys.entity(name))
  pipeline.hgetall(keys.marketdataEntity(name))
  pipeline.zrange(keys.entityArticles(name), 0, 19, { rev: true })
  pipeline.get(keys.marketdataOhlcv(name))

  const results = await pipeline.exec<any[]>()
  const profileData = results[0] as Record<string, string> | null
  const statData = results[1] as Record<string, string> | null
  const marketData = results[2] as Record<string, string> | null
  const articleIds = (results[3] as string[]) || []
  const ohlcv7d = (results[4] as string) || null

  let articles: any[] = []
  if (articleIds.length > 0) {
    const artPipeline = redis.pipeline()
    for (const id of articleIds) {
      artPipeline.hgetall(keys.article(id))
    }
    const artResults = await artPipeline.exec<Record<string, string>[]>()
    articles = artResults.filter(r => r && Object.keys(r).length > 0)
  }

  const relatedEntityNames = new Map<string, number>()
  if (articles.length > 0) {
    for (const art of articles) {
      try {
        const artEntities = typeof art.entities === 'string' ? JSON.parse(art.entities) : (art.entities || [])
        for (const e of artEntities) {
          const eName = typeof e === 'string' ? e : e.name
          if (eName && eName !== name) {
            relatedEntityNames.set(eName, (relatedEntityNames.get(eName) || 0) + 1)
          }
        }
      } catch {}
    }
  }
  const related = Array.from(relatedEntityNames.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([eName]) => eName)

  return {
    profile: profileData && Object.keys(profileData).length > 0 ? deserializeEntityProfile(profileData) : null,
    stat: statData || null,
    marketData: marketData && Object.keys(marketData).length > 0 ? { ...marketData, ohlcv_7d: ohlcv7d } : { ohlcv_7d: ohlcv7d },
    articles,
    relatedEntities: related,
  }
}

export async function getArticleWithMarketData(articleId: string) {
  const redis = getRedisClient()
  const articleData = await redis.hgetall<Record<string, string>>(keys.article(articleId))
  if (!articleData || Object.keys(articleData).length === 0) return null

  let marketDataStocks: MarketDataStock[] = []
  const refsRaw = articleData.market_data_refs
  if (refsRaw) {
    try {
      const refs = JSON.parse(refsRaw) as { ticker: string; entity: string; tier: string }[]
      if (refs.length > 0) {
        const pipeline = redis.pipeline()
        for (const ref of refs) {
          pipeline.hgetall(keys.marketdataEntity(ref.entity))
        }
        const results = await pipeline.exec<Record<string, string>[]>()
        marketDataStocks = results
          .filter(r => r && Object.keys(r).length > 0)
          .map(r => ({
            entity_name: r.entity_name || '',
            ticker: r.ticker || '',
            latest_price: r.latest_price || r.price || '',
            price_change_pct: r.price_change_pct || r.change_percent || '',
            price_change_direction: (r.price_change_direction as 'up' | 'down' | 'flat') || 'flat',
            updated_at: r.updated_at || '',
          }))
      }
    } catch {}
  }

  if (marketDataStocks.length === 0) {
    try {
      const entities = JSON.parse(articleData.entities || '[]') as { name: string; type: string }[]
      if (entities.length > 0) {
        const pipeline = redis.pipeline()
        for (const e of entities) {
          pipeline.hgetall(keys.marketdataEntity(e.name))
        }
        const results = await pipeline.exec<Record<string, string>[]>()
        marketDataStocks = results
          .filter(r => r && Object.keys(r).length > 0)
          .map(r => ({
            entity_name: r.entity_name || '',
            ticker: r.ticker || '',
            latest_price: r.latest_price || r.price || '',
            price_change_pct: r.price_change_pct || r.change_percent || '',
            price_change_direction: (r.price_change_direction as 'up' | 'down' | 'flat') || 'flat',
            updated_at: r.updated_at || '',
          }))
      }
    } catch {}
  }

  return {
    article: articleData,
    marketData: marketDataStocks,
    financialRelevance: Number(articleData.financial_relevance) || 0,
    hasMarketData: articleData.has_market_data === 'true',
  }
}

export async function getSignalBoard(threshold: number = 75) {
  const redis = getRedisClient()

  const articleIds = await redis.zrange(keys.articlesByRelevance(), 0, 199, { rev: true }) as string[]
  if (!articleIds || articleIds.length === 0) return []

  const pipeline = redis.pipeline()
  for (const id of articleIds) {
    pipeline.hgetall(keys.article(id))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  const articles = results.filter(r => r && Object.keys(r).length > 0)

  const filtered = articles.filter(a => {
    const rel = Number(a.relevance_score) || 0
    return rel >= threshold && a.has_market_data === 'true'
  })

  const entityNames = new Set<string>()
  for (const a of filtered) {
    try {
      const refs = JSON.parse(a.market_data_refs || '[]')
      for (const ref of refs) {
        if (ref.entity) entityNames.add(ref.entity)
      }
    } catch {}
  }

  const profilePipeline = redis.pipeline()
  for (const name of entityNames) {
    profilePipeline.hgetall(keys.entityProfile(name))
  }
  const profileResults = await profilePipeline.exec<Record<string, string>[]>()
  const profiles = profileResults
    .filter(r => r && Object.keys(r).length > 0)
    .map(deserializeEntityProfile)

  const signals = profiles
    .map(p => {
      let divergenceType = 'none'
      let divergenceDescription = ''
      if (p.avg_sentiment < -0.3 && p.price_change_direction === 'up') {
        divergenceType = 'negative_news_rising_price'
        divergenceDescription = `Negative sentiment (${p.avg_sentiment.toFixed(2)}) but price rising (${p.price_change_pct}%)`
      } else if (p.avg_sentiment > 0.3 && p.price_change_direction === 'down') {
        divergenceType = 'positive_news_falling_price'
        divergenceDescription = `Positive sentiment (${p.avg_sentiment.toFixed(2)}) but price falling (${p.price_change_pct}%)`
      }
      return {
        entity: p.name,
        ticker: p.ticker,
        avg_sentiment: p.avg_sentiment,
        price_change_pct: p.price_change_pct,
        price_change_direction: p.price_change_direction,
        mention_count: p.mention_count,
        correlation: p.correlation,
        signal_strength: p.signal_strength || 'weak',
        divergenceType,
        divergenceDescription,
      }
    })
    .filter(s => s.divergenceType !== 'none')

  return signals
}

export async function getRelatedArticles(articleId: string, limit: number = 10) {
  const redis = getRedisClient()
  const article = await redis.hgetall<Record<string, string>>(keys.article(articleId))
  if (!article || Object.keys(article).length === 0) return []

  const articleTopic = article.topic
  let articleEntities: { name: string; type: string }[] = []
  try {
    articleEntities = JSON.parse(article.entities || '[]')
  } catch {}

  const candidateIds = new Map<string, number>()

  for (const e of articleEntities) {
    const ids = await redis.zrange(keys.entityArticles(e.name), 0, 49, { rev: true }) as string[]
    for (const id of ids) {
      if (id === articleId) continue
      candidateIds.set(id, (candidateIds.get(id) || 0) + 1)
    }
  }

  const sortedCandidates = Array.from(candidateIds.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2)

  if (sortedCandidates.length === 0) return []

  const pipeline = redis.pipeline()
  for (const [id] of sortedCandidates) {
    pipeline.hgetall(keys.article(id))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  const relatedArticles = results
    .filter(r => r && Object.keys(r).length > 0)
    .map((data, i) => ({
      id: data.id,
      title: data.title,
      url: data.url,
      date: data.date,
      source: data.source,
      topic: data.topic,
      relevance_score: Number(data.relevance_score) || 0,
      sentiment_score: Number(data.sentiment_score) || 0,
      shared_entities: sortedCandidates[i][1],
      topic_match: data.topic === articleTopic ? 1 : 0,
      score: sortedCandidates[i][1] + (data.topic === articleTopic ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return relatedArticles
}

export async function getEntityMovers(limit: number = 20) {
  const redis = getRedisClient()

  const entityNames = await redis.zrange(keys.entitiesByMentions(), 0, limit - 1, { rev: true }) as string[]
  if (!entityNames || entityNames.length === 0) return []

  const pipeline = redis.pipeline()
  for (const name of entityNames) {
    pipeline.hgetall(keys.entityProfile(name))
  }
  const results = await pipeline.exec<Record<string, string>[]>()
  const profiles = results
    .filter(r => r && Object.keys(r).length > 0)
    .map(deserializeEntityProfile)

  const movers = profiles
    .map(p => ({
      name: p.name,
      ticker: p.ticker,
      price_change_pct: p.price_change_pct,
      price_change_direction: p.price_change_direction,
      mention_count: p.mention_count,
      avg_sentiment: p.avg_sentiment,
      correlation: p.correlation,
      mover_score: Math.abs(p.price_change_pct) * Math.log(p.mention_count + 1),
    }))
    .sort((a, b) => b.mover_score - a.mover_score)

  return movers
}

export async function getHeatmapData() {
  const redis = getRedisClient()

  const heatmapData = await redis.hgetall<Record<string, string>>(keys.heatmapTopicEntity())
  if (heatmapData && Object.keys(heatmapData).length > 0) {
    const cells: Record<string, Record<string, { count: number; avg_sentiment: number }>> = {}
    for (const [key, value] of Object.entries(heatmapData)) {
      const [topic, entity] = key.split(':')
      if (!topic || !entity) continue
      try {
        const parsed = JSON.parse(value)
        if (!cells[topic]) cells[topic] = {}
        cells[topic][entity] = parsed
      } catch {}
    }

    const entities = new Set<string>()
    for (const topic in cells) {
      for (const entity in cells[topic]) {
        entities.add(entity)
      }
    }
    const scatterData = Array.from(entities).map(name => {
      let totalCount = 0
      let totalSentiment = 0
      for (const topic in cells) {
        if (cells[topic][name]) {
          totalCount += cells[topic][name].count
          totalSentiment += cells[topic][name].avg_sentiment * cells[topic][name].count
        }
      }
      return {
        entity: name,
        total_count: totalCount,
        avg_sentiment: totalCount > 0 ? totalSentiment / totalCount : 0,
      }
    })

    return { rows: TOPICS, cells, scatterData }
  }

  const entityNames = await redis.zrange(keys.entitiesByMentions(), 0, 19, { rev: true }) as string[]
  const cells: Record<string, Record<string, { count: number; avg_sentiment: number }>> = {}

  for (let i = 0; i < entityNames.length; i += 10) {
    const batch = entityNames.slice(i, i + 10)
    const pipeline = redis.pipeline()
    for (const name of batch) {
      pipeline.zrange(keys.entityArticles(name), 0, -1, { rev: true })
    }
    const articleIdBatches = await pipeline.exec<string[][]>()

    for (let j = 0; j < batch.length; j++) {
      const entityName = batch[j]
      const artIds = articleIdBatches[j] || []
      if (artIds.length === 0) continue

      const artPipeline = redis.pipeline()
      for (const id of artIds.slice(0, 50)) {
        artPipeline.hgetall(keys.article(id))
      }
      const artResults = await artPipeline.exec<Record<string, string>[]>()
      const arts = artResults.filter(r => r && Object.keys(r).length > 0)

      for (const a of arts) {
        const topic = a.topic
        if (!topic) continue
        if (!cells[topic]) cells[topic] = {}
        if (!cells[topic][entityName]) cells[topic][entityName] = { count: 0, avg_sentiment: 0 }
        cells[topic][entityName].count += 1
        cells[topic][entityName].avg_sentiment += Number(a.sentiment_score) || 0
      }

      for (const topic in cells) {
        if (cells[topic][entityName] && cells[topic][entityName].count > 0) {
          cells[topic][entityName].avg_sentiment /= cells[topic][entityName].count
        }
      }
    }
  }

  const entities = new Set<string>()
  for (const topic in cells) {
    for (const entity in cells[topic]) {
      entities.add(entity)
    }
  }
  const scatterData = Array.from(entities).map(name => {
    let totalCount = 0
    let totalSentiment = 0
    for (const topic in cells) {
      if (cells[topic][name]) {
        totalCount += cells[topic][name].count
        totalSentiment += cells[topic][name].avg_sentiment * cells[topic][name].count
      }
    }
    return {
      entity: name,
      total_count: totalCount,
      avg_sentiment: totalCount > 0 ? totalSentiment / totalCount : 0,
    }
  })

  return { rows: TOPICS, cells, scatterData }
}

function deserializeEntityProfile(data: Record<string, string>): EntityProfile {
  return {
    name: data.name,
    ticker: data.ticker || '',
    latest_price: Number(data.latest_price) || 0,
    price_change_pct: Number(data.price_change_pct) || 0,
    price_change_direction: (data.price_change_direction as 'up' | 'down' | 'flat') || 'flat',
    mention_count: Number(data.mention_count) || 0,
    avg_sentiment: Number(data.avg_sentiment) || 0,
    top_headlines: typeof data.top_headlines === 'string' ? JSON.parse(data.top_headlines) : [],
    sentiment_trend: typeof data.sentiment_trend === 'string' ? JSON.parse(data.sentiment_trend) : [],
    price_trend: typeof data.price_trend === 'string' ? JSON.parse(data.price_trend) : [],
    correlation: (data.correlation as 'aligned' | 'divergent' | 'neutral') || 'neutral',
    topics: typeof data.topics === 'string' ? JSON.parse(data.topics) : [],
    updated_at: data.updated_at || '',
    sector: data.sector || '',
    tier: (data.tier as 'full' | 'standard' | 'none') || 'none',
    correlation_raw: Number(data.correlation_raw) || 0,
    signal_strength: (data.signal_strength as 'strong' | 'moderate' | 'weak') || 'weak',
  }
}
