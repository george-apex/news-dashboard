'use client'

import { useState } from 'react'
import { useLinkedInPosts, useLinkedInPost } from '@/lib/hooks/useApiHooks'
import { LinkedInPostCard } from '@/components/cards/LinkedInPostCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, FileText, ThumbsUp, MessageCircle, Repeat2, Send } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { TopicBadge } from '@/components/common/TopicBadge'
import { formatTimeAgo } from '@/lib/utils/format'
import { ErrorState } from '@/components/common/ErrorState'

export default function PostsPage() {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const { data: postsData, isLoading, error: postsError } = useLinkedInPosts()
  const { data: selectedPost } = useLinkedInPost(selectedPostId)

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
  }

  const handleExportPdf = async () => {
    if (!selectedPost) return
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'sweep', sweep_id: selectedPost.sweep_id, topic: selectedPost.topic, date_from: selectedPost.created_at, date_to: new Date().toISOString() }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `news-intelligence-post-${selectedPost.id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('PDF export failed:', e)
    }
  }

  return (
    <div className="p-6">
      {postsError && (
        <ErrorState message="Failed to load LinkedIn posts. Please check your connection." onRetry={() => window.location.reload()} />
      )}
      <h2 className="text-lg font-semibold mb-4">LinkedIn Posts</h2>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))
          ) : postsData?.posts.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No LinkedIn posts yet. Trigger a sweep with LinkedIn generation enabled.
            </div>
          ) : (
            postsData?.posts.map((post, i) => (
              <LinkedInPostCard
                key={post.id || `post-${i}`}
                post={post}
                selected={selectedPostId === post.id}
                onClick={() => setSelectedPostId(post.id)}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {selectedPost ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Post Preview</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleCopy(selectedPost.content)}>
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportPdf}>
                      <FileText className="h-3 w-3" />
                      Export PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-muted/30 p-4 max-w-lg mx-auto">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">N</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">News Intelligence</div>
                      <div className="text-[10px] text-muted-foreground">{formatTimeAgo(selectedPost.created_at ?? '')}</div>
                    </div>
                  </div>
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                    {(selectedPost.content ?? '').split(/(#[\w]+)/g).map((part, i) =>
                      part.startsWith('#') ? (
                        <span key={i} className="text-primary font-medium">{part}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-6 pt-3 border-t border-border text-muted-foreground">
                    <button className="flex items-center gap-1.5 text-[10px] hover:text-foreground transition-colors">
                      <ThumbsUp className="h-3.5 w-3.5" /> Like
                    </button>
                    <button className="flex items-center gap-1.5 text-[10px] hover:text-foreground transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" /> Comment
                    </button>
                    <button className="flex items-center gap-1.5 text-[10px] hover:text-foreground transition-colors">
                      <Repeat2 className="h-3.5 w-3.5" /> Repost
                    </button>
                    <button className="flex items-center gap-1.5 text-[10px] hover:text-foreground transition-colors">
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Topic:</span>
                  <TopicBadge topic={selectedPost.topic} />
                  <span className="text-[10px] text-muted-foreground ml-4">Status:</span>
                  <span className="text-[10px] text-foreground capitalize">{selectedPost.status}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                <LinkedInIcon className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Select a post to preview</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
