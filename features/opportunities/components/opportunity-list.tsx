'use client'

import React, { useCallback, useEffect, useMemo } from 'react'
import { useOptimistic, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'
import { Building, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { fingerprintFromSearchParams } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'
import { OpportunityFeedCard } from '@/features/opportunities/components/opportunity-feed-card'

interface OpportunityListProps {
  initialOpportunities: SerializedOpportunity[]
  initialEntities: { [key: string]: Entity }
  initialError: string | null
  lastVisible: string | null
  limit: number
  totalCount?: number
  locale: string
}

interface OptimisticOpportunity extends SerializedOpportunity {
  isOptimistic?: boolean
  isPending?: boolean
  error?: string
}



export default function OpportunityList({
  initialOpportunities,
  initialEntities,
  initialError,
  lastVisible: initialLastVisible,
  limit,
  totalCount = 0,
  locale
}: OpportunityListProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const filterFingerprint = useMemo(
    () => fingerprintFromSearchParams('opportunities', searchParams),
    [searchParams],
  )

  const fetchOpportunitiesPage = useCallback(
    async (cursor: string | null) => {
      const queryParams = new URLSearchParams({ limit: limit.toString() })
      if (cursor) queryParams.set('startAfter', cursor)

      const response = await apiClient.get(`/api/opportunities?${queryParams}`, {
        timeout: 10000,
        retries: 1,
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch opportunities')
      }

      return normalizePaginatedResponse<SerializedOpportunity>(response.data, limit)
    },
    [limit],
  )

  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>(initialEntities)

  const loadEntitiesForOpportunities = useCallback(
    async (opportunities: SerializedOpportunity[]) => {
      const uniqueEntityIds = [
        ...new Set(
          opportunities
            .map((opp) => opp.organizationId)
            .filter((id) => id && id.trim() !== ''),
        ),
      ].filter((id) => !entities[id])

      if (uniqueEntityIds.length === 0) return

      const entityPromises = uniqueEntityIds.map((id) =>
        apiClient.get(`/api/entities/${id}`, { timeout: 5000, retries: 1 }),
      )
      const fetchResponses = await Promise.allSettled(entityPromises)
      const entityMap: { [key: string]: Entity } = {}

      fetchResponses.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          entityMap[uniqueEntityIds[index] as string] = result.value.data
        }
      })

      setEntities((prev) => ({ ...prev, ...entityMap }))
    },
    [entities],
  )

  const {
    items: feedItems,
    loading,
    hasMore,
    error: feedError,
    sentinelRef,
  } = useCursorFeed<SerializedOpportunity>({
    moduleId: 'opportunities',
    locale,
    limit,
    filterFingerprint,
    initialItems: initialOpportunities,
    initialCursor: initialLastVisible,
    enabled: Boolean(session),
    fetchPage: fetchOpportunitiesPage,
    onItemsAdded: (added) => {
      void loadEntitiesForOpportunities(added)
    },
  })

  const [optimisticOpportunities, addOptimisticOpportunity] = useOptimistic<
    OptimisticOpportunity[],
    OptimisticOpportunity
  >(feedItems, (currentOpportunities, newOpportunity) => {
    return [{ ...newOpportunity, isOptimistic: true }, ...currentOpportunities]
  })

  const error = feedError ?? initialError

  // Sync entities when parent-provided initialEntities change
  useEffect(() => {
    setEntities(initialEntities)
  }, [initialEntities])

  // Server action state for opportunity creation (wrap to pass locale)
  const [createState, _createAction] = useActionState<OpportunityFormState | null, FormData>(
    (prevState, formData) => createOpportunity(prevState, formData, locale as Locale),
    null
  )

  // Use optimistic opportunities directly (filtering moved to wrapper)
  const displayOpportunities = optimisticOpportunities

  // Handle optimistic opportunity creation
  const handleOptimisticCreate = (opportunityData: Partial<SerializedOpportunity>) => {
    if (!session?.user) return

    const optimisticOpportunity: OptimisticOpportunity = {
      id: `temp-${Date.now()}`,
      title: opportunityData.title || '',
      type: opportunityData.type || 'offer',
      briefDescription: opportunityData.briefDescription || '',
      fullDescription: opportunityData.fullDescription || '',
      category: opportunityData.category || '',
      location: opportunityData.location || '',
      tags: opportunityData.tags || [],
      createdBy: session.user.id,
      applicantCount: 0, // Initialize with 0 applicants
      organizationId: opportunityData.organizationId || '',
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      expirationDate: opportunityData.expirationDate ? new Date(opportunityData.expirationDate).toISOString() : new Date().toISOString(),
      status: 'active',
      requiredSkills: opportunityData.requiredSkills || [],
      requiredDocuments: opportunityData.requiredDocuments || [],
      attachments: opportunityData.attachments || [],
      visibility: opportunityData.visibility || 'public',
      contactInfo: opportunityData.contactInfo || { linkedEntity: '', contactAccount: '' },
      budget: opportunityData.budget,
      isConfidential: opportunityData.isConfidential || false,
      isOptimistic: true,
      isPending: true
    }

    addOptimisticOpportunity(optimisticOpportunity)
  }



  if (status === 'loading') {
    return <LoadingMessage message={t('loadingMessage')} />
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <UnifiedLoginInline variant="hero" />
        </div>
      </div>
    )
  }

  return (
    <>
        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message for Optimistic Creates */}
        {createState?.success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{createState.message}</AlertDescription>
          </Alert>
        )}

        {/* Opportunity List */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="popLayout">
            {displayOpportunities.map((opportunity) => (
              <OpportunityFeedCard
                key={opportunity.id}
                opportunity={opportunity}
                entity={entities[opportunity.organizationId]}
                locale={locale as Locale}
                mode="browse"
                isOptimistic={opportunity.isOptimistic}
                isPending={opportunity.isPending}
              />
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {displayOpportunities.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noOpportunities')}</h3>
              <p className="text-muted-foreground mb-4">{t('noOpportunitiesDescription')}</p>
              <AddOpportunityButton locale={locale as any} />
            </motion.div>
          )}

          {/* Loading More */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('loadingMoreOpportunities')}</span>
              </div>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          {hasMore && !loading && <div ref={sentinelRef} className="h-10" />}
        </div>
    </>
  )
}

// Loading Message Component
function LoadingMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-lg">{message}</span>
      </div>
    </div>
  )
}

