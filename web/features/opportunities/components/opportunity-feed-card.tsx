'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import {
  BadgeCheck,
  Building,
  Calendar,
  Clock,
  Coins,
  DollarSign,
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  Tag,
  ThumbsDown,
  Timer,
  Trash2,
  User,
  Users,
  Bookmark,
} from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { SerializedOpportunity } from '@/features/opportunities/types'
import type { Entity } from '@/features/entities/types'
import { getOpportunityFeedTypeTone } from '@/features/opportunities/lib/opportunity-feed-type-tone'
import { formatBudget, formatDateValue, truncateDescription } from '@/lib/utils'
import {
  markOpportunityNotInterested,
  recordOpportunityContactIntent,
  toggleOpportunityLike,
  toggleOpportunitySave,
} from '@/app/_actions/opportunity-interactions'
import { cn } from '@/lib/utils'

export type OpportunityFeedCardMode = 'browse' | 'owner'

export interface OpportunityFeedCardProps {
  opportunity: SerializedOpportunity & {
    isOptimistic?: boolean
    isPending?: boolean
  }
  entity?: Entity | null
  locale?: Locale
  mode?: OpportunityFeedCardMode
  isOptimistic?: boolean
  isPending?: boolean
  onDelete?: (opportunity: SerializedOpportunity) => void
  showDelete?: boolean
  statusLabel?: string
  statusClassName?: string
}

type InteractionFlags = {
  liked: boolean
  saved: boolean
  hidden: boolean
  likeCount: number
}

