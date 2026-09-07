'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface KPICardProps {
  title: string
  value: string | number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  onClick?: () => void
}

export function KPICard({ title, value, trend, trendValue, onClick }: KPICardProps) {
  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.15)]', onClick && 'hover:border-primary/30')}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs',
              trend === 'up' && 'text-emerald-500',
              trend === 'down' && 'text-red-500',
              trend === 'stable' && 'text-muted-foreground'
            )}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {trend === 'stable' && <Minus className="h-3 w-3" />}
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
