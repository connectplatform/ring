'use client'

import { Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import { getClientCreditUnitLabel, getClientNativeTokenSymbol } from '@/lib/ring-config-client'

export type CreditRewardReceivedFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: string
  unitLabel?: string
  rewardAction: string
}

/**
 * Celebration modal after quest reward credits land.
 * Fullscreen on mobile — Ok sticky above safe-area / bottom-nav clearance.
 */
export default function CreditRewardReceivedFsModal({
  open,
  onOpenChange,
  amount,
  unitLabel,
  rewardAction,
}: CreditRewardReceivedFsModalProps) {
  const t = useTranslations('modules.profile')
  const unit = unitLabel || getClientCreditUnitLabel()
  const nativeSymbol = getClientNativeTokenSymbol()

  return (
    <WalletFsModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('rewardReceived.title', {
        defaultValue: '{unit} received',
        unit,
      })}
    >
      <div className="flex flex-col items-center text-center gap-4 pb-[calc(var(--mobile-bottom-nav-h,3.5rem)+env(safe-area-inset-bottom)+1rem)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/15">
          <Coins className="h-8 w-8 text-yellow-600" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold">
            {t('rewardReceived.headline', {
              defaultValue: '{unit} received',
              unit,
            })}
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {t('rewardReceived.body', {
              defaultValue:
                'You received {amount} {unit} for quest: {action}.\nUse credits to generate content, buy membership and swap for {nativeSymbol}',
              amount,
              unit,
              action: rewardAction,
              nativeSymbol,
            })}
          </p>
        </div>
        <Button
          type="button"
          className="mt-2 w-full max-w-xs sticky bottom-0"
          onClick={() => onOpenChange(false)}
        >
          {t('rewardReceived.ok', { defaultValue: 'Ok' })}
        </Button>
      </div>
    </WalletFsModal>
  )
}
