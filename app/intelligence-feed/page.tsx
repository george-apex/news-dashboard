'use client'

import { Suspense } from 'react'
import { IntelligenceFeedContent } from './FeedContent'

export default function IntelligenceFeedPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />))}</div></div>}>
      <IntelligenceFeedContent />
    </Suspense>
  )
}
