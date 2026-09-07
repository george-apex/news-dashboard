'use client'

import { useState } from 'react'
import { useSweeps, useSweep, useArticles } from '@/lib/hooks/useApiHooks'
import { SweepTriggerCard } from '@/components/cards/SweepTriggerCard'
import { SweepHistoryTable } from '@/components/tables/SweepHistoryTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/common/Badge'
import { SweepRecord, Topic } from '@/types'
import { formatDateTime } from '@/lib/utils/format'
import { Clock, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { TOPIC_LABELS } from '@/lib/utils/constants'

export default function SweepsPage() {
  const [selectedSweepId, setSelectedSweepId] = useState<string | null>(null)
  const { data: sweepsData, isLoading } = useSweeps()
  const { data: sweepDetail } = useSweep(selectedSweepId)
  const { data: sweepArticles } = useArticles(
    selectedSweepId ? { sort: 'date', limit: 20 } : {},
    selectedSweepId ? 5000 : 0
  )

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Sweeps</h2>

      <SweepTriggerCard />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sweep History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : sweepsData && sweepsData.sweeps.length > 0 ? (
            <SweepHistoryTable
              sweeps={sweepsData.sweeps}
              onRowClick={(sweep) => setSelectedSweepId(sweep.id)}
            />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No sweeps recorded yet. Trigger your first sweep above.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSweepId} onOpenChange={(open) => !open && setSelectedSweepId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sweep Detail
              {sweepDetail && (() => {
                const statusConfig: Record<string, { icon: typeof Loader2; color: string; animate: boolean }> = {
                  running: { icon: Loader2, color: '#3b82f6', animate: true },
                  completed: { icon: CheckCircle, color: '#10b981', animate: false },
                  failed: { icon: XCircle, color: '#ef4444', animate: false },
                }
                const config = statusConfig[sweepDetail.status]
                const Icon = config?.icon || Clock
                return (
                  <Badge style={{ backgroundColor: `${config?.color}15`, color: config?.color }}>
                    <Icon className={`h-3 w-3 mr-1 ${config?.animate ? 'animate-spin' : ''}`} style={{ color: config?.color }} />
                    {sweepDetail.status}
                  </Badge>
                )
              })()}
            </DialogTitle>
          </DialogHeader>
          {sweepDetail && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <span className="ml-2">{formatDateTime(sweepDetail.started_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="ml-2">{sweepDetail.completed_at ? formatDateTime(sweepDetail.completed_at) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Triggered by:</span>
                  <span className="ml-2 capitalize">{sweepDetail.triggered_by}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Articles:</span>
                  <span className="ml-2 tabular-nums">{sweepDetail.article_count}</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground">Topics:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sweepDetail.topics.map((t) => (
                    <Badge key={t} className="text-[10px]">
                      {TOPIC_LABELS[t as Topic] || t}
                    </Badge>
                  ))}
                </div>
              </div>

              {sweepDetail.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-destructive">
                  Error: {sweepDetail.error}
                </div>
              )}

              <div className="flex items-center gap-3">
                {sweepDetail.pdf_report_url && (
                  <a href={sweepDetail.pdf_report_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" /> PDF Report
                  </a>
                )}
                {sweepDetail.linkedin_post && (
                  <a href={sweepDetail.linkedin_post} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[#0A66C2] hover:underline">
                    <LinkedInIcon className="h-3.5 w-3.5" /> LinkedIn Post
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
