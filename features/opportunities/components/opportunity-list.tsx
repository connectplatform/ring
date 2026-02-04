'use client'

import React, { useCallback, useEffect, useTransition } from 'react'
import { useOptimistic, useActionState, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCreditBalance } from '@/hooks/use-credit-balance'
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
  Loader2,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  HandHeart,
  Users2,
  GraduationCap,
  Package,
  Calendar as CalendarIcon,
  Star,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  ExternalLink,
  Timer,
  Users,
  BadgeCheck,
  AlertTriangle,
  MessageCircle,
  Wallet,
  Coins
} from 'lucide-react'

import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
import { formatDateValue, truncateDescription, formatBudget } from '@/lib/utils'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'

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
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const { ref, inView } = useInView()
  const [isPending, startTransitionFn] = useTransition()

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

  // Local state for pagination
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>(initialEntities)
  const [loading, setLoading] = React.useState(false)
  const [lastVisible, setLastVisible] = React.useState<string | null>(initialLastVisible)
  const [error, setError] = React.useState<string | null>(initialError)

  // Sync entities when parent-provided initialEntities change
  useEffect(() => {
    setEntities(initialEntities)
  }, [initialEntities])

  // Server action state for opportunity creation
  const [createState, createAction] = useActionState<OpportunityFormState | null, FormData>(
    createOpportunity,
    null
  )

  // Use optimistic opportunities directly (filtering moved to wrapper)
  const displayOpportunities = optimisticOpportunities

  // Fetch more opportunities for infinite scroll
  const fetchMoreOpportunities = useCallback(async () => {
    if (loading || !lastVisible || !session) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        startAfter: lastVisible
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
      const newOpportunities = data.opportunities.filter((opp: SerializedOpportunity) => 
        !optimisticOpportunities.some(existing => existing.id === opp.id)
      )
      
      startTransition(() => {
        newOpportunities.forEach((opp: SerializedOpportunity) => addOptimisticOpportunity(opp))
      })
      setLastVisible(data.lastVisible)

      // Fetch entities for new opportunities - with deduplication
      // Filter out null, empty, or already loaded entities
      const uniqueEntityIds = [...new Set(newOpportunities
        .map((opp: SerializedOpportunity) => opp.organizationId)
        .filter(id => id && id.trim() !== '' && !entities[id]))]

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
  }, [loading, lastVisible, limit, session, t, optimisticOpportunities, entities, addOptimisticOpportunity])

  // Trigger infinite scroll
  useEffect(() => {
    if (inView && !loading) {
      fetchMoreOpportunities()
    }
  }, [inView, fetchMoreOpportunities, loading])

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
    <div className="min-h-screen bg-background dark:bg-[hsl(var(--page-background))] text-foreground">
      <div className="container mx-auto px-0 py-0">



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
          {!loading && lastVisible && (
            <div ref={ref} className="h-10" />
          )}
        </div>
      </div>
    </div>
  )
}

