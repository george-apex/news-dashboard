import { cn } from '@/lib/utils'

export function RelevanceBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(pct)}</span>
    </div>
  )
}
