import { Newspaper, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground text-sm mb-4">{message}</p>
      <Button variant="outline" size="sm" className="gap-2">
        <Zap className="h-3.5 w-3.5" />
        Trigger a Sweep
      </Button>
    </div>
  )
}
