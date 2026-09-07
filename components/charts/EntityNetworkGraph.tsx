'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { CoOccurrenceResponse, EntityStat } from '@/types'
import { Skeleton } from '@/components/common/Skeleton'

const TYPE_COLORS: Record<string, string> = {
  company: '#3b82f6',
  person: '#10b981',
  technology: '#8b5cf6',
}

interface EntityNetworkGraphProps {
  data?: CoOccurrenceResponse
  entities?: EntityStat[]
  loading?: boolean
  onEntityClick?: (name: string) => void
}

interface SimNode {
  id: string
  type: string
  mention_count: number
  x: number
  y: number
  vx: number
  vy: number
  _dragging?: boolean
}

interface SimLink {
  source: string
  target: string
  weight: number
}

function runForceLayout(nodes: SimNode[], links: SimLink[], width: number, height: number, iterations = 120) {
  const cx = width / 2
  const cy = height / 2

  for (const n of nodes) {
    n.x = cx + (Math.random() - 0.5) * 100
    n.y = cy + (Math.random() - 0.5) * 100
    n.vx = 0
    n.vy = 0
  }

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations

    for (const link of links) {
      const s = nodes.find((n) => n.id === link.source)
      const t = nodes.find((n) => n.id === link.target)
      if (!s || !t) continue
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 80) * 0.005 * alpha
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      s.vx += fx
      s.vy += fy
      t.vx -= fx
      t.vy -= fy
    }

    for (const n of nodes) {
      const dx = cx - n.x
      const dy = cy - n.y
      n.vx += dx * 0.01 * alpha
      n.vy += dy * 0.01 * alpha
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const repulse = (300 * alpha) / (dist * dist)
        const fx = (dx / dist) * repulse
        const fy = (dy / dist) * repulse
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    for (const n of nodes) {
      if (!n._dragging) {
        n.vx *= 0.6
        n.vy *= 0.6
        n.x += n.vx
        n.y += n.vy
      }
      n.x = Math.max(30, Math.min(width - 30, n.x))
      n.y = Math.max(30, Math.min(height - 30, n.y))
    }
  }
}

export function EntityNetworkGraph({ data, entities, loading, onEntityClick }: EntityNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)

  const width = 500
  const height = 320

  const nodePositions = useMemo(() => {
    if (!data?.nodes) return []
    const capped = data.nodes.slice(0, 30)
    const cappedIds = new Set(capped.map((n) => n.id))
    const cappedLinks = data.links
      .filter((l) => cappedIds.has(l.source) && cappedIds.has(l.target))
      .slice(0, 100)
    const simNodes: SimNode[] = capped.map((n) => ({
      id: n.id,
      type: n.type,
      mention_count: n.mention_count,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }))
    const simLinks: SimLink[] = cappedLinks
    runForceLayout(simNodes, simLinks, width, height)
    return simNodes
  }, [data])

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * width
    const svgY = ((e.clientY - rect.top) / rect.height) * height
    const node = nodePositions.find((n) => n.id === nodeId)
    if (!node) return
    dragRef.current = { nodeId, offsetX: svgX - node.x, offsetY: svgY - node.y }
    setDragOffset({ nodeId, x: node.x, y: node.y })
  }, [nodePositions])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * width
      const svgY = ((e.clientY - rect.top) / rect.height) * height
      const newX = Math.max(30, Math.min(width - 30, svgX - dragRef.current.offsetX))
      const newY = Math.max(30, Math.min(height - 30, svgY - dragRef.current.offsetY))
      setDragOffset({ nodeId: dragRef.current.nodeId, x: newX, y: newY })
    }

    const handleMouseUp = () => {
      dragRef.current = null
      setDragOffset(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  if (loading) return <Skeleton className="h-80 w-full rounded-lg" />
  if (!data || !data.nodes || data.nodes.length === 0) return <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">No entity data</div>

  const maxMentions = Math.max(...nodePositions.map((n) => n.mention_count), 1)
  const posMap = new Map(nodePositions.map((p) => [
    p.id,
    dragOffset && dragOffset.nodeId === p.id ? { ...p, x: dragOffset.x, y: dragOffset.y } : p
  ]))
  const entityMap = new Map((entities || []).map((e) => [e.name, e]))
  const validLinks = (data.links || []).filter((l) => posMap.has(l.source) && posMap.has(l.target)).slice(0, 100)
  const hoveredEntity = hoveredNode ? entityMap.get(hoveredNode) : null

  return (
    <div className="h-80" role="img" aria-label="Entity network graph showing relationships between top entities">
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {validLinks.map((link, i) => {
          const source = posMap.get(link.source)
          const target = posMap.get(link.target)
          if (!source || !target) return null
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="hsl(var(--border))"
              strokeWidth={Math.min(link.weight * 0.5, 3)}
              opacity={0.35}
            />
          )
        })}
        {nodePositions.map((node) => {
          const pos = posMap.get(node.id) || node
          const r = 5 + (node.mention_count / maxMentions) * 15
          const isHovered = hoveredNode === node.id
          return (
            <g
              key={node.id}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onEntityClick?.(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r + (isHovered ? 3 : 0)}
                fill={TYPE_COLORS[node.type] || '#64748b'}
                opacity={isHovered ? 1 : 0.7}
                stroke={isHovered ? 'hsl(var(--foreground))' : 'none'}
                strokeWidth={isHovered ? 1.5 : 0}
                style={{ transition: 'r 0.15s, opacity 0.15s' }}
              />
              {r > 10 && (
                <text
                  x={pos.x}
                  y={pos.y + r + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="hsl(var(--foreground))"
                  opacity={0.8}
                >
                  {node.id.length > 12 ? node.id.slice(0, 10) + '…' : node.id}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hoveredEntity && (
        <div className="absolute bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none z-20" style={{ marginTop: -320 }}>
          <div className="font-medium">{hoveredEntity.name}</div>
          <div className="text-muted-foreground capitalize">{hoveredEntity.type} · {hoveredEntity.mention_count} mentions</div>
          <div className="text-muted-foreground">Sentiment: {(hoveredEntity.avg_sentiment ?? 0).toFixed(2)} · {hoveredEntity.trend_direction ?? '—'}</div>
        </div>
      )}
      <div className="flex items-center gap-4 mt-2 px-2">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
