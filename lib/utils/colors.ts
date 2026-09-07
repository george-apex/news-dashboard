import { Topic, SourceType, CorroborationLevel } from '@/types'

export const TOPIC_COLORS: Record<Topic, string> = {
  capital_markets: '#3b82f6',
  ai_industry: '#8b5cf6',
  ai_sovereignty: '#ef4444',
  open_weight: '#10b981',
  agentic_ai: '#f59e0b',
  ai_fintech: '#06b6d4',
  ai_regulation: '#ec4899',
}

export const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  rss: '#6366f1',
  api: '#14b8a6',
  reddit: '#f97316',
  arxiv: '#a855f7',
  tavily: '#64748b',
}

export function getSentimentColor(score: number): string {
  if (score > 0.3) return '#10b981'
  if (score < -0.3) return '#ef4444'
  return '#f59e0b'
}

export function getCorroborationColor(level: CorroborationLevel): string {
  switch (level) {
    case 'high': return '#10b981'
    case 'medium': return '#f59e0b'
    case 'low': return '#6b7280'
  }
}

export function getSentimentLabel(score: number): string {
  if (score > 0.3) return 'Positive'
  if (score < -0.3) return 'Negative'
  return 'Neutral'
}