export function OpportunityFeedCard({
  opportunity,
  entity,
  locale = 'en',
  mode = 'browse',
  isOptimistic = false,
  isPending = false,
  onDelete,
  showDelete = false,
  statusLabel,
  statusClassName,
}: OpportunityFeedCardProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session } = useSession()
  const { balance: tokenBalance } = useCreditBalanceContext()
  const [, startTransition] = useTransition()

  const [flags, setOptimisticFlags] = useOptimistic<InteractionFlags, Partial<InteractionFlags>>(
    {
      liked: false,
      saved: false,
      hidden: false,
      likeCount: Number((opportunity as { likes?: number }).likes || 0),
    },
    (state, patch) => ({ ...state, ...patch }),
  )

  const tone = getOpportunityFeedTypeTone(String(opportunity.type || 'offer'))
  const TypeIcon = tone.icon
  const isExpired = opportunity.expirationDate && new Date(opportunity.expirationDate) < new Date()
  const isDeadlineSoon =
    opportunity.applicationDeadline &&
    new Date(opportunity.applicationDeadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const getTypeTranslation = (type: string) => {
    const typeMap: Record<string, string> = {
      offer: t('offer'),
      request: t('request'),
      partnership: t('partnership'),
      volunteer: t('volunteer'),
      mentorship: t('mentorship'),
      resource: t('resource'),
      event: t('event'),
    }
    return typeMap[type] || type
  }

  const getDeadlineCountdown = () => {
    if (!opportunity.applicationDeadline) return null
    const deadline = new Date(opportunity.applicationDeadline)
    const diffTime = deadline.getTime() - Date.now()
    if (diffTime <= 0) return 'Expired'
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return `${diffDays} days`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`
    return `${Math.ceil(diffDays / 30)} months`
  }

  const isEntityVerified = Boolean(entity?.storeVerification?.identityVerified)
  const entityTrustScore = entity?.storeMetrics?.trustScore || 0
  const deadlineLabel = getDeadlineCountdown()

  function runInteraction(
    patch: Partial<InteractionFlags>,
    action: () => Promise<{ success?: boolean; error?: string; isLiked?: boolean; newCount?: number; active?: boolean }>,
  ) {
    if (!session?.user) return
    startTransition(async () => {
      setOptimisticFlags(patch)
      const result = await action()
      if (!result.success) {
        setOptimisticFlags({})
      } else if (typeof result.isLiked === 'boolean') {
        setOptimisticFlags({
          liked: result.isLiked,
          likeCount: result.newCount ?? flags.likeCount,
        })
      } else if (typeof result.active === 'boolean' && 'saved' in patch) {
        setOptimisticFlags({ saved: result.active })
      } else if (typeof result.active === 'boolean' && 'hidden' in patch) {
        setOptimisticFlags({ hidden: result.active })
      }
    })
  }

  if (flags.hidden && mode === 'browse') {
    return null
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isOptimistic ? 0.7 : 1,
        y: 0,
        scale: isPending ? 0.98 : 1,
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
      className="mb-6"
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
          isOptimistic ? 'border-primary/50 bg-primary/5' : `${tone.borderColor} ${tone.bgColor}`,
          isPending && 'border-dashed',
          isExpired && 'opacity-60 grayscale',
        )}
      >
        <div className={cn('absolute left-0 top-0 h-full w-1', tone.solidColor)} />
        {isOptimistic ? (
          <div className="absolute right-2 top-2 z-10">
            <Badge variant="secondary" className="flex items-center gap-1">
              {isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('posting')}
                </>
              ) : (
                <>
                  <BadgeCheck className="h-3 w-3" />
                  {t('posted')}
                </>
              )}
            </Badge>
          </div>
        ) : null}

        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', tone.solidColor)}>
                    <TypeIcon className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs', tone.textColor)}>
                    <TypeIcon className="mr-1 h-3 w-3" />
                    {getTypeTranslation(String(opportunity.type))}
                  </Badge>
                  {statusLabel ? (
                    <Badge className={cn('text-xs', statusClassName)}>{statusLabel}</Badge>
                  ) : null}
                  {opportunity.priority && opportunity.priority !== 'normal' ? (
                    <Badge variant={opportunity.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      {opportunity.priority}
                    </Badge>
                  ) : null}
                  {isDeadlineSoon && !isExpired ? (
                    <Badge variant="destructive" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      Deadline Soon
                    </Badge>
                  ) : null}
                  {isExpired ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Expired
                    </Badge>
                  ) : null}
                  {opportunity.isConfidential ? (
                    <Badge variant="destructive" className="text-xs">
                      {t('confidential')}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="mb-1 text-base font-semibold leading-tight">{opportunity.title}</h2>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{entity?.name || t('privateUser')}</p>
                  {tokenBalance && session?.user ? (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Coins className="mr-1 h-3 w-3" />
                      <span>{tokenBalance.amount} RING</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {truncateDescription(opportunity.briefDescription || opportunity.fullDescription || '', 120)}
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center">
              <Building className="mr-2 h-4 w-4" />
              <span>{opportunity.category}</span>
            </div>
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span>{opportunity.createdBy}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              <span>{formatDateValue(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              <span>{formatDateValue(opportunity.dateCreated)}</span>
            </div>
          </div>

          {opportunity.budget ? (
            <div className="mb-4 flex items-center text-sm">
              <DollarSign className="mr-2 h-4 w-4" />
              <span>{formatBudget(opportunity.budget)}</span>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {deadlineLabel ? (
              <div className="flex items-center">
                <Timer className="mr-1 h-3 w-3 text-muted-foreground" />
                <span
                  className={
                    deadlineLabel === 'Expired'
                      ? 'text-red-500'
                      : deadlineLabel === 'Today'
                        ? 'text-orange-500'
                        : 'text-muted-foreground'
                  }
                >
                  {deadlineLabel}
                </span>
              </div>
            ) : null}
            <div className="flex items-center">
              <Users className="mr-1 h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{String(opportunity.applicantCount || 0)} applicants</span>
            </div>
            {isEntityVerified ? (
              <div className="flex items-center">
                <BadgeCheck className="mr-1 h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">Verified</span>
              </div>
            ) : null}
            {entityTrustScore > 0 ? (
              <Badge variant="outline" className="w-fit text-xs">
                Trust: {entityTrustScore}/100
              </Badge>
            ) : null}
          </div>

          {opportunity.tags && opportunity.tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <Tag className="h-4 w-4" />
              {opportunity.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {opportunity.tags.length > 3 ? (
                <Badge variant="outline" className="text-xs">
                  +{opportunity.tags.length - 3}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {mode === 'browse' && session?.user ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={flags.liked ? 'default' : 'outline'}
                onClick={() =>
                  runInteraction({ liked: !flags.liked, likeCount: flags.likeCount + (flags.liked ? -1 : 1) }, async () => {
                    const fd = new FormData()
                    fd.set('opportunityId', opportunity.id)
                    return toggleOpportunityLike(null, fd)
                  })
                }
              >
                <Heart className={cn('mr-1 h-3.5 w-3.5', flags.liked && 'fill-current')} />
                {flags.likeCount > 0 ? flags.likeCount : 'Like'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={flags.saved ? 'default' : 'outline'}
                onClick={() =>
                  runInteraction({ saved: !flags.saved }, async () => {
                    const fd = new FormData()
                    fd.set('opportunityId', opportunity.id)
                    return toggleOpportunitySave(null, fd)
                  })
                }
              >
                <Bookmark className={cn('mr-1 h-3.5 w-3.5', flags.saved && 'fill-current')} />
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  runInteraction({ hidden: true }, async () => {
                    const fd = new FormData()
                    fd.set('opportunityId', opportunity.id)
                    return markOpportunityNotInterested(null, fd)
                  })
                }
              >
                <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                Not interested
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  runInteraction({}, async () => {
                    const fd = new FormData()
                    fd.set('opportunityId', opportunity.id)
                    return recordOpportunityContactIntent(null, fd)
                  })
                }
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Contact
              </Button>
            </div>
          ) : null}

          {mode === 'owner' ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={ROUTES.OPPORTUNITY_EDIT(opportunity.id, locale)}>
                  <Pencil className="mr-1 h-4 w-4" />
                  {t('status.actions.continueEditing', { defaultValue: 'Edit' })}
                </Link>
              </Button>
              {showDelete && onDelete ? (
                <Button size="sm" variant="destructive" onClick={() => onDelete(opportunity)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t('delete', { defaultValue: 'Delete' })}
                </Button>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link href={ROUTES.OPPORTUNITY(opportunity.id, locale)}>{t('viewDetails')}</Link>
              </Button>
            </div>
          ) : (
            <Button asChild className="w-full" disabled={isPending} variant={isOptimistic ? 'outline' : 'default'}>
              <Link href={ROUTES.OPPORTUNITY(opportunity.id, locale)}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('processing')}
                  </>
                ) : (
                  t('viewDetails')
                )}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
