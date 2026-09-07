import { Topic } from '@/types'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { Badge } from './Badge'

export function TopicBadge({ topic }: { topic: Topic }) {
  const color = TOPIC_COLORS[topic]
  return (
    <Badge
      className="text-[10px]"
      style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}
    >
      {TOPIC_LABELS[topic]}
    </Badge>
  )
}
