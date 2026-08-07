'use client'

import React, { useState, useEffect, useTransition, useRef } from 'react'
import { useSession, SessionProvider } from 'next-auth/react'
import { hasConfidentialAccess, resolveSessionUserRole } from '@/features/auth/user-role'
import { SerializedOpportunity, OpportunityVisibility } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'

import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { useTranslations } from 'next-intl'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useRealtimeOpportunities, useOpportunityUpdates } from '@/hooks/use-realtime-opportunities'
import {
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
  Wallet,
  Coins,
  ArrowLeft,
  Share,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatBudget } from '@/lib/utils'
import { useLocale } from 'next-intl'
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import type { Locale } from '@/i18n/shared'
import { Loader2 } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { getOpportunityFeedTypeTone } from '@/features/opportunities/lib/opportunity-feed-type-tone'
import { CollectiveOrderSlotPanel } from '@/features/opportunities/components/collective-order-slot-panel'
import { ScheduledServicesBookPanel } from '@/features/opportunities/components/scheduled-services-book-panel'

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

/**
 * OpportunityDetailsContent — details page with feed-tone SSOT + i18n chrome.
 */
const OpportunityDetailsContent: React.FC<OpportunityDetailsProps> = ({
  initialOpportunity,
  initialEntity,
  initialError
}) => {
  const { data: session, status } = useSession()
  const t = useTranslations('modules.opportunities')
  const locale = useLocale() as Locale
  const router = useRouter()
  const { balance: tokenBalance } = useCreditBalanceContext()
  const [requestPending, startRequest] = useTransition()
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  // Real-time updates
  const realtime = useRealtimeOpportunities({
    autoConnect: true,
    debug: false
  })

  const [opportunity, setOpportunity] = useState(initialOpportunity)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const opportunityIdRef = useRef(opportunity.id)
  opportunityIdRef.current = opportunity.id

  useEffect(() => {
    const applicants = opportunity.applicants
    const uid = session?.user?.id
    if (uid && Array.isArray(applicants)) {
      setRequested(applicants.map(String).includes(uid))
    }
  }, [opportunity.applicants, session?.user?.id])

  useOpportunityUpdates((update) => {
    if (update.opportunityId !== opportunityIdRef.current) return
    if (update.type === 'deleted') {
      router.push(ROUTES.OPPORTUNITIES(locale))
      return
    }
    if (
      (update.type === 'updated' || update.type === 'application_count_changed') &&
      update.data
    ) {
      setOpportunity((prev) => ({ ...prev, ...update.data }))
      return
    }
    if (update.type === 'updated') {
      // No snippet — soft refresh App Router payload
      router.refresh()
    }
  })

  const projectOrderId = (opportunity as { projectOrderId?: string }).projectOrderId
  const canRequestProjectJob =
    String(opportunity.type || '').toLowerCase() === 'ring_customization' &&
    Boolean(projectOrderId) &&
    (opportunity as { isActive?: boolean }).isActive !== false &&
    String((opportunity as { status?: string }).status || 'active').toLowerCase() !== 'closed'

  const isConfidential = opportunity.visibility === 'confidential' as OpportunityVisibility

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (!session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-12">
        <div className="max-w-md w-full">
          <UnifiedLoginInline variant="hero" />
        </div>
      </div>
    )
  }

  const userRole = resolveSessionUserRole(session.user?.role)
  const canViewConfidential = hasConfidentialAccess(userRole)

  if (isConfidential && !canViewConfidential) {
    return <div>{t('noPermission')}</div>
  }

  if (initialError) {
    return <div className="text-red-500">{initialError}</div>
  }

  const typeConfig = getOpportunityFeedTypeTone(opportunity.type)
  const TypeIcon = typeConfig.icon
  const typeLabel = (() => {
    const typeKey = String(opportunity.type || 'offer')
    if (t.has(typeKey as 'offer')) return t(typeKey as 'offer')
    if (t.has(`types.${typeKey}.title` as 'types.offer.title')) {
      return t(`types.${typeKey}.title` as 'types.offer.title')
    }
    return typeKey
  })()

  const getDeadlineCountdownKey = ():
    | 'deadlineExpired'
    | 'deadlineToday'
    | 'deadlineTomorrow'
    | { key: 'deadlineDays'; days: number }
    | { key: 'deadlineWeeks'; weeks: number }
    | { key: 'deadlineMonths'; months: number }
    | null => {
    if (!opportunity.applicationDeadline) return null
    const deadline = new Date(opportunity.applicationDeadline)
    const diffTime = deadline.getTime() - Date.now()
    if (diffTime <= 0) return 'deadlineExpired'
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'deadlineToday'
    if (diffDays === 1) return 'deadlineTomorrow'
    if (diffDays < 7) return { key: 'deadlineDays', days: diffDays }
    if (diffDays < 30) return { key: 'deadlineWeeks', weeks: Math.ceil(diffDays / 7) }
    return { key: 'deadlineMonths', months: Math.ceil(diffDays / 30) }
  }

  const deadlineCountdown = getDeadlineCountdownKey()
  const deadlineCountdownLabel = (() => {
    if (!deadlineCountdown) return null
    if (typeof deadlineCountdown === 'string') return t(deadlineCountdown)
    if (deadlineCountdown.key === 'deadlineDays') {
      return t('deadlineDays', { days: deadlineCountdown.days })
    }
    if (deadlineCountdown.key === 'deadlineWeeks') {
      return t('deadlineWeeks', { weeks: deadlineCountdown.weeks })
    }
    return t('deadlineMonths', { months: deadlineCountdown.months })
  })()
  const isDeadlineToday = deadlineCountdown === 'deadlineToday'
  const isDeadlineExpired = deadlineCountdown === 'deadlineExpired'

  // Check entity verification status
  const isEntityVerified = initialEntity?.storeVerification?.identityVerified || false
  const entityTrustScore = initialEntity?.storeMetrics?.trustScore || 0

  return (
    <div className="min-h-full text-foreground">
      {/* Real-time Status Indicator */}
      <div className="bg-background border-b">
        <div className="mx-auto py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                realtime.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {realtime.isConnected ? t('liveUpdatesActive') : t('offlineMode')}
              </span>
              {realtime.lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  • {t('lastUpdate', { time: realtime.lastUpdate.toLocaleTimeString() })}
                </span>
              )}
            </div>
            {realtime.provider && (
              <span className="text-xs text-muted-foreground">
                {t('viaProvider', { provider: realtime.provider })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link href={ROUTES.OPPORTUNITIES(locale)}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('backToOpportunities')}
            </Button>
          </Link>
        </div>

        {/* Main Opportunity Card */}
        <Card className={`relative overflow-hidden mb-6 ${typeConfig.borderColor} ${typeConfig.bgColor}`}>
          {/* Type indicator stripe */}
          <div className={`absolute top-0 left-0 w-1 h-full ${typeConfig.solidColor}`} />

          <CardHeader className="pb-4">
            {/* Header with type badge and actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Type Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${typeConfig.solidColor}`}>
                  <TypeIcon className="h-6 w-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title and type */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-sm ${typeConfig.textColor}`}>
                      <TypeIcon className="h-4 w-4 mr-1" />
                      {typeLabel}
                    </Badge>

                    {opportunity.priority && opportunity.priority !== 'normal' && (
                      <Badge variant={opportunity.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {opportunity.priority === 'urgent' ? t('priorityUrgent') : t('priorityLow')}
                      </Badge>
                    )}

                    {isDeadlineToday && (
                      <Badge variant="destructive" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {t('deadlineTodayBadge')}
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
                    {tokenBalance && session?.user && (
                      <div className="flex items-center text-xs text-muted-foreground ml-auto">
                        <Coins className="w-3 h-3 mr-1" />
                        <span>{tokenBalance.amount} RING</span>
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
              {deadlineCountdownLabel && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Timer className={`w-5 h-5 ${isDeadlineExpired ? 'text-red-500' :
                    isDeadlineToday ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <div>
                    <div className="text-sm font-medium">{t('deadline')}</div>
                    <div className={`text-sm ${isDeadlineExpired ? 'text-red-500' :
                      isDeadlineToday ? 'text-orange-500' : 'text-muted-foreground'}`}>
                      {deadlineCountdownLabel}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{t('applicants')}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('applicantsApplied', { count: opportunity.applicantCount || 0 })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{t('location')}</div>
                  <div className="text-sm text-muted-foreground">
                    {opportunity.location}
                  </div>
                </div>
              </div>
            </div>

            {opportunity.budget && (
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  <div>
                    <div className="text-sm font-medium">{t('budget')}</div>
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

            {initialEntity && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  {t('organizationDetails')}
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

                        {isEntityVerified && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3 text-green-500" />
                            {t('verified')}
                          </Badge>
                        )}

                        {entityTrustScore > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {t('trustScore', { score: entityTrustScore })}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {initialEntity.shortDescription}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{t('type')}: {initialEntity.type}</span>
                        <span>{t('location')}: {initialEntity.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {opportunity.fullDescription && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t('fullDescription')}</h3>
                <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                  {opportunity.fullDescription}
                </div>
              </div>
            )}

            {opportunity.tags && opportunity.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t('tags')}</h3>
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

            {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t('requiredSkills')}</h3>
                <div className="flex flex-wrap gap-2">
                  {opportunity.requiredSkills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {opportunity.type === 'collective_order' ? (
              <CollectiveOrderSlotPanel
                opportunity={opportunity}
                onOpportunityPatch={(patch) =>
                  setOpportunity((prev) => ({ ...prev, ...patch }))
                }
              />
            ) : null}

            {opportunity.type === 'scheduled_services' ? (
              <ScheduledServicesBookPanel
                opportunity={opportunity}
                onBooked={() => setRequested(true)}
                alreadyRequested={requested}
              />
            ) : null}

            {opportunity.attachments && opportunity.attachments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t('attachments')}</h3>
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

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
              {canRequestProjectJob ? (
                <div className="flex-1 space-y-2">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={requestPending || requested}
                    onClick={() => {
                      setRequestError(null)
                      startRequest(async () => {
                        try {
                          const res = await fetch(`/api/opportunities/${opportunity.id}/request`, {
                            method: 'POST',
                          })
                          const json = await res.json()
                          if (!res.ok) throw new Error(json.error || t('requestFailed'))
                          setRequested(true)
                          setOpportunity((prev) => ({
                            ...prev,
                            applicantCount: json.applicantCount ?? (prev.applicantCount || 0) + 1,
                          }))
                        } catch (e) {
                          setRequestError(e instanceof Error ? e.message : t('requestFailed'))
                        }
                      })
                    }}
                  >
                    {requestPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {requested ? t('requested') : t('requestAction')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('requestProjectOrderHint', {
                      defaultValue:
                        'Integrate this Ring customization — overlay playbook is in the description.',
                    })}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                {session?.user &&
                  (opportunity.contactInfo?.contactAccount || opportunity.createdBy) && (
                    <MessageUserButton
                      locale={locale}
                      targetUserId={
                        opportunity.contactInfo?.contactAccount || opportunity.createdBy
                      }
                      targetUserName={opportunity.title}
                    />
                  )}
              </div>
            </div>
            {requestError ? (
              <p className="mt-2 text-sm text-destructive">{requestError}</p>
            ) : null}
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

