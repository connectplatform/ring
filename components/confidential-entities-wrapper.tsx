'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import type { Entity } from '@/types'
import { 
  ConfidentialEntitiesProvider 
} from '@/features/entities/context/confidential-entities-context'

// Simple loading component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Loading confidential entities...</div>
    </div>
  )
}

// Props interface
interface ConfidentialEntitiesWrapperProps {
  initialEntities: Entity[]
  initialError: string | null
  initialPage: number
  page: number
  totalPages: number
  totalEntities: number
  lastVisible: string | null
  initialLimit: number
  initialSort: string
  initialFilter: string
}

// Main component
export default function ConfidentialEntitiesWrapper({
  initialEntities,
  initialError,
  initialPage,
  page,
  totalPages,
  totalEntities,
  lastVisible,
  initialLimit,
  initialSort,
  initialFilter
}: ConfidentialEntitiesWrapperProps) {
  // Use React hooks directly without destructuring
  const sessionData = useSession()
  const searchParamsData = useSearchParams()
  const [isClient, setIsClient] = React.useState(false)

  // Parse search params
  const currentPage = parseInt(searchParamsData.get('page') || initialPage.toString(), 10)
  const limit = parseInt(searchParamsData.get('limit') || initialLimit.toString(), 10)
  const currentSort = searchParamsData.get('sort') || initialSort
  const currentFilter = searchParamsData.get('filter') || initialFilter

  // Set isClient to true when component mounts
  React.useEffect(() => {
    setIsClient(true)
  }, [])

  // Show loading state
  if (!isClient || sessionData.status === 'loading') {
    return <LoadingFallback />
  }

  // Check permissions
  if (!sessionData.data || 
      (sessionData.data.user?.role !== 'confidential' && 
       sessionData.data.user?.role !== 'admin')) {
    return (
      <div className="text-center p-4 text-red-500">
        You don't have permission to view this page.
      </div>
    )
  }

  // Import the component only when needed
  const ConfidentialEntities = React.lazy(() => 
    import('@/features/entities/components/confidential-entities')
  )

  return (
    <ConfidentialEntitiesProvider 
      initialEntities={initialEntities} 
      initialError={initialError}
    >
      <React.Suspense fallback={<LoadingFallback />}>
        <ConfidentialEntities 
          initialEntities={initialEntities} 
          initialError={initialError}
          page={currentPage}
          totalPages={totalPages}
          totalEntities={totalEntities}
          lastVisible={lastVisible}
          limit={limit}
          sort={currentSort}
          filter={currentFilter}
        />
      </React.Suspense>
    </ConfidentialEntitiesProvider>
  )
}