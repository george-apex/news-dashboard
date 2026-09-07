'use client'

import { Suspense } from 'react'
import { FeedContent } from './FeedContent'

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />))}</div></div>}>
      <FeedContent />
    </Suspense>
  )
}
