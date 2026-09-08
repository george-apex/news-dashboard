'use client'

import { useState } from 'react'
import { LinkedInPost } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { TopicBadge } from '@/components/common/TopicBadge'
import { formatTimeAgo } from '@/lib/utils/format'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { cn } from '@/lib/utils'
import { Copy, FileText, Check } from 'lucide-react'
import { apiClient } from '@/lib/api/client'

export function LinkedInPostCard({
  post,
  selected,
  onClick,
}: {
  post: LinkedInPost
  selected?: boolean
  onClick?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(post.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleExportPdf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await apiClient('/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'sweep', sweep_id: post.sweep_id, date_from: post.created_at, date_to: post.created_at }),
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch {}
  }

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
          {post.angle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {post.angle}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(post.created_at)}</span>
        </div>
        <p className="text-xs text-foreground line-clamp-3 leading-relaxed whitespace-pre-line">{post.content}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground capitalize">{post.status}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <button
              onClick={handleExportPdf}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Export PDF"
            >
              <FileText className="h-3 w-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
