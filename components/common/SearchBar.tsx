'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useArticleSearch } from '@/lib/hooks/useApiHooks'
import { TopicBadge } from '@/components/common/TopicBadge'
import { Search, X, Loader2 } from 'lucide-react'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data, isLoading } = useArticleSearch(debouncedQuery.length >= 2 ? debouncedQuery : null)

  const handleSelect = useCallback((articleId: string) => {
    setOpen(false)
    setQuery('')
    setDebouncedQuery('')
    router.push(`/feed?search=${encodeURIComponent(debouncedQuery)}`)
  }, [router, debouncedQuery])

  const showDropdown = open && debouncedQuery.length >= 2

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (debouncedQuery.length >= 2) setOpen(true) }}
          placeholder="Search articles..."
          className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-8 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setDebouncedQuery(''); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Searching...
            </div>
          ) : data?.articles?.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No articles found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            <div className="py-1">
              {data?.articles?.map((article) => (
                <button
                  key={article.id}
                  onClick={() => handleSelect(article.id)}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{article.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{article.source}</span>
                        {article.topic && <TopicBadge topic={article.topic as any} />}
                      </div>
                      {article.summary && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{article.summary}</p>
                      )}
                    </div>
                    {article.relevance_score > 0 && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                        {Math.round(article.relevance_score)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
