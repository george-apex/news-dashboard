'use client'

import { useState, useMemo } from 'react'
import { SourceQualityResponse } from '@/types'

type SortField = 'source' | 'total_articles' | 'avg_relevance' | 'avg_sentiment'
type SortDir = 'asc' | 'desc'

export function SourceQualityTable({ data }: { data?: SourceQualityResponse }) {
  const [sortField, setSortField] = useState<SortField>('total_articles')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'source' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    if (!data?.sources) return []
    const arr = [...data.sources]
    arr.sort((a, b) => {
      let cmp: number
      if (sortField === 'source') {
        cmp = (a.source || '').localeCompare(b.source || '')
      } else {
        cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sortField, sortDir])

  if (!data || !data.sources || data.sources.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No source quality data</div>

  const arrow = (field: SortField) => {
    if (sortField !== field) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const th = (field: SortField, label: string) => (
    <th
      className="text-left p-2 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {label}{arrow(field)}
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {th('source', 'Source')}
            <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
            {th('total_articles', 'Articles')}
            {th('avg_relevance', 'Avg Relevance')}
            {th('avg_sentiment', 'Avg Sentiment')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((source) => (
            <tr key={source.source} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="p-2 text-foreground font-medium">{source.source}</td>
              <td className="p-2 text-muted-foreground">{source.source_type}</td>
              <td className="p-2 text-foreground tabular-nums">{source.total_articles}</td>
              <td className="p-2 tabular-nums">{(source.avg_relevance ?? 0).toFixed(1)}</td>
              <td className="p-2 tabular-nums">{(source.avg_sentiment ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
