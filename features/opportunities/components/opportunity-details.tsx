'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession, SessionProvider } from 'next-auth/react'
import { SerializedOpportunity, OpportunityVisibility } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'

import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { useTranslations } from 'next-intl'
import { getOpportunityById } from '@/features/opportunities/services'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { useRealtimeOpportunities } from '@/hooks/use-realtime-opportunities'
import {
  Calendar,
  MapPin,
  Tag,
  Building,
  User,
  DollarSign,
  Clock,
  Timer,
  Users,
  BadgeCheck,
  AlertTriangle,
  MessageCircle,
  Wallet,
  Coins,
  Briefcase,
  HandHeart,
  GraduationCap,
  Package,
  Calendar as CalendarIcon,
  CheckCircle2,
  ArrowLeft,
  Share,
  Bookmark,
  BookmarkCheck,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDateValue, formatBudget } from '@/lib/utils'

/**
 * Represents an attachment for an opportunity
 * @typedef {Object} Attachment
 * @property {string} url - The URL of the attachment
 * @property {string} name - The name of the attachment
 */
interface Attachment {
  url: string;
  name: string;
}

/**
 * Props for the opportunity-details component
 * @typedef {Object} OpportunityDetailsProps
 * @property {Opportunity} initialOpportunity - The initial opportunity data
 * @property {Entity | null} initialEntity - The initial entity data (can be null)
 * @property {string | null} initialError - Any initial error message (can be null)
 */
export interface OpportunityDetailsProps {
  initialOpportunity: SerializedOpportunity & {
    attachments?: Attachment[];
    visibility: OpportunityVisibility;
    expirationDate: string;
  };
  initialEntity: SerializedEntity | null;
  initialError: string | null;
}

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
      icon: Users,
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

/**
 * OpportunityDetailsContent component
 * Renders the details of an opportunity with enhanced features
 *
 * User steps:
 * 1. User views the opportunity details
 * 2. If not logged in, user is prompted to log in
 * 3. If logged in, user sees opportunity details based on their role
 * 4. Confidential information is only shown to users with appropriate roles
 * 5. Enhanced features include real-time updates, RING integration, and better UX
 *
 * @param {OpportunityDetailsProps} props - The component props
 * @returns {React.ReactElement} The rendered opportunity details
 */
