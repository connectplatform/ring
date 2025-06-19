'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Opportunity, OpportunityVisibility, Attachment } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { Timestamp } from 'firebase/firestore'
import { useAppContext } from '@/contexts/app-context'
import { useTranslation } from '@/node_modules/react-i18next'

// Dynamically import components with loading fallback
const Opportunities = dynamic(() => import('@/features/opportunities/components/opportunities'), {
  loading: () => <LoadingFallback />,
  ssr: false
})

const OpportunityDetails = dynamic(() => import('@/features/opportunities/components/opportunity-details'), {
  loading: () => <LoadingFallback />,
  ssr: false
})

function LoadingFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">{t('loading')}</div>
    </div>
  )
}

interface OpportunitiesWrapperProps {
  initialOpportunities?: Opportunity[]
  initialOpportunity?: (Opportunity & {
    attachments: Attachment[];
    visibility: OpportunityVisibility;
    expirationDate: Timestamp;
  }) | null
  initialEntity?: Entity | null
  initialError: string | null
  lastVisible: string | null
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
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(initialOpportunities)

  const limit = parseInt(searchParams.get('limit') || initialLimit.toString(), 10)

  // Initialize state on mount
  React.useEffect(() => {
    setIsClient(true)
    setOpportunities(initialOpportunities)
    setError(initialError)
  }, [initialOpportunities, initialError, setError])

  if (!isClient) {
    return <LoadingFallback />
  }

  // If initialOpportunity is provided, render opportunity-details
  if (initialOpportunity) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <OpportunityDetails 
          initialOpportunity={initialOpportunity}
          initialEntity={initialEntity || null}
          initialError={initialError}
        />
      </Suspense>
    )
  }

  // Otherwise, render the opportunities list
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Opportunities 
        initialOpportunities={opportunities}
        initialError={initialError}
        lastVisible={lastVisible}
        limit={limit}
      />
    </Suspense>
  )
}

