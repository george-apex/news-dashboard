'use client'

import { useRouter } from 'next/navigation'
import { useSources, useSourceQuality } from '@/lib/hooks/useApiHooks'
import { SourceBreakdownChart } from '@/components/charts/SourceBreakdownChart'
import { SourceQualityTable } from '@/components/tables/SourceQualityTable'
import { SourceScatterPlot } from '@/components/charts/SourceScatterPlot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'

export default function SourcesPage() {
  const router = useRouter()
  const { data: sourceData, isLoading: sourceLoading, error: sourceError } = useSources()
  const { data: qualityData, isLoading: qualityLoading, error: qualityError } = useSourceQuality()

  const hasError = sourceError || qualityError

  return (
    <div className="p-6 space-y-6">
      {hasError && (
        <ErrorState message="Failed to load source data. Please check your connection." onRetry={() => window.location.reload()} />
      )}
      <h2 className="text-lg font-semibold">Sources</h2>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Source Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceBreakdownChart data={sourceData} loading={sourceLoading} onSourceClick={(source) => router.push(`/feed?source=${encodeURIComponent(source)}`)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Source Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceQualityTable data={qualityData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Source Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceScatterPlot data={qualityData} loading={qualityLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
