'use client'

import React, { useEffect, useCallback, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import Link from 'next/link'
import { Calendar, MapPin, Tag, Building, User, DollarSign, Clock } from 'lucide-react'
import Image from 'next/image'
import { useSession } from "next-auth/react"
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useInView } from '@/hooks/use-intersection-observer'
import { formatDateValue, truncateDescription, fetchOpportunities, formatBudget } from '@/lib/utils'
import { useAppContext } from '@/contexts/app-context'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'
import { usePathname, useSearchParams } from 'next/navigation'
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
  limit 
}) => {
  const t = useTranslations('modules.opportunities')
  const { theme } = useTheme()
  const { data: session, status } = useSession({ required: false })
  const { error, setError } = useAppContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = React.useState<SerializedOpportunity[]>(initialOpportunities)
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>({})
  const [loading, setLoading] = React.useState(false)
  const [lastVisible, setLastVisible] = React.useState<string | null>(initialLastVisible)
  const { ref, inView } = useInView()

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  // Extract locale from pathname
  const locale = pathname.split('/')[1] || 'en'
  
  // Get filters from URL params (managed by OpportunitiesSearchClient)
  const filters = React.useMemo(() => ({
    search: searchParams.get('q') || '',
    types: searchParams.get('types')?.split(',').filter(Boolean) || [],
    categories: searchParams.get('categories')?.split(',').filter(Boolean) || [],
    location: searchParams.get('location') || '',
    budgetMin: searchParams.get('budgetMin') || '',
    budgetMax: searchParams.get('budgetMax') || '',
    currency: searchParams.get('currency') || 'USD',
    priority: searchParams.get('priority') || '',
    deadline: searchParams.get('deadline') || '',
    entityVerified: searchParams.get('entityVerified') === 'true' ? true : searchParams.get('entityVerified') === 'false' ? false : null,
    hasDeadline: searchParams.get('hasDeadline') === 'true' ? true : searchParams.get('hasDeadline') === 'false' ? false : null
  }), [searchParams])

  // Real-time opportunities integration
  const realtime = useRealtimeOpportunities({
    autoConnect: true,
    debug: false
  })

  // Use optimistic opportunities for real-time updates
  const { opportunities: realtimeOpportunities } = useOptimisticOpportunities(initialOpportunities)

  useEffect(() => {
    setOpportunities(initialOpportunities)
    setError(initialError)
  }, [initialOpportunities, initialError, setError])

  const fetchMoreOpportunities = useCallback(async () => {
    if (loading || !lastVisible) return

    setLoading(true)
    setError(null)

    try {
      const data = await fetchOpportunities('/api/opportunities', limit, lastVisible)
      setOpportunities(prev => [...prev, ...data.opportunities])
      setLastVisible(data.lastVisible)
    } catch (error) {
      console.error('Error fetching more opportunities:', error)
      setError(t('errorFetchingMoreOpportunities'))
    } finally {
      setLoading(false)
    }
  }, [loading, lastVisible, limit, t, setError])

  useEffect(() => {
    if (inView) {
      fetchMoreOpportunities()
    }
  }, [inView, fetchMoreOpportunities])

  useEffect(() => {
    const fetchEntities = async () => {
      if (!session || opportunities.length === 0) return

      setLoading(true)
      setError(null)
      try {
        // Deduplicate entity IDs before fetching
        // Filter out null, empty, or already loaded entities
        const uniqueEntityIds = [...new Set(opportunities.map(opp => opp.organizationId))]
        const missingEntityIds = uniqueEntityIds.filter(id => id && id.trim() !== '' && !entities[id])
        
        if (missingEntityIds.length === 0) {
          setLoading(false)
          return
        }

        const { apiClient } = await import('@/lib/api-client')
        const entityPromises = missingEntityIds.map(id => 
          apiClient.get(`/api/entities/${id}`, {
            timeout: 5000,
            retries: 1
          })
        )
        
        const fetchResponses = await Promise.allSettled(entityPromises)
        const entityMap: { [key: string]: Entity } = {}
        
        fetchResponses.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.data) {
            entityMap[missingEntityIds[index]] = result.value.data
          }
        })
        
        setEntities(prev => ({ ...prev, ...entityMap }))
      } catch (error) {
        console.error('Error fetching entities:', error)
        setError(t('errorFetchingEntities'))
      } finally {
        setLoading(false)
      }
    }

    fetchEntities()
  }, [opportunities, session, t, setError])

  if (status === 'loading') {
    return <LoadingMessage message={t('loadingMessage')} />
  }

  if (!session) {
    const from = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : undefined
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-4xl font-bold mb-4"
        >
          {t('introTitle') || 'Discover Opportunities'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="max-w-2xl text-muted-foreground mb-8"
        >
          {t('introDescription') || 'The Opportunities page curates jobs, partnerships, grants, and collaborations from entities in our ecosystem. Sign in to browse and apply.'}
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

  // Filter opportunities based on current filter state
  const filteredOpportunities = React.useMemo(() => {
    return realtimeOpportunities.filter((opportunity) => {
      // Search filter
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase()
        const searchableText = `${opportunity.title} ${opportunity.briefDescription} ${opportunity.tags?.join(' ') || ''}`.toLowerCase()
        if (!searchableText.includes(searchTerm)) {
          return false
        }
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(opportunity.type)) {
        return false
      }

      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(opportunity.category)) {
        return false
      }

      // Location filter
      if (filters.location && filters.location.trim() !== '') {
        const locationTerm = filters.location.toLowerCase()
        if (!opportunity.location.toLowerCase().includes(locationTerm)) {
          return false
        }
      }

      // Budget filters
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

      // Priority filter
      if (filters.priority && filters.priority !== 'all') {
        if (opportunity.priority !== filters.priority) {
          return false
        }
      }

      // Deadline filter
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

      // Entity verified filter (placeholder - would need entity data)
      if (filters.entityVerified !== null) {
        // This would require fetching entity verification status
        // For now, skip this filter
      }

      // Has deadline filter
      if (filters.hasDeadline !== null) {
        const hasDeadline = !!opportunity.applicationDeadline
        if (filters.hasDeadline !== hasDeadline) {
          return false
        }
      }

      return true
    })
  }, [realtimeOpportunities, filters])

  return (
    <div className="min-h-screen bg-background dark:bg-[hsl(var(--page-background))] text-foreground">
      {/* Real-time Status Indicator */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                realtime.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {realtime.isConnected ? 'Live Updates Active' : 'Offline Mode'}
              </span>
              {realtime.lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  • Last update: {realtime.lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
            {realtime.provider && (
              <span className="text-xs text-muted-foreground">
                via {realtime.provider}
              </span>
            )}
          </div>
        </div>
      </div>

      <OpportunityList
        initialOpportunities={realtimeOpportunities}
        initialEntities={entities}
        initialError={error}
        lastVisible={lastVisible}
        limit={limit}
        totalCount={filteredOpportunities.length}
        locale={locale}
      />
      {loading && <LoadingMessage message={t('loadingMoreOpportunities')} />}
      {!loading && lastVisible && <div ref={ref} className="h-10" />}
    </div>
  )
}

const LoadingMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center">
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-xl"
    >
      {message}
    </motion.p>
  </div>
)

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center">
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

const PageTitle: React.FC<{ title: string }> = ({ title }) => (
  <motion.h1
    initial={{ opacity: 0, y: -50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="text-4xl font-bold text-center mb-8"
  >
    {title}
  </motion.h1>
)

// (Removed local OpportunityList to avoid conflict with imported one)

const OpportunityCard: React.FC<{ opportunity: SerializedOpportunity, entity: Entity | undefined }> = ({ opportunity, entity }) => {
  const t = useTranslations('modules.opportunities')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <Image
              src={entity?.logo || '/placeholder.svg'}
              alt={entity?.name || 'Company logo'}
              width={40}
              height={40}
              className="rounded-full mr-3"
            />
            <div>
              <h2 className="font-semibold">{entity?.name}</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{opportunity.location}</span>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{opportunity.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{truncateDescription(opportunity.briefDescription)}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center text-sm">
              <Building className="w-4 h-4 mr-2" />
              <span>{opportunity.category}</span>
            </div>
            <div className="flex items-center text-sm">
              <User className="w-4 h-4 mr-2" />
              <span>{opportunity.createdBy}</span>
            </div>
            <div className="flex items-center text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{formatDateValue(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2" />
              <span>{formatDateValue(opportunity.dateCreated)}</span>
            </div>
          </div>
          {opportunity.budget && (
            <div className="flex items-center text-sm mb-4">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>{formatBudget(opportunity.budget)}</span>
            </div>
          )}
          <OpportunityTags tags={opportunity.tags} />
          <Button asChild className="w-full mt-4">
            <Link href={`/opportunities/${opportunity.id}`}>
              {t('viewDetails')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

const OpportunityTags: React.FC<{ tags: string[] }> = ({ tags }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    <Tag className="w-4 h-4 mr-2" />
    {tags.slice(0, 3).map((tag, index) => (
      <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">{tag}</span>
    ))}
    {tags.length > 3 && (
      <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">+{tags.length - 3}</span>
    )}
  </div>
)

export default Opportunities

