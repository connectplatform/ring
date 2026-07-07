'use client'

import React, { useCallback } from 'react'
import { Award, Sparkles, TrendingUp, Coins, ArrowUpRight, Shield, Send, MessageSquare, Phone, Globe, User, FileText, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciPanelSurface, davinciAuthButtonLift } from '@/lib/ui/davinci'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useRouter } from '@/i18n/routing'

interface ActionItem {
  id: string
  label: string
  reward: number
  icon: React.ElementType
  completed: boolean
  onClick: () => void
  colorClass: string
}

interface UserProgressWidgetProps {
  profileCompletion: number
  usernameSet: boolean
  bioSet: boolean
  telegramSet: boolean
  whatsappSet: boolean
  phoneSet: boolean
  timezoneSet: boolean
  kycApproved: boolean
  membershipActive: boolean
  potentialRing: number
  locale: string
  onNavigateTab: (tab: string) => void
  onCheckout: () => void
  onOpenUsernameModal: () => void
  onOpenBioModal: () => void
}

export function UserProgressWidget({
  profileCompletion,
  usernameSet,
  bioSet,
  telegramSet,
  whatsappSet,
  phoneSet,
  timezoneSet,
  kycApproved,
  membershipActive,
  potentialRing,
  locale,
  onNavigateTab,
  onCheckout,
  onOpenUsernameModal,
  onOpenBioModal,
}: UserProgressWidgetProps) {
  const credit = useCreditBalanceContext()
  const router = useRouter()
  const creditBalance = credit?.balance?.amount ?? '0'
  const creditUsd = credit?.balance?.usd_equivalent ?? '0.00'

  // Progress to next 1 RING
  const ringProgressValue = Math.min(100, Math.round((profileCompletion / 100) * 100))
  const nextRingFraction = (potentialRing / 700).toFixed(1)

  const actions: ActionItem[] = [
    { id: 'username', label: 'Add username', reward: 10, icon: User, completed: usernameSet, onClick: onOpenUsernameModal, colorClass: 'text-blue-500' },
    { id: 'bio', label: 'Add bio', reward: 10, icon: FileText, completed: bioSet, onClick: onOpenBioModal, colorClass: 'text-emerald-500' },
    { id: 'telegram', label: 'Add Telegram', reward: 10, icon: Send, completed: telegramSet, onClick: () => onNavigateTab('communications'), colorClass: 'text-sky-500' },
    { id: 'kyc', label: 'KYC Verification', reward: 50, icon: Shield, completed: kycApproved, onClick: () => onNavigateTab('verification'), colorClass: 'text-rose-500' },
    { id: 'whatsapp', label: 'Add WhatsApp', reward: 10, icon: MessageSquare, completed: whatsappSet, onClick: () => onNavigateTab('communications'), colorClass: 'text-green-500' },
    { id: 'timezone', label: 'Add timezone', reward: 10, icon: Globe, completed: timezoneSet, onClick: () => onNavigateTab('regional'), colorClass: 'text-amber-500' },
    { id: 'membership', label: 'Membership', reward: 100, icon: Award, completed: membershipActive, onClick: onCheckout, colorClass: 'text-purple-500' },
    { id: 'checkout', label: 'Checkout', reward: 30, icon: CreditCard, completed: false, onClick: onCheckout, colorClass: 'text-indigo-500' },
  ]

  const incompleteActions = actions.filter(a => !a.completed)

  return (
    <div className={cn(davinciGlassSurface, 'p-5 space-y-4')}>
      {/* Top row: Credits + Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* User Credits */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Coins className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">User Credits</p>
            <p className="text-lg font-bold">
              {Number(creditBalance).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pts</span>
            </p>
            <p className="text-[10px] text-muted-foreground">≈ ${Number(creditUsd).toFixed(2)} USD</p>
          </div>
        </div>

        {/* Progress to next RING */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/10">
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Progress to next RING</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-yellow-600">~{nextRingFraction} RING</span>
              <span className="text-xs text-muted-foreground">({ringProgressValue}%)</span>
            </div>
            <Progress value={ringProgressValue} className="h-1.5 mt-1" />
          </div>
        </div>
      </div>

      {/* Action queue */}
      {incompleteActions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Complete to earn credits
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {incompleteActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border border-muted bg-background/50',
                  'hover:border-primary/30 hover:bg-accent/30 transition-all duration-200',
                  davinciAuthButtonLift,
                )}
              >
                <action.icon className={cn('w-5 h-5', action.colorClass)} />
                <span className="text-[11px] font-medium text-center leading-tight">{action.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  +{action.reward}
                </Badge>
              </button>
            ))}
          </div>

          {/* Recharge button */}
          <div className="mt-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckout}
              className="text-xs gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Recharge Credits
            </Button>
          </div>
        </div>
      )}

      {/* All complete */}
      {incompleteActions.length === 0 && (
        <div className="text-center py-3">
          <Sparkles className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-sm font-semibold">All actions complete!</p>
          <p className="text-xs text-muted-foreground">You've earned maximum RING rewards</p>
        </div>
      )}
    </div>
  )
}
