'use client'

import { HeatmapResponse, Topic } from '@/types'
import { Skeleton } from '@/components/common/Skeleton'
import { useState } from 'react'

interface CorroborationHeatmapProps {
  data?: HeatmapResponse
  loading?: boolean
  onCellClick?: (topic: Topic, date: string) => void
}

export function CorroborationHeatmap({ data, loading, onCellClick }: CorroborationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ topic: string; date: string } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  if (loading) return <Skeleton className="h-48 w-full rounded-lg" />
  if (!data || !data.rows || data.rows.length === 0) return <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data</div>

  const maxCount = Math.max(
    ...data.rows.flatMap((topic) =>
      data.cols.map((date) => data.cells[topic]?.[date]?.high_corr_count || 0)
    ),
    1
  )

  const hoveredData = hoveredCell ? data.cells[hoveredCell.topic]?.[hoveredCell.date] : null

  return (
    <div className="overflow-x-auto relative" role="img" aria-label="Corroboration heatmap showing article counts by topic and date">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[10px] text-muted-foreground text-left p-1.5 w-24">Topic</th>
            {data.cols.map((col) => (
              <th key={col} className="text-[10px] text-muted-foreground p-1.5 text-center min-w-[40px]">
                {new Date(col).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((topic) => (
            <tr key={topic}>
              <td className="text-[10px] text-foreground p-1.5 font-medium capitalize">
                {topic ? topic.replace(/_/g, ' ') : '—'}
              </td>
              {data.cols.map((date) => {
                const cell = data.cells[topic]?.[date]
                const count = cell?.high_corr_count || 0
                const intensity = count / maxCount
                const isHovered = hoveredCell?.topic === topic && hoveredCell?.date === date

                return (
                  <td
                    key={date}
                    className="p-1 text-center cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredCell({ topic, date })
                      const rect = e.currentTarget.getBoundingClientRect()
                      const parent = e.currentTarget.closest('.overflow-x-auto')?.getBoundingClientRect()
                      setTooltipPos({ x: rect.right - (parent?.left || 0) + 8, y: rect.top - (parent?.top || 0) - 10 })
                    }}
                    onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null) }}
                    onClick={() => onCellClick?.(topic as Topic, date)}
                  >
                    <div
                      className="rounded-sm h-8 flex items-center justify-center text-[9px] font-medium transition-all"
                      style={{
                        backgroundColor: count > 0 ? `rgba(59, 130, 246, ${0.1 + intensity * 0.7})` : 'hsl(var(--muted) / 0.2)',
                        color: count > 0 ? (intensity > 0.5 ? 'white' : 'hsl(var(--foreground))') : 'transparent',
                        outline: isHovered ? '2px solid hsl(var(--primary))' : 'none',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hoveredCell && hoveredData && tooltipPos && (
        <div
          className="absolute bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none z-20"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-medium capitalize">{hoveredCell.topic ? hoveredCell.topic.replace(/_/g, ' ') : '—'}</div>
          <div className="text-muted-foreground">{new Date(hoveredCell.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div>Total: {hoveredData.count} articles</div>
          <div>High Corroboration: {hoveredData.high_corr_count}</div>
          <div>Avg Relevance: {hoveredData.avg_relevance?.toFixed(1) ?? '—'}</div>
        </div>
      )}
    </div>
  )
}