// Individual Opportunity Card Component
// Opportunity type configuration for visual indicators
const getOpportunityTypeConfig = (type: string) => {
  const configs = {
    offer: {
      icon: Briefcase,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-700 dark:text-blue-300'
    },
    request: {
      icon: HandHeart,
      color: 'bg-green-500', 
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-300'
    },
    partnership: {
      icon: Users2,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20', 
      borderColor: 'border-purple-200 dark:border-purple-800',
      textColor: 'text-purple-700 dark:text-purple-300'
    },
    volunteer: {
      icon: HandHeart,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800', 
      textColor: 'text-orange-700 dark:text-orange-300'
    },
    mentorship: {
      icon: GraduationCap,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
      textColor: 'text-indigo-700 dark:text-indigo-300'
    },
    resource: {
      icon: Package,
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/20',
      borderColor: 'border-teal-200 dark:border-teal-800',
      textColor: 'text-teal-700 dark:text-teal-300'
    },
    event: {
      icon: CalendarIcon,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50 dark:bg-pink-950/20',
      borderColor: 'border-pink-200 dark:border-pink-800',
      textColor: 'text-pink-700 dark:text-pink-300'
    }
  }
  
  return configs[type as keyof typeof configs] || configs.offer
}

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
  const { data: session } = useSession()
  const { balance: ringBalance } = useCreditBalance()

  // Ensure we always pass a defined translation key
  const typeKey = opportunity?.type === 'request' ? 'request' : 'offer'

  // Get translated type name
  const getTypeTranslation = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'offer': t('offer'),
      'request': t('request'),
      'partnership': t('partnership'),
      'volunteer': t('volunteer'),
      'mentorship': t('mentorship'),
      'resource': t('resource'),
      'event': t('event')
    }
    return typeMap[type] || type
  }

  // Get type configuration for visual styling
  const typeConfig = getOpportunityTypeConfig(opportunity.type)
  const TypeIcon = typeConfig.icon

  // Check if opportunity is expired or has urgent deadline
  const isExpired = opportunity.expirationDate && new Date(opportunity.expirationDate) < new Date()
  const isDeadlineSoon = opportunity.applicationDeadline &&
    new Date(opportunity.applicationDeadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Calculate deadline countdown
  const getDeadlineCountdown = () => {
    if (!opportunity.applicationDeadline) return null

    const deadline = new Date(opportunity.applicationDeadline)
    const now = new Date()
    const diffTime = deadline.getTime() - now.getTime()

    if (diffTime <= 0) return 'Expired'

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return `${diffDays} days`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`

    return `${Math.ceil(diffDays / 30)} months`
  }

  // Calculate skill match percentage (placeholder - would need user profile)
  const getSkillMatch = () => {
    // This would be calculated based on user's skills vs required skills
    // For now, return a random percentage for demonstration
    if (!opportunity.requiredSkills || opportunity.requiredSkills.length === 0) return null
    return Math.floor(Math.random() * 100) // Placeholder
  }

  // Check entity verification status
  const isEntityVerified = entity?.storeVerification?.identityVerified || false
  const entityTrustScore = entity?.storeMetrics?.trustScore || 0

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
      <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isOptimistic ? 'border-primary/50 bg-primary/5' : typeConfig.borderColor + ' ' + typeConfig.bgColor
      } ${isPending ? 'border-dashed' : ''} ${isExpired ? 'opacity-60 grayscale' : ''}`}>
        {/* Type indicator stripe */}
        <div className={`absolute top-0 left-0 w-1 h-full ${typeConfig.color}`} />
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
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Entity logo or type icon */}
              <div className="relative flex-shrink-0">
                {entity ? (
                  <Image
                    src={entity.logo || '/placeholder.svg'}
                    alt={entity.name || 'Organization logo'}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeConfig.color}`}>
                    <TypeIcon className="h-5 w-5 text-white" />
                  </div>
                )}
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                    <Loader2 className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${typeConfig.textColor}`}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {getTypeTranslation(opportunity.type)}
                  </Badge>
                  
                  {opportunity.priority && opportunity.priority !== 'normal' && (
                    <Badge variant={opportunity.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {opportunity.priority}
                    </Badge>
                  )}
                  
                  {isDeadlineSoon && !isExpired && (
                    <Badge variant="destructive" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Deadline Soon
                    </Badge>
                  )}
                  
                  {isExpired && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Expired
                    </Badge>
                  )}
                  
                  {opportunity.isConfidential && (
                    <Badge variant="destructive" className="text-xs">{t('confidential')}</Badge>
                  )}
                </div>
                
                <h2 className="font-semibold text-base leading-tight mb-1 group-hover:text-primary transition-colors">
                  {opportunity.title}
                </h2>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {entity?.name || t('privateUser')}
                  </p>

                  {/* RING Balance Indicator */}
                  {ringBalance && session?.user && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Coins className="w-3 h-3 mr-1" />
                      <span>{ringBalance.amount} RING</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {truncateDescription(opportunity.briefDescription || opportunity.fullDescription || '', 120)}
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
              <span>{formatDateValue(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2" />
              <span>{formatDateValue(opportunity.dateCreated)}</span>
            </div>
          </div>

          {/* Budget with RING Token Display */}
          {opportunity.budget && (
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                <span>{formatBudget(opportunity.budget)}</span>
              </div>

              {/* Show RING token equivalent if budget is in USD */}
              {opportunity.budget.currency === 'USD' && opportunity.budget.max && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Wallet className="w-3 h-3 mr-1" />
                  <span>≈ {String(Math.round(opportunity.budget.max / 12))} RING</span>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Information Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Deadline Countdown */}
            {getDeadlineCountdown() && (
              <div className="flex items-center text-xs">
                <Timer className="w-3 h-3 mr-1 text-muted-foreground" />
                <span className={getDeadlineCountdown() === 'Expired' ? 'text-red-500' :
                  getDeadlineCountdown() === 'Today' ? 'text-orange-500' : 'text-muted-foreground'}>
                  {getDeadlineCountdown()}
                </span>
              </div>
            )}

            {/* Applicant Count */}
            <div className="flex items-center text-xs">
              <Users className="w-3 h-3 mr-1 text-muted-foreground" />
              <span className="text-muted-foreground">
                {String(opportunity.applicantCount || 0)} applicants
              </span>
            </div>

            {/* Skill Match */}
            {getSkillMatch() !== null && (
              <div className="flex items-center text-xs">
                <BadgeCheck className="w-3 h-3 mr-1 text-green-500" />
                <span className="text-green-600">
                  {getSkillMatch()}% match
                </span>
              </div>
            )}
          </div>

          {/* Entity Verification & Trust Score */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isEntityVerified && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-green-500" />
                  Verified Entity
                </Badge>
              )}
              {entityTrustScore > 0 && (
                <Badge variant="outline" className="text-xs">
                  Trust: {entityTrustScore}/100
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Quick Message Button */}
              {session?.user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={(e) => {
                    e.preventDefault()
                    // TODO: Open quick messaging modal
                    console.log('Open messaging for opportunity:', opportunity.id)
                  }}
                  title="Quick Message"
                >
                  <MessageCircle className="w-3 h-3" />
                </Button>
              )}

              {/* Wallet Integration */}
              {opportunity.budget && ringBalance && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={(e) => {
                    e.preventDefault()
                    // TODO: Open wallet modal for payment
                    console.log('Open wallet for opportunity payment:', opportunity.id)
                  }}
                  title="Pay with RING tokens"
                >
                  <Wallet className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Tags */}
          {opportunity.tags && opportunity.tags.length > 0 && (
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