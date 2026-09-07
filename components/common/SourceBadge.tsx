import { SOURCE_TYPE_COLORS } from '@/lib/utils/colors'
import { SOURCE_TYPE_LABELS } from '@/lib/utils/constants'
import { Badge } from './Badge'
import { SourceType } from '@/types'

export function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  const color = SOURCE_TYPE_COLORS[sourceType]
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
    >
      {SOURCE_TYPE_LABELS[sourceType]}
    </Badge>
  )
}
