'use client'

import { useFilterStore } from '@/stores/filters'
import { Topic } from '@/types'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function TopicFilter() {
  const { topics, setFilter } = useFilterStore()

  return (
    <Select value={topics[0] || 'all'} onValueChange={(v) => setFilter('topics', v === 'all' ? [] : [v as Topic])}>
      <SelectTrigger className="w-40 h-8 text-xs">
        <SelectValue placeholder="Topic" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Topics</SelectItem>
        {(Object.entries(TOPIC_LABELS) as [Topic, string][]).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TOPIC_COLORS[key] }} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
