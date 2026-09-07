'use client'

import { LinkedInPost } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { TopicBadge } from '@/components/common/TopicBadge'
import { formatTimeAgo } from '@/lib/utils/format'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { cn } from '@/lib/utils'

export function LinkedInPostCard({
  post,
  selected,
  onClick,
}: {
  post: LinkedInPost
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        selected ? 'border-primary/40 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.15)]' : 'hover:border-primary/20'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <LinkedInIcon className="h-3.5 w-3.5 text-[#0A66C2]" />
          <TopicBadge topic={post.topic} />
          <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(post.created_at)}</span>
        </div>
        <p className="text-xs text-foreground line-clamp-3 leading-relaxed">{post.content}</p>
        <div className="mt-2">
          <span className="text-[10px] text-muted-foreground capitalize">{post.status}</span>
        </div>
      </CardContent>
    </Card>
  )
}
