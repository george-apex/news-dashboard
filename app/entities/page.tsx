'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEntityProfiles, useTrendingEntities } from '@/lib/hooks/useApiHooks'
import { EntityProfileCard } from '@/components/cards/EntityProfileCard'
import { TrendingEntitiesChart } from '@/components/charts/TrendingEntitiesChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/ErrorState'
import { Brain } from 'lucide-react'

export default function MarketIntelligencePage() {
  const router = useRouter()
  const { data: profilesData, isLoading: profilesLoading, error: profilesError } = useEntityProfiles()
  const { data: trendingData, isLoading: trendingLoading } = useTrendingEntities()

  if (profilesError) {
    return (
      <div className="p-6">
        <ErrorState message="Failed to load entity profiles." onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const profiles = profilesData?.profiles ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Market Intelligence</h2>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trending Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendingEntitiesChart data={trendingData} loading={trendingLoading} />
        </CardContent>
      </Card>

      {profilesLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No entity profiles yet. Run a sweep to generate intelligence data.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <EntityProfileCard
              key={profile.name}
              profile={profile}
              onHeadlineClick={(url) => window.open(url, '_blank')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
