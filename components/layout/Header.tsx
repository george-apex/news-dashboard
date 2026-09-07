'use client'

import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { Download, Zap } from 'lucide-react'
import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { TOPIC_COLORS } from '@/lib/utils/colors'
import { Topic } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { useSweeps } from '@/lib/hooks/useApiHooks'

function TriggerSweepDialog() {
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([])
  const [triggering, setTriggering] = useState(false)
  const [result, setResult] = useState<{ sweep_id: string; status: string } | null>(null)

  const toggleTopic = (topic: Topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/sweeps/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: selectedTopics.length > 0 ? selectedTopics : undefined,
          generate_pdf: true,
          generate_linkedin: true,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ sweep_id: '', status: 'error' })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Zap className="h-3.5 w-3.5" />
          Trigger Sweep
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger New Sweep</DialogTitle>
          <DialogDescription>
            Select topics to sweep, or leave empty to sweep all.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(TOPIC_LABELS) as [Topic, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedTopics.includes(key)}
                  onCheckedChange={() => toggleTopic(key)}
                />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TOPIC_COLORS[key] }} />
                {label}
              </label>
            ))}
          </div>
          {result ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              {result.status === 'accepted' ? (
                <p>Sweep started. ID: <code className="text-xs">{result.sweep_id}</code></p>
              ) : (
                <p className="text-destructive">Failed to trigger sweep.</p>
              )}
            </div>
          ) : null}
          <Button onClick={handleTrigger} disabled={triggering} className="w-full gap-2">
            <Zap className="h-3.5 w-3.5" />
            {triggering ? 'Triggering...' : 'Start Sweep'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Header() {
  const { sidebarOpen } = useUIStore()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 transition-all duration-300',
        sidebarOpen ? 'lg:ml-56' : 'lg:ml-16'
      )}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">News Intelligence</h1>
      </div>
      <div className="flex items-center gap-2">
        <TriggerSweepDialog />
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
