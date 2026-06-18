'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { usePathname } from '@/i18n/routing'
import { SerializedOpportunity, OpportunityVisibility, Attachment, type OpportunitySubmenuTab } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'
import { useAppContext } from '@/contexts/app-context'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { OpportunitySuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'
import OpportunitiesSubmenu from '@/components/navigation/opportunities-submenu'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import OpportunitiesFiltersRail from '@/components/opportunities/opportunities-filters-rail'


// Dynamically import components
const Opportunities = dynamic(() => import('@/features/opportunities/components/opportunities'), {
  ssr: false
})

const OpportunityDetails = dynamic(() => import('@/features/opportunities/components/opportunity-details'), {
  ssr: false
})

interface OpportunitiesWrapperProps {
  children?: React.ReactNode
  locale: Locale
  searchParams: { [key: string]: string | string[] | undefined }
  initialOpportunities?: SerializedOpportunity[]
  initialOpportunity?: (SerializedOpportunity & {
    attachments?: Attachment[];
    visibility: OpportunityVisibility;
    expirationDate: string;
  }) | null
  initialEntity?: SerializedEntity | null
  initialError?: string | null
  lastVisible?: string | null
  initialLimit?: number
}

export default function OpportunitiesWrapper({
  locale,
  initialOpportunities = [],
  initialOpportunity,
  initialEntity,
  initialError,
  lastVisible,
  initialLimit
}: OpportunitiesWrapperProps) {
  const [isClient, setIsClient] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<OpportunitySubmenuTab>('all')

  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Restore useAppContext hook
  const { setEntities, setError } = useAppContext()
  // Restore useTranslations hook
  const t = useTranslations('modules.opportunities')

  const isMyOpportunitiesPage = pathname === '/opportunities/my'
  const isBrowseListPage = pathname === '/opportunities'

  const limit = parseInt(searchParams.get('limit') || (initialLimit || 20).toString(), 10)

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
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // If initialOpportunity is provided, render opportunity-details
  if (initialOpportunity) {
    return (
      <OpportunitySuspenseBoundary
        level="page"
        showProgress={true}
        description={t('loadingOpportunityDetails', { defaultValue: "Loading opportunity details and related information" })}
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

  const listContent = (
    <div className="min-w-0 min-h-full px-4 py-4 sm:px-6">
      {isMyOpportunitiesPage && (
        <OpportunitiesSubmenu
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={{
            all: initialOpportunities.length,
            saved: 0,
            applied: 0,
            posted: 0,
            drafts: 0,
            expired: initialOpportunities.filter(opp =>
              opp.expirationDate && new Date(opp.expirationDate) < new Date()
            ).length
          }}
        />
      )}

      <OpportunitySuspenseBoundary
        level="page"
        showProgress={true}
        description={t('loadingOpportunities', { defaultValue: "Loading opportunities directory with filtering and search capabilities" })}
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
    </div>
  )

  if (isBrowseListPage) {
    return (
      <RingRightRailLayout
        showRightRail
        rightRail={
          <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-muted/40" />}>
            <OpportunitiesFiltersRail />
          </Suspense>
        }
        contentClassName="pb-24 lg:pb-8"
      >
        {listContent}
      </RingRightRailLayout>
    )
  }

  return listContent
}

