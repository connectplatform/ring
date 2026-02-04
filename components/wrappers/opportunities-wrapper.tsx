'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, usePathname } from 'next/navigation'
import { SerializedOpportunity, OpportunityVisibility, Attachment } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'
import { useAppContext } from '@/contexts/app-context'
import { Locale, useTranslations } from 'next-intl'
import { OpportunitySuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, User, Briefcase } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useSession } from 'next-auth/react'
import OpportunitiesSubmenu from '@/components/navigation/opportunities-submenu'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'


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
  initialOpportunities = [],
  initialOpportunity,
  initialEntity,
  initialError,
  lastVisible,
  initialLimit
}: OpportunitiesWrapperProps) {
  const [isClient, setIsClient] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('all')

  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Restore useAppContext hook
  const { setEntities, setError } = useAppContext()
  // Restore useSession hook - optional for unauthenticated visitors
  const { data: session } = useSession({ required: false })
  // Restore useTranslations hook
  const t = useTranslations('modules.opportunities')

  const locale = pathname.split('/')[1] || 'en'
  const isMyOpportunitiesPage = pathname.includes('/my-opportunities')

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

  // Otherwise, render the opportunities list with navigation
  return (
    <div>
      {/* Main Navigation Bar for Opportunities */}
      <div className="bg-background border-b border-border mb-6">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">
              {t('opportunities', { defaultValue: 'Opportunities' })}
            </h1>

            <div className="flex flex-wrap gap-3">
              {session?.user && (
                <>
                  <Link href={`/${locale}/my-opportunities`}>
                    <Button variant="outline" className="flex items-center gap-2">
                      <User size={20} />
                      {t('myOpportunities', { defaultValue: 'My Opportunities' })}
                    </Button>
                  </Link>
                  <AddOpportunityButton locale={locale as any} className="flex items-center gap-2" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Restore Submenu Navigation - Only show on My Opportunities page */}
      {isMyOpportunitiesPage && (
        <OpportunitiesSubmenu
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={{
            all: initialOpportunities.length,
            saved: 0, // TODO: Get from user preferences
            applied: 0, // TODO: Get from user applications
            posted: 0, // TODO: Get from user's posted opportunities
            drafts: 0, // TODO: Get from user's draft opportunities
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
}

