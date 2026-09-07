'use client'

import { SweepRecord } from '@/types'
import { formatDateTime } from '@/lib/utils/format'
import { Badge } from '@/components/common/Badge'
import { Clock, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'

export function SweepHistoryTable({ sweeps, onRowClick }: { sweeps: SweepRecord[]; onRowClick?: (sweep: SweepRecord) => void }) {
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
          </tr>
        </thead>
        <tbody>
          {sweeps.map((sweep) => {
            const statusConfig = {
              running: { icon: Loader2, color: '#3b82f6', animate: true },
              completed: { icon: CheckCircle, color: '#10b981', animate: false },
              failed: { icon: XCircle, color: '#ef4444', animate: false },
            }
            const config = statusConfig[sweep.status]
            const Icon = config.icon

            return (
              <tr
                key={sweep.id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick?.(sweep)}
              >
                <td className="p-2 text-foreground">{formatDateTime(sweep.started_at)}</td>
                <td className="p-2 text-muted-foreground">{sweep.completed_at ? formatDateTime(sweep.completed_at) : '—'}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} style={{ color: config.color }} />
                    <Badge
                      style={{ backgroundColor: `${config.color}15`, color: config.color, borderColor: `${config.color}30` }}
                    >
                      {sweep.status}
                    </Badge>
                  </div>
                </td>
                <td className="p-2 text-muted-foreground">{sweep.topics.length} topics</td>
                <td className="p-2 text-foreground tabular-nums">{sweep.article_count}</td>
                <td className="p-2">{sweep.pdf_report_url ? <FileText className="h-3.5 w-3.5 text-primary" /> : '—'}</td>
                <td className="p-2">{sweep.linkedin_post ? <LinkedInIcon className="h-3.5 w-3.5 text-[#0A66C2]" /> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
