'use client'

/**
 * Profile reward quests — live board from getRewardQuestBoard
 * (catalog amounts + byTrigger earn counts). Progress is real:
 * % = completed/total; remaining = sum of catalog amounts for incomplete quests.
 * Collapsed by default; expand to stacked quest rows.
 */

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Sparkles,
  Shield,
  Send,
  User,
  FileText,
  Newspaper,
  ClipboardList,
  Star,
  Check,
  ChevronDown,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import { getRewardQuestBoard } from '@/app/_actions/wallet'
import { getClientCreditUnitLabel } from '@/lib/ring-config-client'
import type { Locale } from '@/i18n/shared'

type RewardTrigger =
  | 'ringUsername'
  | 'addedBio'
  | 'addedTelegram'
  | 'adminVerify'
  | 'commentCreated'
  | 'requestCreated'
  | 'reviewCreated'

interface ActionItem {
  id: RewardTrigger
  label: string
  reward: number
  icon: React.ElementType
  completed: boolean
  earned: boolean
  onClick: () => void
  colorClass: string
}

/**
 * Live props only. Trimmed (2026-07-16) — see DEAD_PROPS_LEDGER below for reapply/deprecate.
 *
 * DEAD_PROPS_LEDGER (removed from this widget; formerly passed by profile-content):
 * - profileCompletion: number — % of profile fields filled; was used as Progress fallback
 *   (questProgressValue || profileCompletion). Removed because it lied when quests were 0%.
 *   Reapply only if a separate "profile completeness" meter is designed; do NOT blend into quest %.
 * - whatsappSet / phoneSet / timezoneSet: boolean — legacy profile-completion quests, not in
 *   reward catalog QUEST_ORDER. Deprecate unless new reward triggers are added for them.
 * - membershipActive: boolean — was used by mock Membership/Checkout tiles (reward 0).
 *   Superseded by real getRewardQuestBoard catalog; membership lives on /wallet + credit context.
 */
interface UserProgressWidgetProps {
  usernameSet: boolean
  bioSet: boolean
  telegramSet: boolean
  kycApproved: boolean
  locale: string
  onNavigateTab: (tab: string) => void
  onOpenUsernameModal: () => void
  onOpenBioModal: () => void
}

const QUEST_ORDER: RewardTrigger[] = [
  'ringUsername',
  'addedBio',
  'addedTelegram',
  'adminVerify',
  'commentCreated',
  'requestCreated',
  'reviewCreated',
]

