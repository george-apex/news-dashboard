import { format, formatDistanceToNow, parseISO } from 'date-fns'

function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  return parseISO(value)
}

export function formatDate(dateStr: string | number): string {
  return format(toDate(dateStr), 'MMM d, yyyy')
}

export function formatDateTime(dateStr: string | number): string {
  return format(toDate(dateStr), 'MMM d, yyyy HH:mm')
}

export function formatTimeAgo(dateStr: string | number): string {
  return formatDistanceToNow(toDate(dateStr), { addSuffix: true })
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function formatScore(score: number): string {
  return score.toFixed(1)
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}`
}
