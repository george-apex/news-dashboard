import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value && value !== 0) return null
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value === 'number') {
    const d = new Date(value)
    return isValid(d) ? d : null
  }
  if (typeof value === 'string' && value.trim() === '') return null
  try {
    const d = parseISO(value)
    return isValid(d) ? d : null
  } catch {
    return null
  }
}

export function formatDate(dateStr: string | number | null | undefined): string {
  const d = toDate(dateStr)
  return d ? format(d, 'MMM d, yyyy') : '—'
}

export function formatDateTime(dateStr: string | number | null | undefined): string {
  const d = toDate(dateStr)
  return d ? format(d, 'MMM d, yyyy HH:mm') : '—'
}

export function formatTimeAgo(dateStr: string | number | null | undefined): string {
  const d = toDate(dateStr)
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—'
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