export function UserProgressWidget({
  usernameSet,
  bioSet,
  telegramSet,
  kycApproved,
  locale,
  onNavigateTab,
  onOpenUsernameModal,
  onOpenBioModal,
}: UserProgressWidgetProps) {
  const t = useTranslations('modules.profile')
  const router = useRouter()
  const [, startTransition] = useTransition()
  const creditBalanceUnitFallback = getClientCreditUnitLabel()

  const [unitLabel, setUnitLabel] = useState(creditBalanceUnitFallback)
  const [amounts, setAmounts] = useState<Partial<Record<RewardTrigger, number>>>({})
  const [earnedByTrigger, setEarnedByTrigger] = useState<Record<string, number>>({})
  const [questsLoaded, setQuestsLoaded] = useState(false)
  const [questsFailed, setQuestsFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    startTransition(() => {
      void getRewardQuestBoard().then((result) => {
        if (cancelled) return
        if (!result.success) {
          setQuestsFailed(true)
          setQuestsLoaded(true)
          return
        }
        const nextAmounts: Partial<Record<RewardTrigger, number>> = {}
        for (const row of result.catalog || []) {
          if (QUEST_ORDER.includes(row.trigger as RewardTrigger)) {
            nextAmounts[row.trigger as RewardTrigger] = row.amount
          }
        }
        const earned: Record<string, number> = {}
        for (const [trigger, row] of Object.entries(result.byTrigger || {})) {
          earned[trigger] = row.count
        }
        setAmounts(nextAmounts)
        setEarnedByTrigger(earned)
        if (result.unitLabel) setUnitLabel(result.unitLabel)
        setQuestsFailed(false)
        setQuestsLoaded(true)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loc = locale.toLowerCase() as Locale

  const hasEarned = (trigger: RewardTrigger) => (earnedByTrigger[trigger] ?? 0) > 0

  const isComplete = (trigger: RewardTrigger): boolean => {
    if (hasEarned(trigger)) return true
    switch (trigger) {
      case 'ringUsername':
        return usernameSet
      case 'addedBio':
        return bioSet
      case 'addedTelegram':
        return telegramSet
      case 'adminVerify':
        return kycApproved
      default:
        return false
    }
  }

  const actions: ActionItem[] = useMemo(() => {
    const openNews = () =>
      router.push(ROUTES.NEWS(loc) as Parameters<typeof router.push>[0])
    const openAddRequest = () =>
      router.push(
        `${ROUTES.ADD_OPPORTUNITY(loc)}?type=request` as Parameters<typeof router.push>[0],
      )
    const openStore = () =>
      router.push(ROUTES.STORE(loc) as Parameters<typeof router.push>[0])

    const amtFor = (trigger: RewardTrigger) => amounts[trigger] ?? 0

    return [
      {
        id: 'ringUsername',
        label: t('rewardQuests.ringUsername'),
        reward: amtFor('ringUsername'),
        icon: User,
        completed: isComplete('ringUsername'),
        earned: hasEarned('ringUsername'),
        onClick: onOpenUsernameModal,
        colorClass: 'text-blue-500',
      },
      {
        id: 'addedBio',
        label: t('rewardQuests.addedBio'),
        reward: amtFor('addedBio'),
        icon: FileText,
        completed: isComplete('addedBio'),
        earned: hasEarned('addedBio'),
        onClick: onOpenBioModal,
        colorClass: 'text-emerald-500',
      },
      {
        id: 'addedTelegram',
        label: t('rewardQuests.addedTelegram'),
        reward: amtFor('addedTelegram'),
        icon: Send,
        completed: isComplete('addedTelegram'),
        earned: hasEarned('addedTelegram'),
        onClick: () => onNavigateTab('communications'),
        colorClass: 'text-sky-500',
      },
      {
        id: 'adminVerify',
        label: t('rewardQuests.adminVerify'),
        reward: amtFor('adminVerify'),
        icon: Shield,
        completed: isComplete('adminVerify'),
        earned: hasEarned('adminVerify'),
        onClick: () => onNavigateTab('verification'),
        colorClass: 'text-rose-500',
      },
      {
        id: 'commentCreated',
        label: t('rewardQuests.commentCreated'),
        reward: amtFor('commentCreated'),
        icon: Newspaper,
        completed: isComplete('commentCreated'),
        earned: hasEarned('commentCreated'),
        onClick: openNews,
        colorClass: 'text-indigo-500',
      },
      {
        id: 'requestCreated',
        label: t('rewardQuests.requestCreated'),
        reward: amtFor('requestCreated'),
        icon: ClipboardList,
        completed: isComplete('requestCreated'),
        earned: hasEarned('requestCreated'),
        onClick: openAddRequest,
        colorClass: 'text-violet-500',
      },
      {
        id: 'reviewCreated',
        label: t('rewardQuests.reviewCreated'),
        reward: amtFor('reviewCreated'),
        icon: Star,
        completed: isComplete('reviewCreated'),
        earned: hasEarned('reviewCreated'),
        onClick: openStore,
        colorClass: 'text-amber-500',
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    amounts,
    usernameSet,
    bioSet,
    telegramSet,
    kycApproved,
    earnedByTrigger,
    loc,
    t,
    onNavigateTab,
    onOpenUsernameModal,
    onOpenBioModal,
    router,
  ])

  const incompleteActions = actions.filter((a) => !a.completed)
  const completedCount = actions.filter((a) => a.completed).length
  const remainingPoints = incompleteActions.reduce((sum, a) => sum + (a.reward || 0), 0)
  const earnedQuestPoints = actions
    .filter((a) => a.earned)
    .reduce((sum, a) => sum + (a.reward || 0), 0)
  const questProgressValue = Math.min(
    100,
    Math.round((completedCount / Math.max(actions.length, 1)) * 100),
  )

  return (
    <div className={cn(davinciGlassSurface, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 p-4 text-left',
          'hover:bg-yellow-500/5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/40 focus-visible:ring-inset',
        )}
        aria-expanded={expanded}
        aria-controls="profile-quest-list"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
          <Sparkles className="h-5 w-5 text-yellow-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t('rewardQuests.questProgress')}</p>
          {!questsLoaded ? (
            <div className="mt-1 space-y-2">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ) : questsFailed ? (
            <p className="mt-0.5 text-sm text-muted-foreground">—</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-bold text-yellow-600">
                  {t('rewardQuests.remainingEarn', {
                    amount: remainingPoints,
                    unit: unitLabel,
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({questProgressValue}% · {completedCount}/{actions.length})
                </span>
              </div>
              <Progress value={questProgressValue} className="mt-1 h-1.5" />
              {earnedQuestPoints > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('rewardQuests.earnedFromQuests', {
                    amount: earnedQuestPoints,
                    unit: unitLabel,
                  })}
                </p>
              )}
            </>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div
          id="profile-quest-list"
          className="space-y-1 border-t border-border/40 px-2 pb-3 pt-2"
        >
          {!questsLoaded ? (
            <div className="space-y-2 px-2 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : questsFailed ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">—</p>
          ) : (
            actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={action.completed}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!action.completed) action.onClick()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                    'transition-colors',
                    action.completed
                      ? 'cursor-default opacity-60'
                      : 'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60',
                      action.colorClass,
                    )}
                  >
                    {action.completed ? (
                      <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {action.label}
                  </span>
                  <Badge
                    variant={action.completed ? 'outline' : 'secondary'}
                    className="shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {action.completed ? '✓' : `+${action.reward}`}
                  </Badge>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
