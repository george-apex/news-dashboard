'use client'

import { useState } from 'react'
import { useLinkedInPosts, useMarketData } from '@/lib/hooks/useApiHooks'
import { LinkedInPost, MarketDataStock } from '@/types'
import { LinkedInPostCard } from '@/components/cards/LinkedInPostCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, FileText, ThumbsUp, MessageCircle, Repeat2, Send, AlertTriangle } from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { TopicBadge } from '@/components/common/TopicBadge'
import { formatTimeAgo } from '@/lib/utils/format'
import { ErrorState } from '@/components/common/ErrorState'
import { apiClient } from '@/lib/api/client'

export default function PostsPage() {
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { data: postsData, isLoading, error: postsError, mutate } = useLinkedInPosts()
  const { data: marketData } = useMarketData()

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getMarketDataForPost = (post: LinkedInPost): MarketDataStock[] => {
    if (!marketData?.stocks || !post.content) return []
    const entityNames = marketData.stocks.map((s) => s.entity_name.toLowerCase())
    return marketData.stocks.filter((stock) => {
      const name = stock.entity_name.toLowerCase()
      const ticker = stock.ticker.toLowerCase()
      const content = post.content.toLowerCase()
      return content.includes(name) || content.includes(ticker) || content.includes(`$${stock.ticker}`)
    })
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

  const handleDeletePost = async (post: LinkedInPost) => {
    try {
      await apiClient(`/linkedin/${post.id}`, { method: 'DELETE' })
      mutate?.()
      if (selectedPost?.id === post.id) setSelectedPost(null)
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Failed to delete post:', err)
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
          ) : postsData?.posts?.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No LinkedIn posts yet. Trigger a sweep with LinkedIn generation enabled.
            </div>
          ) : (
            postsData?.posts?.map((post, i) => (
              <LinkedInPostCard
                key={post.id || `post-${i}`}
                post={post}
                selected={selectedPost?.id === post.id}
                onClick={() => setSelectedPost(post)}
                onDelete={deleteConfirmId === post.id ? undefined : (p) => setDeleteConfirmId(p.id)}
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
                      {copied ? 'Copied!' : 'Copy'}
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

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">Topic:</span>
                  <TopicBadge topic={selectedPost.topic} />
                  <span className="text-[10px] text-muted-foreground ml-4">Status:</span>
                  <span className="text-[10px] text-foreground capitalize">{selectedPost.status}</span>
                  {selectedPost.angle && (
                    <>
                      <span className="text-[10px] text-muted-foreground ml-4">Angle:</span>
                      <span className="text-[10px] text-foreground">{selectedPost.angle}</span>
                    </>
                  )}
                </div>

                {(() => {
                  const postMarketData = getMarketDataForPost(selectedPost)
                  return postMarketData.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-[10px] text-muted-foreground mb-1">Market Data Referenced</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {postMarketData.map((stock) => {
                          const change = parseFloat(stock.price_change_pct) || 0
                          const price = parseFloat(stock.latest_price) || 0
                          return (
                            <span key={stock.entity_name} className="text-[10px]">
                              <span className="font-medium">{stock.ticker || stock.entity_name}</span>{' '}
                              <span className="text-muted-foreground">${price.toFixed(2)}</span>{' '}
                              <span className={change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                ({change >= 0 ? '+' : ''}{change.toFixed(1)}%)
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {selectedPost.source_article_url && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-[10px] text-muted-foreground">Source: </span>
                    <a
                      href={selectedPost.source_article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      {selectedPost.source_article_title || selectedPost.source_article_url}
                    </a>
                  </div>
                )}
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

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-medium">Delete Post?</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">This cannot be undone. The post will be permanently removed.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const post = postsData?.posts?.find((p) => p.id === deleteConfirmId)
                  if (post) handleDeletePost(post)
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
