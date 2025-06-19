'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import type { Opportunity } from '@/types'
import { UserRole } from '@/features/auth/types'
import { 
  ConfidentialOpportunitiesProvider 
} from '@/features/opportunities/context/confidential-opportunities-context'

// Simple loading component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Loading confidential opportunities...</div>
    </div>
  )
}

// Props interface
interface ConfidentialOpportunitiesWrapperProps {
  initialOpportunities: Opportunity[]
  initialError: string | null
  initialPage: number
  page: number
  totalPages: number
  filter: string
  totalOpportunities: number
  lastVisible: string | null
  initialLimit: number
  sort: string
  initialSort: string
  initialFilter: string
}

// Main component
export default function ConfidentialOpportunitiesWrapper({
  initialOpportunities,
  initialError,
  initialPage,
  page,
  totalPages,
  filter,
  totalOpportunities,
  lastVisible,
  initialLimit,
  sort,
  initialSort,
  initialFilter
}: ConfidentialOpportunitiesWrapperProps) {
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
      (sessionData.data.user?.role !== UserRole.CONFIDENTIAL && 
       sessionData.data.user?.role !== UserRole.ADMIN)) {
    return (
      <div className="text-center p-4 text-red-500">
        You don't have permission to view this page.
      </div>
    )
  }

  // Import the component only when needed
  const ConfidentialOpportunities = React.lazy(() => 
    import('@/features/opportunities/components/confidential-opportunities')
  )

  return (
    <ConfidentialOpportunitiesProvider 
      initialOpportunities={initialOpportunities} 
      initialError={initialError}
    >
      <React.Suspense fallback={<LoadingFallback />}>
        <ConfidentialOpportunities 
          initialOpportunities={initialOpportunities} 
          initialError={initialError}
          page={currentPage}
          totalPages={totalPages}
          totalOpportunities={totalOpportunities}
          lastVisible={lastVisible}
          limit={limit}
          sort={currentSort}
          filter={currentFilter}
        />
      </React.Suspense>
    </ConfidentialOpportunitiesProvider>
  )
}