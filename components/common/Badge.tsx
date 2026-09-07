import { cn } from '@/lib/utils'

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' | 'outline' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        variant === 'default' && 'bg-primary/10 text-primary border border-primary/20',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        variant === 'outline' && 'border border-border text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
