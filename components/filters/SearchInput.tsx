'use client'

import { useFilterStore } from '@/stores/filters'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function SearchInput() {
  const { search, setFilter } = useFilterStore()

  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search articles..."
        value={search}
        onChange={(e) => setFilter('search', e.target.value)}
        className="h-8 pl-8 text-xs"
      />
    </div>
  )
}
