'use client'

import { useState } from 'react'
import { SweepRecord } from '@/types'
import { formatDateTime } from '@/lib/utils/format'
import { Badge } from '@/components/common/Badge'
import { Clock, CheckCircle, XCircle, Loader2, FileText, Trash2, AlertTriangle } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'

export function SweepHistoryTable({
  sweeps,
  onRowClick,
  onDelete,
}: {
  sweeps: (SweepRecord & { is_stale?: boolean })[]
  onRowClick?: (sweep: SweepRecord) => void
  onDelete?: (sweep: SweepRecord) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground font-medium">Started</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Completed</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Topics</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Articles</th>
            <th className="text-left p-2 text-muted-foreground font-medium">PDF</th>
            <th className="text-left p-2 text-muted-foreground font-medium">LinkedIn</th>
            <th className="text-left p-2 text-muted-foreground font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {sweeps.map((sweep) => {
            const isStale = sweep.is_stale || (sweep.status === 'running' && sweep.started_at && (Date.now() - new Date(sweep.started_at).getTime() > 10 * 60 * 1000))
            const displayStatus = isStale ? 'stale' : sweep.status
            const statusConfig: Record<string, { icon: typeof Loader2; color: string; animate: boolean }> = {
              running: { icon: Loader2, color: '#3b82f6', animate: true },
              completed: { icon: CheckCircle, color: '#10b981', animate: false },
              failed: { icon: XCircle, color: '#ef4444', animate: false },
              stale: { icon: AlertTriangle, color: '#f59e0b', animate: false },
            }
            const config = statusConfig[displayStatus] ?? statusConfig.running
            const Icon = config.icon

            return (
              <tr
                key={sweep.id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick?.(sweep)}
              >
                <td className="p-2 text-foreground">{sweep.started_at ? formatDateTime(sweep.started_at) : '—'}</td>
                <td className="p-2 text-muted-foreground">{sweep.completed_at ? formatDateTime(sweep.completed_at) : (sweep.status === 'completed' ? 'N/A' : '—')}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} style={{ color: config.color }} />
                    <Badge
                      style={{ backgroundColor: `${config.color}15`, color: config.color, borderColor: `${config.color}30` }}
                    >
                      {displayStatus}
                    </Badge>
                  </div>
                </td>
                <td className="p-2 text-muted-foreground">{sweep.topics?.length ?? 0} topics</td>
                <td className="p-2 text-foreground tabular-nums">{sweep.article_count}</td>
                <td className="p-2">{sweep.pdf_report_url ? <FileText className="h-3.5 w-3.5 text-primary" /> : '—'}</td>
                <td className="p-2">{sweep.linkedin_post ? <LinkedInIcon className="h-3.5 w-3.5 text-[#0A66C2]" /> : '—'}</td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  {confirmId === sweep.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          onDelete?.(sweep)
                          setConfirmId(null)
                        }}
                        className="text-destructive hover:text-destructive/80 font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(sweep.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete sweep"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
