'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Zap, Loader2 } from 'lucide-react'
import { Topic } from '@/types'
import { TOPIC_LABELS } from '@/lib/utils/constants'
import { useApi, mutate } from '@/lib/api/client'

export function SweepTriggerCard() {
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([])
  const [generatePdf, setGeneratePdf] = useState(false)
  const [generateLinkedin, setGenerateLinkedin] = useState(false)
  const [triggering, setTriggering] = useState(false)

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
          generate_pdf: generatePdf,
          generate_linkedin: generateLinkedin,
        }),
      })
      if (res.ok) {
        mutate('/api/sweeps')

      }
    } finally {
      setTriggering(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Trigger Sweep
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(TOPIC_LABELS) as [Topic, string][]).map(([topic, label]) => (
            <label key={topic} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selectedTopics.includes(topic)}
                onCheckedChange={() => toggleTopic(topic)}
              />
              <span className="text-xs text-foreground">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={generatePdf} onCheckedChange={(v) => setGeneratePdf(!!v)} />
            <span className="text-xs text-foreground">PDF Report</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={generateLinkedin} onCheckedChange={(v) => setGenerateLinkedin(!!v)} />
            <span className="text-xs text-foreground">LinkedIn Post</span>
          </label>
        </div>
        <Button
          onClick={handleTrigger}
          disabled={triggering}
          className="w-full gap-2"
          size="sm"
        >
          {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {triggering ? 'Triggering...' : 'Trigger Sweep'}
        </Button>
      </CardContent>
    </Card>
  )
}
