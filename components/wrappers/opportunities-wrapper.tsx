'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { SerializedOpportunity, OpportunityVisibility, Attachment } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'
import { Timestamp } from 'firebase/firestore'
import { useAppContext } from '@/contexts/app-context'
import { useTranslations } from 'next-intl'
import { OpportunitySuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'

// Dynamically import components
const Opportunities = dynamic(() => import('@/features/opportunities/components/opportunities'), {
  ssr: false
})

const OpportunityDetails = dynamic(() => import('@/features/opportunities/components/opportunity-details'), {
  ssr: false
})

interface OpportunitiesWrapperProps {
  initialOpportunities?: SerializedOpportunity[]
  initialOpportunity?: (SerializedOpportunity & {
    attachments?: Attachment[];
    visibility: OpportunityVisibility;
    expirationDate: string;
  }) | null
  initialEntity?: SerializedEntity | null
  initialError?: string | null
  lastVisible?: string | null
  initialLimit: number
}

export default function OpportunitiesWrapper({ 
  initialOpportunities = [],
  initialOpportunity,
  initialEntity,
  initialError, 
  lastVisible, 
  initialLimit 
}: OpportunitiesWrapperProps) {
  const [isClient, setIsClient] = React.useState(false)
  const searchParams = useSearchParams()
  const { setEntities, setError } = useAppContext()

  const limit = parseInt(searchParams.get('limit') || initialLimit.toString(), 10)

  // Initialize client-side state only once on mount
  React.useEffect(() => {
    setIsClient(true)
    // Only set error if there is one
    if (initialError) {
      setError(initialError)
    }
  }, [setError, initialError])

  if (!isClient) {
    return (
      <OpportunitySuspenseBoundary 
        level="page" 
        showProgress={true}
        description="Preparing opportunities directory for display"
        retryEnabled={false}
      >
        <div />
      </OpportunitySuspenseBoundary>
    )
  }

  // If initialOpportunity is provided, render opportunity-details
  if (initialOpportunity) {
    return (
      <OpportunitySuspenseBoundary 
        level="page" 
        showProgress={true}
        description="Loading opportunity details and related information"
        retryEnabled={true}
        onRetry={() => window.location.reload()}
      >
        <OpportunityDetails 
          initialOpportunity={initialOpportunity}
          initialEntity={initialEntity || null}
          initialError={initialError}
        />
      </OpportunitySuspenseBoundary>
    )
  }

  // Otherwise, render the opportunities list
  return (
    <OpportunitySuspenseBoundary 
      level="page" 
      showProgress={true}
      description="Loading opportunities directory with filtering and search capabilities"
      retryEnabled={true}
      onRetry={() => window.location.reload()}
    >
      <Opportunities 
        initialOpportunities={initialOpportunities}
        initialError={initialError}
        lastVisible={lastVisible}
        limit={limit}
      />
    </OpportunitySuspenseBoundary>
  )
}

