'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export function RelevanceSlider() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [local, setLocal] = useState(Number(searchParams.get('relevance') || 75))
  let timer: ReturnType<typeof setTimeout>

  useEffect(() => {
    setLocal(Number(searchParams.get('relevance') || 75))
  }, [searchParams])

  const commit = useCallback((val: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('relevance', String(val))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setLocal(val)
    clearTimeout(timer)
    timer = setTimeout(() => commit(val), 300)
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground whitespace-nowrap">Relevance</span>
      <input
        type="range"
        min={50}
        max={100}
        step={1}
        value={local}
        onChange={onChange}
        className="h-1.5 w-24 accent-primary cursor-pointer touch-none"
      />
      <span className="text-muted-foreground tabular-nums w-6 text-right">{local}</span>
    </div>
  )
}
