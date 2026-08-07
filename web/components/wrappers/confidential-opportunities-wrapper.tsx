'use client'

import React, { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Opportunity } from '@/types'
import { hasConfidentialAccess } from '@/features/auth/user-role'
import { ConfidentialOpportunitiesProvider } from '@/features/opportunities/context/confidential-opportunities-context'

const ConfidentialOpportunities = React.lazy(
  () => import('@/features/opportunities/components/confidential-opportunities')
)

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

function LoadingFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">{message}</div>
    </div>
  )
}

function canAccessConfidential(role: string | undefined | null): boolean {
  return hasConfidentialAccess(role)
}

export default function ConfidentialOpportunitiesWrapper({
  initialOpportunities,
  initialError,
  initialPage,
  page,
  totalPages,
  totalOpportunities,
  lastVisible,
  initialLimit,
  initialSort,
  initialFilter,
}: ConfidentialOpportunitiesWrapperProps) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const t = useTranslations('confidential.opportunities.wrapper')
  const [mounted, setMounted] = React.useState(false)

  const currentPage = parseInt(searchParams.get('page') || initialPage.toString(), 10)
  const limit = parseInt(searchParams.get('limit') || initialLimit.toString(), 10)
  const currentSort = searchParams.get('sort') || initialSort
  const currentFilter = searchParams.get('filter') || initialFilter

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || status === 'loading') {
    return <LoadingFallback message={t('loading')} />
  }

  if (!session?.user || !canAccessConfidential(session.user.role)) {
    return (
      <div className="text-center p-4 text-destructive">
        {t('permissionDenied')}
      </div>
    )
  }

  return (
    <div className="ring-content-panel min-w-0 min-h-full">
      <ConfidentialOpportunitiesProvider
        initialOpportunities={initialOpportunities}
        initialError={initialError}
      >
        <Suspense fallback={<LoadingFallback message={t('loading')} />}>
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
        </Suspense>
      </ConfidentialOpportunitiesProvider>
    </div>
  )
}
