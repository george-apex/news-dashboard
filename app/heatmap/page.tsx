'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { RelevanceSlider } from '@/components/filters/RelevanceSlider'
import { TOPICS, TOPIC_LABELS } from '@/lib/utils/constants'
import { Grid3X3 } from 'lucide-react'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function HeatmapGrid({ cells, entities }: { cells: Record<string, Record<string, { count: number; avg_sentiment: number }>>; entities: string[] }) {
  const [selectedCell, setSelectedCell] = useState<{ topic: string; entity: string; data: { count: number; avg_sentiment: number } } | null>(null)

  const getCellColor = (val: { count: number; avg_sentiment: number } | undefined) => {
    if (!val || val.count === 0) return 'bg-muted/30'
    const s = val.avg_sentiment
    if (s > 0.3) return 'bg-emerald-200 hover:bg-emerald-300'
    if (s > 0.1) return 'bg-emerald-100 hover:bg-emerald-200'
    if (s < -0.3) return 'bg-red-200 hover:bg-red-300'
    if (s < -0.1) return 'bg-red-100 hover:bg-red-200'
    return 'bg-gray-100 hover:bg-gray-200'
  }

  if (entities.length === 0) return <EmptyState message="No heatmap data available." />

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `120px repeat(${entities.length}, 1fr)` }}>
          <div className="bg-background p-1.5 text-[9px] font-medium text-muted-foreground">Topic \ Entity</div>
          {entities.map(e => (
            <div key={e} className="bg-background p-1.5 text-[9px] font-medium text-muted-foreground truncate" title={e}>
              <Link href={`/entities/${encodeURIComponent(e)}`} className="hover:text-primary transition-colors">{e}</Link>
            </div>
          ))}

          {TOPICS.map(topic => (
            <>
              <div className="bg-background p-1.5 text-[10px] font-medium sticky left-0 z-10 bg-background" key={`label-${topic}`}>
                {TOPIC_LABELS[topic] || topic}
              </div>
              {entities.map(entity => {
                const val = cells[topic]?.[entity]
                return (
                  <Dialog key={`${topic}-${entity}`}>
                    <DialogTrigger asChild>
                      <button
                        className={`${getCellColor(val)} p-1.5 text-center text-[9px] transition-colors min-h-[32px]`}
                        onClick={() => val && setSelectedCell({ topic, entity, data: val })}
                      >
                        {val && val.count > 0 ? (
                          <span className="tabular-nums">{val.count} ({val.avg_sentiment >= 0 ? '+' : ''}{val.avg_sentiment.toFixed(1)})</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </button>
                    </DialogTrigger>
                    {selectedCell && selectedCell.topic === topic && selectedCell.entity === entity && (
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{TOPIC_LABELS[topic]} × {entity}</DialogTitle>
                        </DialogHeader>
                        <div className="text-sm space-y-2">
                          <p>Articles: {selectedCell.data.count}</p>
                          <p>Avg Sentiment: {selectedCell.data.avg_sentiment.toFixed(2)}</p>
                          <Link href={`/entities/${encodeURIComponent(entity)}`} className="text-primary hover:underline text-sm">
                            View entity page →
                          </Link>
                        </div>
                      </DialogContent>
                    )}
                  </Dialog>
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScatterWidget({ scatterData }: { scatterData: any[] }) {
  if (!scatterData || scatterData.length === 0) return <EmptyState message="No scatter data." />

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <XAxis type="number" dataKey="avg_sentiment" name="Sentiment" domain={[-1, 1]} tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="total_count" name="Articles" tick={{ fontSize: 10 }} />
          <ZAxis type="number" dataKey="total_count" range={[50, 500]} />
          <Tooltip formatter={(val: any, name: any) => [name === 'Sentiment' ? Number(val).toFixed(2) : val, String(name)]} />
          <Scatter data={scatterData} fill="#6366f1">
            {scatterData.map((_: any, i: number) => <Cell key={i} fill="#6366f1" />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeatmapContent() {
  const searchParams = useSearchParams()
  const { data, error, isLoading } = useSWR('/api/heatmap/topic-entity', fetcher, { refreshInterval: 120000 })

  if (error) return <div className="p-6"><ErrorState message="Failed to load heatmap." onRetry={() => window.location.reload()} /></div>
  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}</div>

  const heatmapData = data?.data
  const cells = heatmapData?.cells || {}
  const scatterData = heatmapData?.scatterData || []

  const entities = new Set<string>()
  for (const topic in cells) {
    for (const entity in cells[topic]) {
      entities.add(entity)
    }
  }
  const entityList = Array.from(entities)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Grid3X3 className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Topic × Entity Heatmap</h1>
        <div className="ml-auto">
          <RelevanceSlider />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Heatmap Grid</CardTitle></CardHeader>
        <CardContent>
          <HeatmapGrid cells={cells} entities={entityList} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entity Distribution</CardTitle></CardHeader>
        <CardContent>
          <ScatterWidget scatterData={scatterData} />
        </CardContent>
      </Card>
    </div>
  )
}

export default function HeatmapPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}</div></div>}>
      <HeatmapContent />
    </Suspense>
  )
}