const OpportunityDetailsContent: React.FC<OpportunityDetailsProps> = ({
  initialOpportunity,
  initialEntity,
  initialError
}) => {
  const { data: session, status } = useSession()
  const t = useTranslations('modules.opportunities')
  const { balance: ringBalance } = useCreditBalance()

  // Real-time updates
  const realtime = useRealtimeOpportunities({
    autoConnect: true,
    debug: false
  })

  const [opportunity, setOpportunity] = useState(initialOpportunity)
  const [isBookmarked, setIsBookmarked] = useState(false)

  // Update opportunity when real-time updates come in
  useEffect(() => {
    const handleUpdate = (event: CustomEvent) => {
      const update = event.detail
      if (update.opportunityId === opportunity.id) {
        if (update.type === 'updated' || update.type === 'application_count_changed') {
          setOpportunity(prev => ({ ...prev, ...update.data }))
        }
      }
    }

    window.addEventListener('opportunity-update', handleUpdate)
    return () => window.removeEventListener('opportunity-update', handleUpdate)
  }, [opportunity.id])

  const isConfidential = opportunity.visibility === 'confidential' as OpportunityVisibility

  if (status === 'loading') {
    return <div>{t('loading')}</div>
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

  const userRole = session.user?.role || 'subscriber'
  const canViewConfidential = userRole === 'confidential' || userRole === 'admin'

  if (isConfidential && !canViewConfidential) {
    return <div>{t('noPermission')}</div>
  }

  if (initialError) {
    return <div className="text-red-500">{initialError}</div>
  }

  // Get type configuration for visual styling
  const typeConfig = getOpportunityTypeConfig(opportunity.type)
  const TypeIcon = typeConfig.icon

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

  // Check entity verification status
  const isEntityVerified = initialEntity?.storeVerification?.identityVerified || false
  const entityTrustScore = initialEntity?.storeMetrics?.trustScore || 0

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

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link href="/opportunities">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('backToOpportunities')}
            </Button>
          </Link>
        </div>

        {/* Main Opportunity Card */}
        <Card className={`relative overflow-hidden mb-6 ${typeConfig.borderColor} ${typeConfig.bgColor}`}>
          {/* Type indicator stripe */}
          <div className={`absolute top-0 left-0 w-1 h-full ${typeConfig.color}`} />

          <CardHeader className="pb-4">
            {/* Header with type badge and actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Type Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${typeConfig.color}`}>
                  <TypeIcon className="h-6 w-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title and type */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-sm ${typeConfig.textColor}`}>
                      <TypeIcon className="h-4 w-4 mr-1" />
                      {t(opportunity.type)}
                    </Badge>

                    {opportunity.priority && opportunity.priority !== 'normal' && (
                      <Badge variant={opportunity.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {opportunity.priority}
                      </Badge>
                    )}

                    {getDeadlineCountdown() === 'Today' && (
                      <Badge variant="destructive" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Deadline Today
                      </Badge>
                    )}

                    {isConfidential && (
                      <Badge variant="destructive" className="text-xs">{t('confidential')}</Badge>
                    )}
                  </div>

                  <h1 className="text-2xl font-bold mb-2">{opportunity.title}</h1>

                  {/* Creator info */}
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {initialEntity ? initialEntity.name : t('privateUser')}
                    </span>

                    {/* RING Balance */}
                    {ringBalance && session?.user && (
                      <div className="flex items-center text-xs text-muted-foreground ml-auto">
                        <Coins className="w-3 h-3 mr-1" />
                        <span>{ringBalance.amount} RING</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsBookmarked(!isBookmarked)}>
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm">
                  <Share className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Brief Description */}
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              {opportunity.briefDescription}
            </p>

            {/* Enhanced Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Deadline Countdown */}
              {getDeadlineCountdown() && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Timer className={`w-5 h-5 ${getDeadlineCountdown() === 'Expired' ? 'text-red-500' :
                    getDeadlineCountdown() === 'Today' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <div>
                    <div className="text-sm font-medium">Deadline</div>
                    <div className={`text-sm ${getDeadlineCountdown() === 'Expired' ? 'text-red-500' :
                      getDeadlineCountdown() === 'Today' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                      {getDeadlineCountdown()}
                    </div>
                  </div>
                </div>
              )}

              {/* Applicant Count */}
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Applicants</div>
                  <div className="text-sm text-muted-foreground">
                    {opportunity.applicantCount || 0} applied
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Location</div>
                  <div className="text-sm text-muted-foreground">
                    {opportunity.location}
                  </div>
                </div>
              </div>
            </div>

            {/* Budget */}
            {opportunity.budget && (
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  <div>
                    <div className="text-sm font-medium">Budget</div>
                    <div className="text-sm text-muted-foreground">
                      {formatBudget(opportunity.budget)}
                    </div>
                  </div>
                </div>

                {/* RING equivalent */}
                {opportunity.budget.currency === 'USD' && (
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">
                      ≈ {String(Math.round(opportunity.budget.max / 12))} RING
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Entity Information - Only show if entity exists */}
            {initialEntity && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Organization Details
                </h3>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-start gap-4">
                    {initialEntity.logo && (
                      <img
                        src={initialEntity.logo}
                        alt={initialEntity.name}
                        className="w-12 h-12 rounded-full flex-shrink-0"
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{initialEntity.name}</h4>

                        {/* Verification badges */}
                        {isEntityVerified && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3 text-green-500" />
                            Verified
                          </Badge>
                        )}

                        {entityTrustScore > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Trust: {entityTrustScore}/100
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {initialEntity.shortDescription}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Type: {initialEntity.type}</span>
                        <span>Location: {initialEntity.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Description */}
            {opportunity.fullDescription && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Full Description</h3>
                <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                  {opportunity.fullDescription}
                </div>
              </div>
            )}

            {/* Tags */}
            {opportunity.tags && opportunity.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {opportunity.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Required Skills */}
            {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {opportunity.requiredSkills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            {opportunity.attachments && opportunity.attachments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Attachments</h3>
                <div className="space-y-2">
                  {opportunity.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex-1"
                      >
                        {attachment.name}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
              <Button className="flex-1" size="lg">
                Apply Now
              </Button>

              {/* Quick Actions */}
              <div className="flex gap-2">
                {session?.user && (
                  <Button variant="outline" size="lg">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                )}

                {opportunity.budget && ringBalance && (
                  <Button variant="outline" size="lg">
                    <Wallet className="w-4 h-4 mr-2" />
                    Pay with RING
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confidential Information */}
        {isConfidential && canViewConfidential && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="w-5 h-5" />
                {t('confidentialInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-yellow-700 dark:text-yellow-300">
                {t('confidentialInformationDescription')}
              </p>
              {/* Add confidential information here */}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/**
 * opportunity-details component
 * Wraps the OpportunityDetailsContent with SessionProvider
 * 
 * @param {OpportunityDetailsProps} props - The component props
 * @returns {React.ReactElement} The wrapped opportunity details component
 */
const OpportunityDetails: React.FC<OpportunityDetailsProps> = (props) => {
  return (
    <SessionProvider>
      <OpportunityDetailsContent {...props} />
    </SessionProvider>
  )
}

export default OpportunityDetails

