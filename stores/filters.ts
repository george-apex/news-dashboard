import { create } from 'zustand'
import { Topic, CorroborationLevel } from '@/types'

interface FilterState {
  topics: Topic[]
  sourceType: string | null
  source: string | null
  sentimentMin: number
  sentimentMax: number
  corroboration: CorroborationLevel | null
  dateFrom: string | null
  dateTo: string | null
  minRelevance: number
  entity: string | null
  search: string
  sort: 'date' | 'relevance' | 'sentiment'
  order: 'asc' | 'desc'
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  clearAll: () => void
  toQueryParams: () => string
}

const defaults = {
  topics: [] as Topic[],
  sourceType: null as string | null,
  source: null as string | null,
  sentimentMin: -1,
  sentimentMax: 1,
  corroboration: null as CorroborationLevel | null,
  dateFrom: null as string | null,
  dateTo: null as string | null,
  minRelevance: 0,
  entity: null as string | null,
  search: '',
  sort: 'date' as const,
  order: 'desc' as const,
}

export const useFilterStore = create<FilterState>((set, get) => ({
  ...defaults,
  setFilter: (key, value) => set({ [key]: value }),
  clearAll: () => set(defaults),
  toQueryParams: () => {
    const s = get()
    const params = new URLSearchParams()
    if (s.topics.length > 0) params.set('topic', s.topics.join(','))
    if (s.source) params.set('source', s.source)
    if (s.sourceType) params.set('source_type', s.sourceType)
    if (s.sentimentMin > -1) params.set('sentiment_min', String(s.sentimentMin))
    if (s.sentimentMax < 1) params.set('sentiment_max', String(s.sentimentMax))
    if (s.corroboration) params.set('corroboration', s.corroboration)
    if (s.dateFrom) params.set('date_from', s.dateFrom)
    if (s.dateTo) params.set('date_to', s.dateTo)
    if (s.minRelevance > 0) params.set('min_relevance', String(s.minRelevance))
    if (s.entity) params.set('entity', s.entity)
    if (s.search) params.set('search', s.search)
    params.set('sort', s.sort)
    params.set('order', s.order)
    return params.toString()
  },
}))
