import { Topic, SourceType } from '@/types'

export const TOPICS: Topic[] = [
  'capital_markets',
  'ai_industry',
  'ai_sovereignty',
  'open_weight',
  'agentic_ai',
  'ai_fintech',
  'ai_regulation',
]

export const SOURCE_TYPES: SourceType[] = ['rss', 'api', 'reddit', 'arxiv', 'tavily']

export const TOPIC_LABELS: Record<Topic, string> = {
  capital_markets: 'Capital Markets',
  ai_industry: 'AI Industry',
  ai_sovereignty: 'AI Sovereignty',
  open_weight: 'Open Weight',
  agentic_ai: 'Agentic AI',
  ai_fintech: 'AI FinTech',
  ai_regulation: 'AI Regulation',
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: 'RSS',
  api: 'API',
  reddit: 'Reddit',
  arxiv: 'arXiv',
  tavily: 'Tavily',
}
