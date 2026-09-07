'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEntities, useTrendingEntities, useCoOccurrence } from '@/lib/hooks/useApiHooks'
import { EntityNetworkGraph } from '@/components/charts/EntityNetworkGraph'
import { EntityCloud } from '@/components/charts/EntityCloud'
import { TrendingEntitiesChart } from '@/components/charts/TrendingEntitiesChart'
import { EntityTable } from '@/components/tables/EntityTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/common/ErrorState'

export default function EntitiesPage() {
  const router = useRouter()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState('mentions')

  const { data: entityData, isLoading: entityLoading, error: entityError } = useEntities(
    typeFilter !== 'all' ? typeFilter : undefined,
    undefined,
    sortBy,
    50
  )
  const { data: trendingData, isLoading: trendingLoading, error: trendingError } = useTrendingEntities()
  const { data: coOccurrence, isLoading: coLoading, error: coError } = useCoOccurrence()

  const hasError = entityError || trendingError || coError

  return (
    <div className="p-6 space-y-6">
      {hasError && (
        <ErrorState message="Failed to load entity data. Please check your connection." onRetry={() => window.location.reload()} />
      )}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Entities</h2>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="technology">Technology</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mentions">Mentions</SelectItem>
            <SelectItem value="trend">Trending</SelectItem>
            <SelectItem value="sentiment">Sentiment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entity Network Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityNetworkGraph
              data={coOccurrence}
              loading={coLoading}
              onEntityClick={(name) => router.push(`/feed?entity=${encodeURIComponent(name)}`)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entity Cloud</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityCloud
              data={entityData}
              loading={entityLoading}
              onEntityClick={(name) => router.push(`/feed?entity=${encodeURIComponent(name)}`)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trending Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendingEntitiesChart data={trendingData} loading={trendingLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Entity Details</CardTitle>
        </CardHeader>
        <CardContent>
          {entityLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <EntityTable entities={entityData?.entities ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
