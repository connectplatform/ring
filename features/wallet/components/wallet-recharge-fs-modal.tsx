'use client'

import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import DeskWidget from '@/features/wallet/components/desk-widget'
import CreditAddFsModal from '@/features/wallet/components/credit-add-fs-modal'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getClientCreditUnitLabel, getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'

export interface WalletRechargeFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallet: WalletInfo
  creditBalancePoints?: string
  onSuccess?: () => void
}

/**
 * Recharge flow for a native wallet: Token Desk (credit → RING) + optional card top-up.
 */
export default function WalletRechargeFsModal({
  open,
  onOpenChange,
  wallet,
  creditBalancePoints = '0',
  onSuccess,
}: WalletRechargeFsModalProps) {
  const t = useTranslations('modules.wallet')
  const token = wallet.tokenSymbol ?? getClientNativeTokenSymbol()
  const creditBalanceUnit = getClientCreditUnitLabel()
  const [addCreditOpen, setAddCreditOpen] = useState(false)

  return (
    <>
      <WalletFsModal
        open={open}
        onOpenChange={onOpenChange}
        title={t('rechargeModalTitle', { token })}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('rechargeModalHint', { token, creditBalanceUnit, address: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` })}
          </p>
          <DeskWidget
            variant="embedded"
            creditBalancePoints={creditBalancePoints}
            autoQuote
            onSuccess={() => {
              onSuccess?.()
              onOpenChange(false)
            }}
            onPurchaseCredit={() => setAddCreditOpen(true)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setAddCreditOpen(true)}
          >
            {t('creditBalanceItem.addCredit')}
          </Button>
        </div>
      </WalletFsModal>

      <CreditAddFsModal
        open={addCreditOpen}
        onOpenChange={setAddCreditOpen}
        source="wallet_recharge_fs_modal"
        onSuccess={() => {
          setAddCreditOpen(false)
          onSuccess?.()
        }}
      />
    </>
  )
}
