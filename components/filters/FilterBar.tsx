'use client'

import { useFilterStore } from '@/stores/filters'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { TopicFilter } from './TopicFilter'
import { SourceFilter } from './SourceFilter'
import { SentimentSlider } from './SentimentSlider'
import { CorroborationFilter } from './CorroborationFilter'
import { DateRangePicker } from './DateRangePicker'
import { SearchInput } from './SearchInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function FilterBar() {
  const { sort, order, clearAll, topics, sourceType, corroboration, sentimentMin, sentimentMax, dateFrom, dateTo } = useFilterStore()
  const hasActiveFilters = topics.length > 0 || sourceType || corroboration || sentimentMin > -1 || sentimentMax < 1 || dateFrom || dateTo

  return (
    <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <TopicFilter />
        <SourceFilter />
        <CorroborationFilter />
        <SentimentSlider />
        <DateRangePicker />
        <SearchInput />

        <Select value={sort} onValueChange={(v) => useFilterStore.getState().setFilter('sort', v as 'date' | 'relevance' | 'sentiment')}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="sentiment">Sentiment</SelectItem>
          </SelectContent>
        </Select>

        <Select value={order} onValueChange={(v) => useFilterStore.getState().setFilter('order', v as 'asc' | 'desc')}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearAll}>
            <X className="h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>
    </div>
  )
}
