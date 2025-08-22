'use client'

import React, { useCallback, useEffect } from 'react'
import { useOptimistic, useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import { useInView } from '@/hooks/use-intersection-observer'
import Link from 'next/link'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { 
  Calendar, 
  MapPin, 
  Tag, 
  Building, 
  User, 
  DollarSign, 
  Clock, 
  Plus,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

import { Opportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
import { formatTimestampOrFieldValue, truncateDescription, formatBudget } from '@/lib/utils'
import LoginForm from '@/features/auth/components/login-form'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'

interface OpportunityListProps {
  initialOpportunities: Opportunity[]
  initialEntities: { [key: string]: Entity }
  initialError: string | null
  lastVisible: string | null
  limit: number
  totalCount?: number
  locale: string
}

interface OptimisticOpportunity extends Opportunity {
  isOptimistic?: boolean
  isPending?: boolean
  error?: string
}

interface OpportunityFilters {
  search: string
  category: string
  type: 'all' | 'offer' | 'request'
  location: string
  sortBy: 'newest' | 'oldest' | 'budget' | 'deadline'
}

const defaultFilters: OpportunityFilters = {
  search: '',
  category: 'all',
  type: 'all',
  location: '',
  sortBy: 'newest'
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
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const { ref, inView } = useInView()

  // Optimistic state for opportunities
  const [optimisticOpportunities, addOptimisticOpportunity] = useOptimistic<
    OptimisticOpportunity[],
    OptimisticOpportunity
  >(
    initialOpportunities,
    (currentOpportunities, newOpportunity) => {
      // Add new opportunity at the beginning for instant feedback
      return [{ ...newOpportunity, isOptimistic: true }, ...currentOpportunities]
    }
  )

  // Local state for pagination and filtering
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>(initialEntities)
  const [loading, setLoading] = React.useState(false)
  const [lastVisible, setLastVisible] = React.useState<string | null>(initialLastVisible)
  const [error, setError] = React.useState<string | null>(initialError)
  const [filters, setFilters] = React.useState<OpportunityFilters>(defaultFilters)
  const [showFilters, setShowFilters] = React.useState(false)

  // Sync entities when parent-provided initialEntities change
  useEffect(() => {
    setEntities(initialEntities)
  }, [initialEntities])

  // Server action state for opportunity creation
  const [createState, createAction] = useActionState<OpportunityFormState | null, FormData>(
    createOpportunity,
    null
  )

  // Filter opportunities based on current filters
  const filteredOpportunities = React.useMemo(() => {
    return optimisticOpportunities.filter(opportunity => {
      const matchesSearch = !filters.search || 
        opportunity.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        opportunity.briefDescription.toLowerCase().includes(filters.search.toLowerCase())
      
      const matchesCategory = filters.category === 'all' || opportunity.category === filters.category
      const matchesType = filters.type === 'all' || opportunity.type === filters.type
      const matchesLocation = !filters.location || 
        opportunity.location.toLowerCase().includes(filters.location.toLowerCase())

      return matchesSearch && matchesCategory && matchesType && matchesLocation
    }).sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.dateCreated as any).getTime() - new Date(a.dateCreated as any).getTime()
        case 'oldest':
          return new Date(a.dateCreated as any).getTime() - new Date(b.dateCreated as any).getTime()
        case 'budget':
          const aBudget = a.budget?.max || 0
          const bBudget = b.budget?.max || 0
          return bBudget - aBudget
        case 'deadline':
          return new Date(a.expirationDate as any).getTime() - new Date(b.expirationDate as any).getTime()
        default:
          return 0
      }
    })
  }, [optimisticOpportunities, filters])

  // Fetch more opportunities for infinite scroll
  const fetchMoreOpportunities = useCallback(async () => {
    if (loading || !lastVisible || !session) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        startAfter: lastVisible,
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.location && { location: filters.location }),
        sort: filters.sortBy
      })

      const response = await apiClient.get(`/api/opportunities?${queryParams}`, {
        timeout: 10000,
        retries: 1
      })
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch opportunities')
      }

      const data = response.data
      
      // Update opportunities without affecting optimistic ones
      const newOpportunities = data.opportunities.filter((opp: Opportunity) => 
        !optimisticOpportunities.some(existing => existing.id === opp.id)
      )
      
      newOpportunities.forEach((opp: Opportunity) => addOptimisticOpportunity(opp))
      setLastVisible(data.lastVisible)

      // Fetch entities for new opportunities - with deduplication
      const uniqueEntityIds = [...new Set(newOpportunities
        .map((opp: Opportunity) => opp.organizationId)
        .filter(id => !entities[id]))]

      if (uniqueEntityIds.length > 0) {
        const entityPromises = uniqueEntityIds.map(id => 
          apiClient.get(`/api/entities/${id}`, {
            timeout: 5000,
            retries: 1
          })
        )

        const fetchResponses = await Promise.allSettled(entityPromises)
        const entityMap: { [key: string]: Entity } = {}
        
        fetchResponses.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.data) {
            entityMap[uniqueEntityIds[index] as string] = result.value.data
          }
        })
        
        setEntities(prev => ({ ...prev, ...entityMap }))
      }

    } catch (error) {
      console.error('Error fetching more opportunities:', error)
      setError(t('errorFetchingMoreOpportunities'))
    } finally {
      setLoading(false)
    }
  }, [loading, lastVisible, limit, filters, session, t, optimisticOpportunities, entities, addOptimisticOpportunity])

  // Trigger infinite scroll
  useEffect(() => {
    if (inView && !loading) {
      fetchMoreOpportunities()
    }
  }, [inView, fetchMoreOpportunities, loading])

  // Handle optimistic opportunity creation
  const handleOptimisticCreate = (opportunityData: Partial<Opportunity>) => {
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
      organizationId: opportunityData.organizationId || '',
      dateCreated: new Date() as any,
      dateUpdated: new Date() as any,
      expirationDate: opportunityData.expirationDate || new Date() as any,
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

  // Handle filter changes
  const handleFilterChange = (key: keyof OpportunityFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  if (status === 'loading') {
    return <LoadingMessage message={t('loadingMessage')} />
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[hsl(var(--page-background))] text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('opportunities')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('opportunitiesSubtitle', { count: totalCount })}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {t('filters')}
            </Button>
            
            <AddOpportunityButton locale={locale as any} />
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('search')}</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('searchOpportunities')}
                          value={filters.search}
                          onChange={(e) => handleFilterChange('search', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('category')}</label>
                      <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectCategory')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allCategories')}</SelectItem>
                          <SelectItem value="technology">{t('technology')}</SelectItem>
                          <SelectItem value="business">{t('business')}</SelectItem>
                          <SelectItem value="education">{t('education')}</SelectItem>
                          <SelectItem value="healthcare">{t('healthcare')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('type')}</label>
                      <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allTypes')}</SelectItem>
                          <SelectItem value="offer">{t('offer')}</SelectItem>
                          <SelectItem value="request">{t('request')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('sortBy')}</label>
                      <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('sortBy')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">{t('newest')}</SelectItem>
                          <SelectItem value="oldest">{t('oldest')}</SelectItem>
                          <SelectItem value="budget">{t('budget')}</SelectItem>
                          <SelectItem value="deadline">{t('deadline')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t('showingResults', { count: filteredOpportunities.length })}
                    </p>
                    <Button variant="ghost" onClick={clearFilters}>
                      {t('clearFilters')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

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
            {filteredOpportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                entity={entities[opportunity.organizationId]}
                isOptimistic={opportunity.isOptimistic}
                isPending={opportunity.isPending}
              />
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {filteredOpportunities.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noOpportunities')}</h3>
              <p className="text-muted-foreground mb-4">{t('noOpportunitiesDescription')}</p>
              <Link href="/opportunities/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirstOpportunity')}
                </Button>
              </Link>
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
          {!loading && lastVisible && (
            <div ref={ref} className="h-10" />
          )}
        </div>
      </div>
    </div>
  )
}

// Individual Opportunity Card Component
interface OpportunityCardProps {
  opportunity: OptimisticOpportunity
  entity: Entity | undefined
  isOptimistic?: boolean
  isPending?: boolean
}

function OpportunityCard({ 
  opportunity, 
  entity, 
  isOptimistic = false, 
  isPending = false 
}: OpportunityCardProps) {
  const t = useTranslations('modules.opportunities')
  // Ensure we always pass a defined translation key
  const typeKey = opportunity?.type === 'request' ? 'request' : 'offer'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isOptimistic ? 0.7 : 1, 
        y: 0,
        scale: isPending ? 0.98 : 1
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.3,
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      className="mb-6"
    >
      <Card className={`relative overflow-hidden ${
        isOptimistic ? 'border-primary/50 bg-primary/5' : ''
      } ${isPending ? 'border-dashed' : ''}`}>
        {/* Optimistic Indicator */}
        {isOptimistic && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="secondary" className="flex items-center gap-1">
              {isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('posting')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  {t('posted')}
                </>
              )}
            </Badge>
          </div>
        )}

        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="relative">
              <Image
                src={entity?.logo || '/placeholder.svg'}
                alt={entity?.name || 'Company logo'}
                width={40}
                height={40}
                className={`rounded-full mr-3 ${isOptimistic ? 'opacity-70' : ''}`}
              />
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{entity?.name || t('loadingEntity')}</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{opportunity.location}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={opportunity.type === 'offer' ? 'default' : 'secondary'}>
                {t(typeKey)}
              </Badge>
              {opportunity.isConfidential && (
                <Badge variant="destructive">{t('confidential')}</Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <h3 className="text-xl font-semibold mb-2">{opportunity.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {truncateDescription(opportunity.briefDescription)}
          </p>

          {/* Details Grid */}
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
              <span>{formatTimestampOrFieldValue(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2" />
              <span>{formatTimestampOrFieldValue(opportunity.dateCreated)}</span>
            </div>
          </div>

          {/* Budget */}
          {opportunity.budget && (
            <div className="flex items-center text-sm mb-4">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>{formatBudget(opportunity.budget)}</span>
            </div>
          )}

          {/* Tags */}
          {opportunity.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Tag className="w-4 h-4 mr-2" />
              {opportunity.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {opportunity.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{opportunity.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Action Button */}
          <Link href={`/opportunities/${opportunity.id}`} passHref>
            <Button 
              className="w-full" 
              disabled={isPending}
              variant={isOptimistic ? "outline" : "default"}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('viewDetails')
              )}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
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