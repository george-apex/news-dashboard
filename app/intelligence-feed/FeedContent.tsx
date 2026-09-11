'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TopicBadge } from '@/components/common/TopicBadge'
import { RelevanceBar } from '@/components/common/RelevanceBar'
import { RelevanceSlider } from '@/components/filters/RelevanceSlider'
import { Search, Filter as FilterIcon, ArrowUp, ArrowDown, Minus, Newspaper } from 'lucide-react'
import { TOPICS, TOPIC_LABELS } from '@/lib/utils/constants'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function EntityChip({ name, ticker, priceChange }: { name: string; ticker?: string; priceChange?: string }) {
  const direction = Number(priceChange) > 0 ? 'up' : Number(priceChange) < 0 ? 'down' : 'flat'
  const color = direction === 'up' ? 'text-emerald-600 bg-emerald-50' : direction === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus

  return (
    <Link href={`/entities/${encodeURIComponent(name)}`} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity ${color}`}>
      {ticker || name}
      {priceChange && <Icon className="h-2.5 w-2.5" />}
    </Link>
  )
}

function FeedCard({ item }: { item: any }) {
  const article = item.article || item
  const marketData = item.marketData || []
  const sentiment = Number(article.sentiment_score) || 0
  const sentimentColor = sentiment > 0.3 ? 'bg-emerald-100 text-emerald-700' : sentiment < -0.3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
  const financialRelevance = item.financialRelevance || Number(article.financial_relevance) || 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary transition-colors line-clamp-2">
              {article.title}
            </a>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>{article.source}</span>
              <span>·</span>
              <span>{article.date ? new Date(article.date).toLocaleDateString() : ''}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${sentimentColor}`}>
              {sentiment >= 0 ? '+' : ''}{sentiment.toFixed(2)}
            </span>
            <RelevanceBar score={Number(article.relevance_score) || 0} />
          </div>
        </div>

        {article.topic && <TopicBadge topic={article.topic} />}

        {financialRelevance > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Financial Relevance:</span>
            <RelevanceBar score={financialRelevance} />
          </div>
        )}

        {marketData.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {marketData.map((m: any, i: number) => (
              <EntityChip key={i} name={m.entity_name} ticker={m.ticker} priceChange={m.price_change_pct} />
            ))}
          </div>
        )}

        {article.entities && (() => {
          try {
            const entities = typeof article.entities === 'string' ? JSON.parse(article.entities) : article.entities
            if (!Array.isArray(entities) || entities.length === 0) return null
            return (
              <div className="flex flex-wrap gap-1">
                {entities.slice(0, 5).map((e: any, i: number) => {
                  const name = typeof e === 'string' ? e : e.name
                  return name ? <Link key={i} href={`/entities/${encodeURIComponent(name)}`} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent transition-colors">{name}</Link> : null
                })}
              </div>
            )
          } catch { return null }
        })()}
      </CardContent>
    </Card>
  )
}

export function IntelligenceFeedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [showFilters, setShowFilters] = useState(false)

  const relevance = searchParams.get('relevance') || '75'
  const topic = searchParams.get('topic') || ''
  const sentimentMin = searchParams.get('sentiment_min') || ''
  const priceDir = searchParams.get('price_dir') || ''

  const params = new URLSearchParams()
  params.set('relevance', relevance)
  if (topic) params.set('topic', topic)
  if (search) params.set('search', search)
  if (sentimentMin) params.set('sentiment_min', sentimentMin)
  if (priceDir) params.set('price_dir', priceDir)

  const { data, error, isLoading } = useSWR(`/api/intelligence-feed?${params.toString()}`, fetcher, { refreshInterval: 120000 })

  const updateParam = (key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val)
    else p.delete(key)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  if (error) return <div className="p-6"><ErrorState message="Failed to load feed." onRetry={() => window.location.reload()} /></div>

  const articles = data?.data || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Intelligence Feed</h1>
        <div className="ml-auto flex items-center gap-3">
          <RelevanceSlider />
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <FilterIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && updateParam('search', search)}
                placeholder="Search articles..."
                className="h-8 w-56 rounded-md border border-input bg-transparent pl-8 pr-3 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select value={topic} onChange={(e) => updateParam('topic', e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">All Topics</option>
              {TOPICS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
            </select>
            <select value={sentimentMin} onChange={(e) => updateParam('sentiment_min', e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Any Sentiment</option>
              <option value="-0.3">Negative (&lt; -0.3)</option>
              <option value="0">Neutral (0+)</option>
              <option value="0.3">Positive (0.3+)</option>
            </select>
            <select value={priceDir} onChange={(e) => updateParam('price_dir', e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Any Price</option>
              <option value="up">Price Up</option>
              <option value="down">Price Down</option>
            </select>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : articles.length === 0 ? (
        <EmptyState message="No articles match your filters." />
      ) : (
        <div className="space-y-3">
          {articles.map((item: any) => (
            <FeedCard key={item.article?.id || item.id || Math.random()} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
