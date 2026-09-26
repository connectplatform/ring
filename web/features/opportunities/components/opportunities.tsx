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
import { useRealtimeOpportunities } from '@/hooks/use-realtime-opportunities'

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
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>({})

  const locale = useLocale() as Locale

  useRealtimeOpportunities({
    autoConnect: true,
    debug: false,
  })

  useEffect(() => {
    setError(initialError)
  }, [initialError, setError])

  useEffect(() => {
    const fetchEntities = async () => {
      if (!session || initialOpportunities.length === 0) return

      setError(null)
      try {
        const uniqueEntityIds = [...new Set(initialOpportunities.map((opp) => opp.organizationId))]
        const missingEntityIds = uniqueEntityIds.filter((id) => id && id.trim() !== '')

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
  }, [initialOpportunities, session, t, setError])

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
        initialOpportunities={initialOpportunities}
        initialEntities={entities}
        initialError={error}
        lastVisible={initialLastVisible}
        limit={limit}
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
