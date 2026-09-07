'use client'

import { useUIStore } from '@/stores/ui'
import { useApi } from '@/lib/api/client'
import { Clock, FileText, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Footer() {
  const { sidebarOpen } = useUIStore()
  const { data: sweepData } = useApi<{ sweeps: { started_at: string; status: string }[] }>('/api/sweeps?limit=1')
  const { data: articleData } = useApi<{ total: number }>('/api/articles?limit=1')

  const lastSweep = sweepData?.sweeps?.[0]
  const lastSweepTime = lastSweep?.started_at
    ? new Date(lastSweep.started_at).toLocaleString()
    : 'Never'

  const runningSweep = sweepData?.sweeps?.find((s) => s.status === 'running')

  return (
    <footer
      className={cn(
        'fixed bottom-0 right-0 z-30 flex h-8 items-center gap-6 border-t border-border bg-background/95 backdrop-blur-sm px-4 text-xs text-muted-foreground transition-all duration-300',
        sidebarOpen ? 'lg:ml-56' : 'lg:ml-16'
      )}
    >
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        <span>Last sweep: {lastSweepTime}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <FileText className="h-3 w-3" />
        <span>Articles: {articleData?.total?.toLocaleString() ?? '—'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3" />
        <span>Agent: {runningSweep ? 'Running' : 'Idle'}</span>
      </div>
    </footer>
  )
}
