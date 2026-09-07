'use client'

import { SweepRecord } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/common/Badge'
import { formatDateTime, formatTimeAgo } from '@/lib/utils/format'
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export function SweepCard({ sweep, onClick }: { sweep: SweepRecord; onClick?: () => void }) {
  const statusConfig = {
    running: { icon: Loader2, color: '#3b82f6', label: 'Running', animate: true },
    completed: { icon: CheckCircle, color: '#10b981', label: 'Completed', animate: false },
    failed: { icon: XCircle, color: '#ef4444', label: 'Failed', animate: false },
  }

  const config = statusConfig[sweep.status]
  const Icon = config.icon

  return (
    <Card className="cursor-pointer transition-all hover:border-primary/20" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon
              className={`h-4 w-4 ${config.animate ? 'animate-spin' : ''}`}
              style={{ color: config.color }}
            />
            <Badge
              style={{ backgroundColor: `${config.color}15`, color: config.color, borderColor: `${config.color}30` }}
            >
              {config.label}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(sweep.started_at)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div>Started: {formatDateTime(sweep.started_at)}</div>
          <div>Articles: {sweep.article_count}</div>
          <div>Triggered by: {sweep.triggered_by}</div>
        </div>
      </CardContent>
    </Card>
  )
}
