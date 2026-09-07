'use client'

import { useFilterStore } from '@/stores/filters'
import { SOURCE_TYPE_LABELS } from '@/lib/utils/constants'
import { SOURCE_TYPE_COLORS } from '@/lib/utils/colors'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function SourceFilter() {
  const { sourceType, setFilter } = useFilterStore()

  return (
    <Select value={sourceType || 'all'} onValueChange={(v) => setFilter('sourceType', v === 'all' ? null : v)}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue placeholder="Source Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        {(Object.entries(SOURCE_TYPE_LABELS) as [string, string][]).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SOURCE_TYPE_COLORS[key as keyof typeof SOURCE_TYPE_COLORS] }} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
