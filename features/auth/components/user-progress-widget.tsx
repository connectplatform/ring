'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Sparkles,
  TrendingUp,
  Coins,
  ArrowUpRight,
  Shield,
  Send,
  MessageSquare,
  User,
  FileText,
  Newspaper,
  ClipboardList,
  Star,
  Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciAuthButtonLift } from '@/lib/ui/davinci'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { Link, toAppHref, useRouter } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import { getRewardQuestBoard } from '@/app/_actions/wallet'
import { usePrimaryNativeBalance } from '@/hooks/use-primary-native-balance'
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
  const credit = useCreditBalanceContext()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const creditUnitFallback = getClientCreditUnitLabel()
  const {
    nativeBalance,
    formatted: nativeFormatted,
    loading: nativeLoading,
    error: nativeError,
    symbol: nativeSymbol,
  } = usePrimaryNativeBalance({ enabled: true })

  const [unitLabel, setUnitLabel] = useState(creditUnitFallback)
  const [amounts, setAmounts] = useState<Partial<Record<RewardTrigger, number>>>({})
  const [earnedByTrigger, setEarnedByTrigger] = useState<Record<string, number>>({})
  const [questsLoaded, setQuestsLoaded] = useState(false)
  const [questsFailed, setQuestsFailed] = useState(false)

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

  const creditBalance = credit?.balance?.amount ?? '0'
  const creditUsd = credit?.balance?.usd_equivalent ?? '0.00'
  const creditLoading = Boolean(credit?.isLoading && !credit?.balance)
  const loc = locale.toLowerCase() as Locale
  const walletHref = toAppHref(ROUTES.WALLET(loc))
  const topupHref = ROUTES.WALLET_TOPUP(loc)

  const goTopup = () =>
    router.push(topupHref as Parameters<typeof router.push>[0])
  const goWallet = () =>
    router.push(walletHref as Parameters<typeof router.push>[0])

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
  const remainingPoints = incompleteActions.reduce((sum, a) => sum + (a.reward || 0), 0)
  const earnedQuestPoints = actions
    .filter((a) => a.earned)
    .reduce((sum, a) => sum + (a.reward || 0), 0)
  const questProgressValue = Math.min(
    100,
    Math.round((actions.filter((a) => a.completed).length / Math.max(actions.length, 1)) * 100),
  )

  const nativeDisplay = (() => {
    if (nativeLoading && nativeBalance === null) return null
    if (nativeError && nativeBalance === null) return '—'
    return nativeFormatted
  })()

  return (
    <div className={cn(davinciGlassSurface, 'p-5 space-y-4')}>
      {/* Balances row: credits + native */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t('rewardQuests.userCredits')}</p>
              {creditLoading ? (
                <div className="space-y-1.5 mt-0.5">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <>
                  <p className="text-lg font-bold truncate">
                    {Number(creditBalance).toLocaleString()}{' '}
                    <span className="text-xs font-normal text-muted-foreground">{unitLabel}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('rewardQuests.approxFiat', {
                      amount: Number(creditUsd).toFixed(2),
                      currency: 'USD',
                    })}
                  </p>
                </>
              )}
            </div>
          </div>

          <Link
            href={walletHref}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10',
              'transition-colors hover:bg-violet-500/10 hover:border-violet-500/25',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2',
              'cursor-pointer',
            )}
            aria-label={t('rewardQuests.openWallet')}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/10">
              <Wallet className="w-5 h-5 text-violet-500" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs text-muted-foreground">
                {t('rewardQuests.nativeBalance', { symbol: nativeSymbol })}
              </p>
              {nativeDisplay === null ? (
                <Skeleton className="h-6 w-20 mt-0.5" />
              ) : (
                <p className="text-lg font-bold truncate">
                  {nativeDisplay}{' '}
                  <span className="text-xs font-normal text-muted-foreground">{nativeSymbol}</span>
                </p>
              )}
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" className="text-xs gap-1.5" onClick={goTopup}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            {t('rewardQuests.recharge')}
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={goTopup}>
            {t('rewardQuests.getNative', { symbol: nativeSymbol })}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={goWallet}>
            {t('rewardQuests.openWallet')}
          </Button>
        </div>
      </div>

      {/* Quest progress */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/10">
          <Sparkles className="w-5 h-5 text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{t('rewardQuests.questProgress')}</p>
          {!questsLoaded ? (
            <div className="space-y-2 mt-1">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ) : questsFailed ? (
            <p className="text-sm text-muted-foreground mt-0.5">—</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-yellow-600">
                  {t('rewardQuests.remainingEarn', {
                    amount: remainingPoints,
                    unit: unitLabel,
                  })}
                </span>
                <span className="text-xs text-muted-foreground">({questProgressValue}%)</span>
              </div>
              <Progress value={questProgressValue} className="h-1.5 mt-1" />
              {earnedQuestPoints > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('rewardQuests.earnedFromQuests', {
                    amount: earnedQuestPoints,
                    unit: unitLabel,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!questsLoaded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : incompleteActions.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('rewardQuests.completeToEarn')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {incompleteActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border border-muted bg-background/50',
                  'hover:border-primary/30 hover:bg-accent/30 transition-all duration-200',
                  davinciAuthButtonLift,
                )}
              >
                <action.icon className={cn('w-4 h-4 sm:w-5 sm:h-5', action.colorClass)} />
                <span className="text-[10px] sm:text-[11px] font-medium text-center leading-tight">
                  {action.label}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  +{action.reward}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-3">
          <Sparkles className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-sm font-semibold">{t('rewardQuests.allComplete')}</p>
          <p className="text-xs text-muted-foreground">{t('rewardQuests.allCompleteHint')}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => router.push(ROUTES.NEWS(loc) as Parameters<typeof router.push>[0])}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              {t('rewardQuests.commentCreated')}
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={goTopup}>
              <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              {t('rewardQuests.recharge')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
