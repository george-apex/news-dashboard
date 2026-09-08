'use client'

import { useSearchParams } from 'next/navigation'
import { useArticles } from '@/lib/hooks/useApiHooks'
import { useFilterStore } from '@/stores/filters'
import { FilterBar } from '@/components/filters/FilterBar'
import { ArticleCard } from '@/components/cards/ArticleCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Topic, CorroborationLevel } from '@/types'
import { useEffect, useState } from 'react'

export function FeedContent() {
  const searchParams = useSearchParams()
  const { topics, sourceType, corroboration, sort, order, search, sentimentMin, sentimentMax, dateFrom, dateTo, entity } = useFilterStore()
  const [page, setPage] = useState(1)

  useEffect(() => {
    const topicParam = searchParams.get('topic')
    const corrParam = searchParams.get('corroboration') as CorroborationLevel | null
    const sortParam = searchParams.get('sort') as 'date' | 'relevance' | 'sentiment' | null
    const entityParam = searchParams.get('entity')
    const sourceParam = searchParams.get('source')
    const store = useFilterStore.getState()

    if (topicParam) store.setFilter('topics', topicParam.split(',') as Topic[])
    if (corrParam) store.setFilter('corroboration', corrParam)
    if (sortParam) store.setFilter('sort', sortParam)
    if (entityParam) store.setFilter('entity', entityParam)
    if (sourceParam) store.setFilter('source', sourceParam)
  }, [searchParams])

  const { data, isLoading, error, mutate } = useArticles({
    topic: topics.length > 0 ? topics.join(',') : undefined,
    source_type: sourceType as 'rss' | 'api' | 'reddit' | 'arxiv' | 'tavily' | undefined,
    corroboration: corroboration ?? undefined,
    sort,
    order,
    search: search || undefined,
    page,
    limit: 50,
    sentiment_min: sentimentMin > -1 ? sentimentMin : undefined,
    sentiment_max: sentimentMax < 1 ? sentimentMax : undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
    entity: entity ?? undefined,
  })

  return (
    <div className="p-6">
      <FilterBar />

      <div className="flex items-center justify-between mb-4 mt-4">
        <p className="text-xs text-muted-foreground">
          {data
            ? `Results: ${((data.page - 1) * data.limit) + 1}–${Math.min(data.page * data.limit, data.total)} of ${data.total.toLocaleString()}`
            : 'Loading...'}
        </p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))
        ) : error ? (
          <ErrorState message="Failed to load articles" onRetry={() => mutate()} />
        ) : data?.articles?.length === 0 ? (
          <EmptyState message="No articles found. Try adjusting your filters or trigger a sweep." />
        ) : (
          data?.articles?.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>

      {data?.has_more && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
