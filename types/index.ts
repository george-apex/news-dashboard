export type Topic =
  | 'capital_markets'
  | 'ai_industry'
  | 'ai_sovereignty'
  | 'open_weight'
  | 'agentic_ai'
  | 'ai_fintech'
  | 'ai_regulation'

export type SourceType = 'rss' | 'api' | 'reddit' | 'arxiv' | 'tavily'

export type CorroborationLevel = 'high' | 'medium' | 'low'

export type EntityType = 'company' | 'person' | 'technology'

export interface Entity {
  name: string
  type: EntityType
}

export interface Article {
  id: string
  title: string
  url: string
  date: string
  source: string
  source_type: SourceType
  relevance_score: number
  corroboration_score: CorroborationLevel | number
  source_count: number
  sentiment_score: number
  entities: Entity[]
  topic: Topic
  summary: string | null
  fetched_at: string
  sweep_id: string
}

export type PipelineStage = 'news_fetching' | 'news_completed' | 'market_data_fetching' | 'market_data_completed' | 'corroborating' | 'content_generating' | 'completed' | 'failed'

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface PipelineStageInfo {
  label: string
  status: StageStatus
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  detail: string | null
}

export interface SweepRecord {
  id: string
  started_at: string
  completed_at: string | null
  status: 'running' | 'completed' | 'failed' | 'stale'
  topics: Topic[]
  article_count: number
  error: string | null
  triggered_by: 'manual' | 'scheduled'
  pdf_report_url: string | null
  linkedin_post: string | null
  is_stale?: boolean
  pipeline_stage?: PipelineStage
  news_status?: StageStatus
  news_started_at?: string | null
  news_completed_at?: string | null
  market_data_status?: StageStatus
  market_data_started_at?: string | null
  market_data_completed_at?: string | null
  corroboration_status?: StageStatus
  corroboration_completed_at?: string | null
  content_status?: StageStatus
  content_started_at?: string | null
  content_completed_at?: string | null
  pipeline_stages?: PipelineStageInfo[]
}

export interface EntityStat {
  name: string
  type: EntityType
  mention_count: number
  avg_sentiment: number
  topics: Topic[]
  first_seen: string
  last_seen: string
  trend_direction: 'up' | 'down' | 'stable'
}

export interface TopicStat {
  topic: Topic
  article_count: number
  avg_sentiment: number
  avg_relevance: number
  high_corroboration_count: number
  top_entities: string[]
  last_updated: string
}

export interface LinkedInPost {
  id: string
  sweep_id: string
  topic: Topic
  content: string
  angle: string
  created_at: string
  status: 'draft' | 'published'
  source_article_url: string
  source_article_title: string
  source_article_id: string
}

export interface MarketDataStock {
  entity_name: string
  ticker: string
  latest_price: string
  price_change_pct: string
  price_change_direction: 'up' | 'down' | 'flat'
  updated_at: string
}

export interface MacroIndicators {
  dgs10: string
  vix: string
  fedfunds: string
  updated_at: string
}

export interface MarketDataResponse {
  stocks: MarketDataStock[]
  macro: MacroIndicators | null
}

export interface MarketContext {
  stocks: MarketDataStock[]
  macro: MacroIndicators | null
}

export interface ArticleWithMarketContext extends Article {
  market_context: MarketContext | null
}

export interface ArticlesResponse {
  articles: Article[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

export interface TopicStatsResponse {
  topics: TopicStat[]
  last_updated: string
}

export interface EntitiesResponse {
  entities: EntityStat[]
}

export interface TrendingEntitiesResponse {
  entities: (EntityStat & { trend_delta: number })[]
}

export interface SentimentTrendResponse {
  data: { date: string; avg_sentiment: number; article_count: number }[]
}

export interface TopicDistributionResponse {
  data: { topic: Topic; count: number; avg_sentiment: number; avg_relevance: number }[]
}

export interface SourcesResponse {
  data: {
    source: string
    source_type: string
    count: number
    avg_relevance: number
    avg_sentiment: number
  }[]
}

export interface SweepsResponse {
  sweeps: SweepRecord[]
  total: number
}

export interface LinkedInPostsResponse {
  posts: LinkedInPost[]
}

export interface HeatmapResponse {
  rows: Topic[]
  cols: string[]
  cells: {
    [topic: string]: {
      [date: string]: { count: number; high_corr_count: number; avg_relevance: number }
    }
  }
}

export interface SourceQualityResponse {
  sources: {
    source: string
    source_type: string
    total_articles: number
    avg_relevance: number
    avg_sentiment: number
  }[]
}

export interface CoOccurrenceResponse {
  nodes: { id: string; type: string; mention_count: number }[]
  links: { source: string; target: string; weight: number }[]
}

export interface ArticlesQueryParams {
  topic?: string
  source?: string
  source_type?: SourceType
  sentiment_min?: number
  sentiment_max?: number
  corroboration?: CorroborationLevel
  date_from?: string
  date_to?: string
  min_relevance?: number
  entity?: string
  search?: string
  sort?: 'date' | 'relevance' | 'sentiment'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface SweepTriggerBody {
  topics?: Topic[]
  generate_pdf?: boolean
  generate_linkedin?: boolean
}

export interface ExportPdfBody {
  scope: 'dashboard' | 'topic' | 'sweep'
  topic?: Topic
  sweep_id?: string
  date_from: string
  date_to: string
}
