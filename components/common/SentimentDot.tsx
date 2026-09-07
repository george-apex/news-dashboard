import { getSentimentColor } from '@/lib/utils/colors'

export function SentimentDot({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = getSentimentColor(score)
  const sizeClass = size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <span
      className={`inline-block rounded-full ${sizeClass} shrink-0`}
      style={{ backgroundColor: color }}
      title={`Sentiment: ${score.toFixed(2)}`}
    />
  )
}
