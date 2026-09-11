'use client'

import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts'

interface OHLCVChartProps {
  csvData: string
  headlines?: { title: string; url: string; relevance_score: number }[]
  height?: number
}

function parseOHLCV(csv: string): CandlestickData[] {
  const lines = csv.split(';').filter(l => l.trim())
  return lines.map(line => {
    const [date, open, high, low, close, volume] = line.split(',').map(s => s.trim())
    return {
      time: date as Time,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
    }
  }).filter(d => d.open > 0)
}

export function OHLCVChart({ csvData, headlines, height = 300 }: OHLCVChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const data = parseOHLCV(csvData)
    if (data.length < 2) return

    if (chartRef.current) {
      chartRef.current.remove()
    }

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.05)' },
        horzLines: { color: 'rgba(0,0,0,0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.1)',
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2 },
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    series.setData(data)
    chart.timeScale().fitContent()

    chartRef.current = chart

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [csvData, height])

  return <div ref={containerRef} />
}
