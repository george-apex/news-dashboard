'use client'

import { useFilterStore } from '@/stores/filters'
import { useState } from 'react'

export function SentimentSlider() {
  const { sentimentMin, sentimentMax, setFilter } = useFilterStore()
  const [localMin, setLocalMin] = useState(sentimentMin)
  const [localMax, setLocalMax] = useState(sentimentMax)

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-red-500">-1</span>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.1}
        value={localMin}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          setLocalMin(v)
          setFilter('sentimentMin', v)
        }}
        className="h-1.5 w-20 accent-primary cursor-pointer"
      />
      <span className="text-muted-foreground text-[10px]">to</span>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.1}
        value={localMax}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          setLocalMax(v)
          setFilter('sentimentMax', v)
        }}
        className="h-1.5 w-20 accent-primary cursor-pointer"
      />
      <span className="text-green-500">+1</span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-16">
        [{localMin.toFixed(1)}, {localMax.toFixed(1)}]
      </span>
    </div>
  )
}
