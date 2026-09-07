'use client'

import { useFilterStore } from '@/stores/filters'
import { CorroborationLevel } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CorroborationFilter() {
  const { corroboration, setFilter } = useFilterStore()

  return (
    <Select value={corroboration || 'all'} onValueChange={(v) => setFilter('corroboration', v === 'all' ? null : v as CorroborationLevel)}>
      <SelectTrigger className="w-36 h-8 text-xs">
        <SelectValue placeholder="Corroboration" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Levels</SelectItem>
        <SelectItem value="high">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            High
          </span>
        </SelectItem>
        <SelectItem value="medium">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Medium
          </span>
        </SelectItem>
        <SelectItem value="low">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Low
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
