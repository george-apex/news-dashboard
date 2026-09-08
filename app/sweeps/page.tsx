'use client'

import { useState, useCallback } from 'react'
import { useSweeps, useSweep, useArticles } from '@/lib/hooks/useApiHooks'
import { SweepTriggerCard } from '@/components/cards/SweepTriggerCard'
import { SweepHistoryTable } from '@/components/tables/SweepHistoryTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/common/Badge'
import { SweepRecord, Topic } from '@/types'
import { formatDateTime } from '@/lib/utils/format'
import { Clock, CheckCircle, XCircle, Loader2, FileText, Trash2, AlertTriangle } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { apiClient } from '@/lib/api/client'

export default function SweepsPage() {
  const [selectedSweepId, setSelectedSweepId] = useState<string | null>(null)
  const { data: sweepsData, isLoading, mutate } = useSweeps()
  const { data: sweepDetail } = useSweep(selectedSweepId)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteSweep = useCallback(async (sweep: SweepRecord) => {
    setDeleting(true)
    try {
      await apiClient(`/sweeps/${sweep.id}`, { method: 'DELETE' })
      mutate?.()
    } catch (err) {
      console.error('Failed to delete sweep:', err)
    } finally {
      setDeleting(false)
    }
  }, [mutate])

  const handleClearAll = useCallback(async () => {
    setDeleting(true)
    try {
      await apiClient('/sweeps', { method: 'DELETE' })
      mutate?.()
      setShowClearConfirm(false)
    } catch (err) {
      console.error('Failed to clear sweeps:', err)
    } finally {
      setDeleting(false)
    }
  }, [mutate])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sweeps</h2>
        {sweepsData && sweepsData.sweeps.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear History
          </button>
        )}
      </div>

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
              onDelete={handleDeleteSweep}
            />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No sweeps recorded yet. Trigger your first sweep above.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Clear All Sweep History?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all sweep records. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              disabled={deleting}
              className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSweepId} onOpenChange={(open) => !open && setSelectedSweepId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sweep Detail
              {sweepDetail && (() => {
                const isStale = sweepDetail.is_stale
                const displayStatus = isStale ? 'stale' : sweepDetail.status
                const statusConfig: Record<string, { icon: typeof Loader2; color: string; animate: boolean }> = {
                  running: { icon: Loader2, color: '#3b82f6', animate: true },
                  completed: { icon: CheckCircle, color: '#10b981', animate: false },
                  failed: { icon: XCircle, color: '#ef4444', animate: false },
                  stale: { icon: AlertTriangle, color: '#f59e0b', animate: false },
                }
                const config = statusConfig[displayStatus] ?? statusConfig.running
                const Icon = config?.icon || Clock
                return (
                  <Badge style={{ backgroundColor: `${config?.color}15`, color: config?.color }}>
                    <Icon className={`h-3 w-3 mr-1 ${config?.animate ? 'animate-spin' : ''}`} style={{ color: config?.color }} />
                    {displayStatus}
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
                  <span className="ml-2">{sweepDetail.started_at ? formatDateTime(sweepDetail.started_at) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="ml-2">{sweepDetail.completed_at ? formatDateTime(sweepDetail.completed_at) : (sweepDetail.status === 'completed' ? 'N/A' : '—')}</span>
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
