'use client'

import { useFilterStore } from '@/stores/filters'
import { Input } from '@/components/ui/input'
import { Calendar } from 'lucide-react'

export function DateRangePicker() {
  const { dateFrom, dateTo, setFilter } = useFilterStore()

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Calendar className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={dateFrom ?? ''}
          onChange={(e) => setFilter('dateFrom', e.target.value || null)}
          className="h-8 w-32 pl-7 text-xs"
        />
      </div>
      <span className="text-[10px] text-muted-foreground">–</span>
      <div className="relative">
        <Calendar className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={dateTo ?? ''}
          onChange={(e) => setFilter('dateTo', e.target.value || null)}
          className="h-8 w-32 pl-7 text-xs"
        />
      </div>
    </div>
  )
}
