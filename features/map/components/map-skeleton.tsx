/**
 * Map Loading Skeleton
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function MapSkeleton() {
  return (
    <div className="relative h-full w-full">
      {/* Controls Skeleton */}
      <div className="absolute top-4 left-4 z-10 w-96 space-y-2">
        <Card>
          <CardContent className="p-3">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Map Skeleton */}
      <div className="h-full w-full bg-muted animate-pulse" />
    </div>
  )
}
