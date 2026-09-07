import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({ message = 'Something went wrong', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
      <p className="text-sm text-destructive mb-3">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
