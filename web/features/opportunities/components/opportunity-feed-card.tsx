'use client'

import { useEffect, useOptimistic, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useFormatter, useTranslations } from 'next-intl'
import {
  BadgeCheck,
  Bookmark,
  Building,
  Calendar,
  DollarSign,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Tag,
  ThumbsDown,
  Timer,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { OpportunityViewerFlags, SerializedOpportunity } from '@/features/opportunities/types'
import type { Entity } from '@/features/entities/types'
import { getOpportunityFeedTypeTone } from '@/features/opportunities/lib/opportunity-feed-type-tone'
import { splitOpportunityTags } from '@/features/opportunities/lib/opportunity-tags'
import { formatBudget, getInitials } from '@/lib/utils'
import {
  markOpportunityNotInterested,
  recordOpportunityContactIntent,
  toggleOpportunityLike,
  toggleOpportunitySave,
} from '@/app/_actions/opportunity-interactions'
import { cn } from '@/lib/utils'
import {
  hasRoleAtLeast,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'

export type OpportunityFeedCardMode = 'browse' | 'owner'

/** Confirmed (server-acknowledged) interaction delta, so the list can keep its rows in sync. */
export type OpportunityFeedInteractionPatch = {
  viewer?: Partial<OpportunityViewerFlags>
  likes?: number
}

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
  onInteractionChange?: (opportunityId: string, patch: OpportunityFeedInteractionPatch) => void
}

type InteractionFlags = {
  liked: boolean
  saved: boolean
  hidden: boolean
  likeCount: number
}

function flagsFromOpportunity(opportunity: SerializedOpportunity): InteractionFlags {
  return {
    liked: Boolean(opportunity.viewer?.liked),
    saved: Boolean(opportunity.viewer?.saved),
    hidden: Boolean(opportunity.viewer?.hidden),
    likeCount: Number(opportunity.likes || 0),
  }
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
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
  onInteractionChange,
}: OpportunityFeedCardProps) {
  const t = useTranslations('modules.opportunities')
  const format = useFormatter()
  const router = useRouter()
  const { data: session } = useSession()
  const [, startTransition] = useTransition()
  // Stable reference time per mount: avoids next-intl "now" fallback warnings and re-render drift.
  const [now] = useState(() => new Date())

  const [confirmed, setConfirmed] = useState<InteractionFlags>(() => flagsFromOpportunity(opportunity))
  const [flags, setOptimisticFlags] = useOptimistic<InteractionFlags, Partial<InteractionFlags>>(
    confirmed,
    (state, patch) => ({ ...state, ...patch }),
  )

  useEffect(() => {
    setConfirmed((prev) => {
      const next = flagsFromOpportunity(opportunity)
      if (!opportunity.viewer) {
        return { ...prev, likeCount: next.likeCount || prev.likeCount }
      }
      return next
    })
  }, [opportunity.id, opportunity.viewer, opportunity.likes])

  const tone = getOpportunityFeedTypeTone(String(opportunity.type || 'offer'))
  const TypeIcon = tone.icon
  const expirationDate = toDate(opportunity.expirationDate)
  const applicationDeadline = toDate(opportunity.applicationDeadline)
  const isExpired = Boolean(expirationDate && expirationDate < now)
  const isDeadlineSoon = Boolean(
    applicationDeadline &&
      applicationDeadline > now &&
      applicationDeadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000,
  )
  const isOwnPost = Boolean(session?.user?.id && session.user.id === opportunity.createdBy)
  const canContact = Boolean(
    session?.user?.id &&
      !isOwnPost &&
      hasRoleAtLeast(resolveSessionUserRole(session.user.role as string), UserRolesArray.subscriber),
  )

  const getTypeTranslation = (type: string) => {
    const key = type || 'offer'
    return t.has(key) ? t(key) : key
  }

  const getDeadlineCountdown = () => {
    if (!applicationDeadline) return null
    const diffTime = applicationDeadline.getTime() - now.getTime()
    if (diffTime <= 0) return t('deadlineExpired')
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return t('deadlineToday')
    if (diffDays === 1) return t('deadlineTomorrow')
    if (diffDays < 7) return t('deadlineDays', { days: diffDays })
    if (diffDays < 30) return t('deadlineWeeks', { weeks: Math.ceil(diffDays / 7) })
    return t('deadlineMonths', { months: Math.ceil(diffDays / 30) })
  }

  const isEntityVerified = Boolean(entity?.storeVerification?.identityVerified)
  const entityTrustScore = entity?.storeMetrics?.trustScore || 0
  const deadlineLabel = getDeadlineCountdown()
  const { visibleTags, provenance } = splitOpportunityTags(opportunity)
  // Owner-mode rows (My Opportunities) are not creator-enriched; the session user is the creator.
  const creator =
    opportunity.creator ??
    (isOwnPost && session?.user
      ? {
          id: session.user.id,
          name: session.user.name || '',
          avatar: session.user.image || undefined,
        }
      : undefined)
  const creatorName =
    entity?.name || creator?.name || (creator ? t('member') : t('privateUser'))
  const creatorAvatar = entity?.logo || creator?.avatar || null
  const creatorInitials = getInitials(creatorName)
  const profileHref = entity
    ? ROUTES.ENTITY(entity.id, locale)
    : creator?.username
      ? ROUTES.PUBLIC_PROFILE(creator.username, locale)
      : null
  const detailsHref = ROUTES.OPPORTUNITY(opportunity.id, locale)
  const postedLabel = (() => {
    const created = toDate(opportunity.dateCreated)
    if (!created) return null
    try {
      return t('postedAgo', { time: format.relativeTime(created, now) })
    } catch {
      return format.dateTime(created, { dateStyle: 'medium' })
    }
  })()
  const expiresLabel =
    expirationDate && !isExpired && !applicationDeadline
      ? t('expiresOn', { date: format.dateTime(expirationDate, { dateStyle: 'medium' }) })
      : null
  const description = opportunity.briefDescription || opportunity.fullDescription || ''

  function runInteraction(
    patch: Partial<InteractionFlags>,
    action: () => Promise<{
      success?: boolean
      error?: string
      isLiked?: boolean
      newCount?: number
      active?: boolean
    }>,
  ) {
    if (!session?.user) return
    startTransition(async () => {
      setOptimisticFlags(patch)
      const result = await action()
      if (!result.success) return

      // Server-acknowledged delta (falls back to the optimistic patch when the action is silent).
      const delta: Partial<InteractionFlags> =
        typeof result.isLiked === 'boolean'
          ? { liked: result.isLiked, ...(typeof result.newCount === 'number' ? { likeCount: result.newCount } : {}) }
          : typeof result.active === 'boolean' && 'saved' in patch
            ? { saved: result.active }
            : typeof result.active === 'boolean' && 'hidden' in patch
              ? { hidden: result.active }
              : patch

      setConfirmed((prev) => ({ ...prev, ...delta }))

      const { likeCount, ...viewerDelta } = delta
      onInteractionChange?.(opportunity.id, {
        ...(Object.keys(viewerDelta).length > 0 ? { viewer: viewerDelta } : {}),
        ...(typeof likeCount === 'number' ? { likes: likeCount } : {}),
      })
    })
  }

  const statusChips: {
    key: string
    label: string
    className?: string
    variant?: 'default' | 'destructive' | 'secondary' | 'outline'
  }[] = []
  if (opportunity.isConfidential) {
    statusChips.push({ key: 'confidential', label: t('confidential'), variant: 'destructive' })
  }
  if (opportunity.priority && opportunity.priority !== 'normal') {
    statusChips.push({
      key: 'priority',
      label: opportunity.priority === 'urgent' ? t('priorityUrgent') : opportunity.priority,
      variant: opportunity.priority === 'urgent' ? 'destructive' : 'secondary',
    })
  }
  if (isDeadlineSoon && !isExpired) {
    statusChips.push({ key: 'soon', label: t('deadlineSoon'), variant: 'destructive' })
  }
  if (isExpired) {
    statusChips.push({ key: 'expired', label: t('expired'), variant: 'outline' })
  }
  if (statusLabel) {
    // Owner-mode lifecycle chip: caller supplies bg/text classes (parity with the previous default variant).
    statusChips.unshift({ key: 'status', label: statusLabel, className: statusClassName, variant: 'default' })
  }
  const visibleChips = statusChips.slice(0, 2)

  if (flags.hidden && mode === 'browse') {
    return (
      <motion.div layout className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
          <span className="truncate text-sm text-muted-foreground">{t('hiddenFromFeed')}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              runInteraction({ hidden: false }, async () => {
                const fd = new FormData()
                fd.set('opportunityId', opportunity.id)
                return markOpportunityNotInterested(null, fd)
              })
            }
          >
            {t('undo')}
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{
          opacity: isOptimistic ? 0.7 : 1,
          y: 0,
          scale: isPending ? 0.98 : 1,
        }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-3 sm:mb-4"
      >
        <Card
          className={cn(
            'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
            isOptimistic ? 'border-primary/50 bg-primary/5' : `${tone.borderColor} ${tone.bgColor}`,
            isPending && 'border-dashed',
            isExpired && 'opacity-80',
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

          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="shrink-0">
                {creatorAvatar ? (
                  <Avatar src={creatorAvatar} alt={creatorName} size="sm" fallback={creatorInitials} />
                ) : (
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', tone.solidColor)}>
                    <TypeIcon className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn('text-[11px]', tone.textColor)}>
                    <TypeIcon className="mr-1 h-3 w-3" />
                    {getTypeTranslation(String(opportunity.type))}
                  </Badge>
                  {visibleChips.map((chip) => (
                    <Badge key={chip.key} variant={chip.variant ?? 'secondary'} className={cn('text-[11px]', chip.className)}>
                      {chip.label}
                    </Badge>
                  ))}
                </div>
                <h2 className="mb-0.5 line-clamp-2 text-base font-semibold leading-tight">
                  <Link href={detailsHref} className="hover:underline">
                    {opportunity.title}
                  </Link>
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {profileHref ? (
                    <Link href={profileHref} className="inline-flex min-w-0 items-center gap-1 hover:underline">
                      <span className="truncate">{creatorName}</span>
                      {isEntityVerified ? <BadgeCheck className="h-3 w-3 text-green-500" /> : null}
                    </Link>
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <span className="truncate">{creatorName}</span>
                      {isEntityVerified ? <BadgeCheck className="h-3 w-3 text-green-500" /> : null}
                    </span>
                  )}
                  {postedLabel ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{postedLabel}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {description ? (
              <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {opportunity.category ? (
                <span className="inline-flex items-center">
                  <Building className="mr-1 h-3.5 w-3.5" />
                  {opportunity.category}
                </span>
              ) : null}
              {opportunity.location ? (
                <span className="inline-flex items-center">
                  <MapPin className="mr-1 h-3.5 w-3.5" />
                  {opportunity.location}
                </span>
              ) : null}
              {opportunity.budget ? (
                <span className="inline-flex items-center">
                  <DollarSign className="mr-1 h-3.5 w-3.5" />
                  {formatBudget(opportunity.budget)}
                </span>
              ) : null}
              {deadlineLabel ? (
                <span
                  className={cn(
                    'inline-flex items-center',
                    deadlineLabel === t('deadlineExpired')
                      ? 'text-red-500'
                      : deadlineLabel === t('deadlineToday')
                        ? 'text-orange-500'
                        : undefined,
                  )}
                >
                  <Timer className="mr-1 h-3.5 w-3.5" />
                  {deadlineLabel}
                </span>
              ) : expiresLabel ? (
                <span className="inline-flex items-center">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  {expiresLabel}
                </span>
              ) : null}
              <span className="inline-flex items-center">
                <Users className="mr-1 h-3.5 w-3.5" />
                {t('applicantsApplied', { count: Number(opportunity.applicantCount || 0) })}
              </span>
              {entityTrustScore > 0 ? (
                <span className="inline-flex items-center">
                  {t('trustScore', { score: entityTrustScore })}
                </span>
              ) : null}
            </div>

            {visibleTags.length > 0 || (provenance && isOwnPost) ? (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {visibleTags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
                {visibleTags.length > 3 ? (
                  <Badge variant="outline" className="text-[11px]">
                    +{visibleTags.length - 3}
                  </Badge>
                ) : null}
                {provenance && isOwnPost ? (
                  provenance.conversationId ? (
                    <Link
                      href={`${ROUTES.MESSAGES(locale)}?c=${encodeURIComponent(provenance.conversationId)}`}
                      className="inline-flex"
                    >
                      <Badge variant="secondary" className="text-[11px]">
                        <MessageSquare className="mr-1 h-3 w-3" />
                        {t('fromChat')}
                      </Badge>
                    </Link>
                  ) : (
                    <Badge variant="secondary" className="text-[11px]">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      {t('fromChat')}
                    </Badge>
                  )
                ) : null}
              </div>
            ) : null}

            {mode === 'browse' && session?.user ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <IconAction
                    label={t('like')}
                    active={flags.liked}
                    onClick={() =>
                      runInteraction(
                        { liked: !flags.liked, likeCount: flags.likeCount + (flags.liked ? -1 : 1) },
                        async () => {
                          const fd = new FormData()
                          fd.set('opportunityId', opportunity.id)
                          return toggleOpportunityLike(null, fd)
                        },
                      )
                    }
                  >
                    <Heart className={cn('h-4 w-4', flags.liked && 'fill-current')} />
                    {flags.likeCount > 0 ? <span className="text-xs">{flags.likeCount}</span> : null}
                  </IconAction>
                  <IconAction
                    label={t('save')}
                    active={flags.saved}
                    onClick={() =>
                      runInteraction({ saved: !flags.saved }, async () => {
                        const fd = new FormData()
                        fd.set('opportunityId', opportunity.id)
                        return toggleOpportunitySave(null, fd)
                      })
                    }
                  >
                    <Bookmark className={cn('h-4 w-4', flags.saved && 'fill-current')} />
                  </IconAction>
                  {!isOwnPost ? (
                    <IconAction
                      label={t('notInterested')}
                      onClick={() =>
                        runInteraction({ hidden: true }, async () => {
                          const fd = new FormData()
                          fd.set('opportunityId', opportunity.id)
                          return markOpportunityNotInterested(null, fd)
                        })
                      }
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </IconAction>
                  ) : null}
                  {canContact ? (
                    <IconAction
                      label={t('contact')}
                      onClick={() => {
                        // Navigation is the user's goal; the matcher signal is best-effort.
                        const fd = new FormData()
                        fd.set('opportunityId', opportunity.id)
                        void recordOpportunityContactIntent(null, fd).catch(() => undefined)
                        router.push(
                          `${ROUTES.MESSAGES(locale)}?user=${encodeURIComponent(opportunity.createdBy)}`,
                        )
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </IconAction>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="ghost" disabled={isPending} className="shrink-0">
                  <Link href={detailsHref}>{t('viewDetails')}</Link>
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
                  <Link href={detailsHref}>{t('viewDetails')}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}

function IconAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={active ? 'secondary' : 'ghost'}
          className={cn('gap-1', active && 'text-primary')}
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
