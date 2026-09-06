'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { useSession } from 'next-auth/react'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { useAppContext } from '@/contexts/app-context'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import OpportunityList from './opportunity-list'
import { useRealtimeOpportunities, useOptimisticOpportunities } from '@/hooks/use-realtime-opportunities'

interface OpportunitiesProps {
  initialOpportunities: SerializedOpportunity[]
  initialError: string | null
  lastVisible: string | null
  limit: number
}

const Opportunities: React.FC<OpportunitiesProps> = ({
  initialOpportunities,
  initialError,
  lastVisible: initialLastVisible,
  limit,
}) => {
  const t = useTranslations('modules.opportunities')
  const { data: session, status } = useSession({ required: false })
  const { error, setError } = useAppContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = React.useState<SerializedOpportunity[]>(initialOpportunities)
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>({})

  const locale = useLocale() as Locale

  const filters = React.useMemo(
    () => ({
      search: searchParams.get('q') || '',
      types: searchParams.get('types')?.split(',').filter(Boolean) || [],
      categories: searchParams.get('categories')?.split(',').filter(Boolean) || [],
      location: searchParams.get('location') || '',
      budgetMin: searchParams.get('budgetMin') || '',
      budgetMax: searchParams.get('budgetMax') || '',
      currency: searchParams.get('currency') || 'USD',
      priority: searchParams.get('priority') || '',
      deadline: searchParams.get('deadline') || '',
      entityVerified:
        searchParams.get('entityVerified') === 'true'
          ? true
          : searchParams.get('entityVerified') === 'false'
            ? false
            : null,
      hasDeadline:
        searchParams.get('hasDeadline') === 'true'
          ? true
          : searchParams.get('hasDeadline') === 'false'
            ? false
            : null,
    }),
    [searchParams],
  )

  useRealtimeOpportunities({
    autoConnect: true,
    debug: false,
  })

  const { opportunities: realtimeOpportunities } = useOptimisticOpportunities(initialOpportunities)

  const filteredOpportunities = React.useMemo(() => {
    return realtimeOpportunities.filter((opportunity) => {
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase()
        const searchableText =
          `${opportunity.title} ${opportunity.briefDescription} ${opportunity.tags?.join(' ') || ''}`.toLowerCase()
        if (!searchableText.includes(searchTerm)) {
          return false
        }
      }

      if (filters.types.length > 0 && !filters.types.includes(opportunity.type)) {
        return false
      }

      if (filters.categories.length > 0 && !filters.categories.includes(opportunity.category)) {
        return false
      }

      if (filters.location && filters.location.trim() !== '') {
        const locationTerm = filters.location.toLowerCase()
        if (!opportunity.location.toLowerCase().includes(locationTerm)) {
          return false
        }
      }

      if (filters.budgetMin && filters.budgetMin.trim() !== '') {
        const minBudget = parseFloat(filters.budgetMin)
        if (opportunity.budget?.max && opportunity.budget.max < minBudget) {
          return false
        }
      }

      if (filters.budgetMax && filters.budgetMax.trim() !== '') {
        const maxBudget = parseFloat(filters.budgetMax)
        if (opportunity.budget?.min && opportunity.budget.min > maxBudget) {
          return false
        }
      }

      if (filters.priority && filters.priority !== 'all') {
        if (opportunity.priority !== filters.priority) {
          return false
        }
      }

      if (filters.deadline && filters.deadline !== 'all') {
        const now = new Date()
        if (filters.deadline === 'today') {
          const today = new Date()
          today.setHours(23, 59, 59, 999)
          if (!opportunity.applicationDeadline || new Date(opportunity.applicationDeadline) > today) {
            return false
          }
        } else if (filters.deadline === 'week') {
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          if (!opportunity.applicationDeadline || new Date(opportunity.applicationDeadline) > weekFromNow) {
            return false
          }
        } else if (filters.deadline === 'month') {
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          if (!opportunity.applicationDeadline || new Date(opportunity.applicationDeadline) > monthFromNow) {
            return false
          }
        } else if (filters.deadline === 'no-deadline') {
          if (opportunity.applicationDeadline) {
            return false
          }
        }
      }

      if (filters.hasDeadline !== null) {
        const hasDeadline = !!opportunity.applicationDeadline
        if (filters.hasDeadline !== hasDeadline) {
          return false
        }
      }

      return true
    })
  }, [realtimeOpportunities, filters])

  useEffect(() => {
    setOpportunities(initialOpportunities)
    setError(initialError)
  }, [initialOpportunities, initialError, setError])

  useEffect(() => {
    const fetchEntities = async () => {
      if (!session || opportunities.length === 0) return

      setError(null)
      try {
        const uniqueEntityIds = [...new Set(opportunities.map((opp) => opp.organizationId))]
        const missingEntityIds = uniqueEntityIds.filter((id) => id && id.trim() !== '' && !entities[id])

        if (missingEntityIds.length === 0) {
          return
        }

        const { apiClient } = await import('@/lib/api-client')
        const entityPromises = missingEntityIds.map((id) =>
          apiClient.get(`/api/entities/${id}`, {
            timeout: 5000,
            retries: 1,
          }),
        )

        const fetchResponses = await Promise.allSettled(entityPromises)
        const entityMap: { [key: string]: Entity } = {}

        fetchResponses.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.data) {
            entityMap[missingEntityIds[index]] = result.value.data
          }
        })

        setEntities((prev) => ({ ...prev, ...entityMap }))
      } catch (fetchError) {
        console.error('Error fetching entities:', fetchError)
        setError(t('errorFetchingEntities'))
      }
    }

    void fetchEntities()
  }, [opportunities, session, t, setError])

  if (status === 'loading') {
    return <LoadingMessage message={t('loadingMessage')} />
  }

  if (!session) {
    const search = searchParams.toString()
    const from = pathname + (search ? `?${search}` : '')
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 text-4xl font-bold"
        >
          {t('introTitle') || 'Discover Opportunities'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-8 max-w-2xl text-muted-foreground"
        >
          {t('introDescription') ||
            'The Opportunities page curates jobs, partnerships, grants, and collaborations from entities in our ecosystem. Sign in to browse and apply.'}
        </motion.p>
        <div className="w-full max-w-md">
          <UnifiedLoginInline from={from} variant="hero" />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="min-h-full text-foreground">
      <OpportunityList
        initialOpportunities={realtimeOpportunities}
        initialEntities={entities}
        initialError={error}
        lastVisible={initialLastVisible}
        limit={limit}
        totalCount={filteredOpportunities.length}
        locale={locale}
      />
    </div>
  )
}

const LoadingMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-4 py-12 text-center">
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-xl">
      {message}
    </motion.p>
  </div>
)

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-4 py-12 text-center">
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-xl text-destructive"
    >
      {message}
    </motion.p>
  </div>
)

export default Opportunities
