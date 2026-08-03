'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import type { WalletActivityScope } from '@/components/providers/wallet-activity-provider'
import NativeWalletListItem from '@/features/wallet/components/native-wallet-list-item'
import SignInWalletListItem from '@/features/wallet/components/signin-wallet-list-item'
import CreditBalanceItemWidget from '@/features/wallet/components/credit-balance-item-widget'
import WalletSendFsModal from '@/features/wallet/components/wallet-send-fs-modal'
import WalletRequestFsModal from '@/features/wallet/components/wallet-request-fs-modal'
import WalletRechargeFsModal from '@/features/wallet/components/wallet-recharge-fs-modal'
import type { Locale } from '@/i18n/shared'

export interface WalletBalanceHeroProps {
  locale: Locale
  creditAmount: string
  creditUsdEquivalent?: string
  wallets: WalletInfo[]
  walletsLoading?: boolean
  selectedScope: WalletActivityScope
  onSelectScope: (scope: WalletActivityScope) => void
  copiedAddress: string | null
  onCopyAddress: (address: string) => void
  isRefreshing?: boolean
  onRefresh?: () => void
  className?: string
}

function isScopeSelected(a: WalletActivityScope, b: WalletActivityScope): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'wallet' && b.type === 'wallet') return a.address === b.address
  return true
}

export function WalletBalanceHero({
  locale,
  creditAmount,
  creditUsdEquivalent,
  wallets,
  walletsLoading = false,
  selectedScope,
  onSelectScope,
  copiedAddress,
  onCopyAddress,
  isRefreshing = false,
  onRefresh,
  className,
}: WalletBalanceHeroProps) {
  const t = useTranslations('modules.wallet')
  const [sendWallet, setSendWallet] = useState<WalletInfo | null>(null)
  const [requestWallet, setRequestWallet] = useState<WalletInfo | null>(null)
  const [rechargeWallet, setRechargeWallet] = useState<WalletInfo | null>(null)

  return (
    <div className={cn('relative space-y-5', className)}>
      {selectedScope.type !== 'all' && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[99px] text-xs"
            onClick={() => onSelectScope({ type: 'all' })}
          >
            {t('activityAll', { defaultValue: 'All activity' })}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <CreditBalanceItemWidget
          creditAmount={creditAmount}
          creditUsdEquivalent={creditUsdEquivalent}
          selected={isScopeSelected(selectedScope, { type: 'credit' })}
          onSelect={() => onSelectScope({ type: 'credit' })}
          onRefresh={onRefresh}
        />

        {/* Lane C: browser-connected sign-in EVM wallet (wagmi). Swap CTA when allowlisted. */}
        <SignInWalletListItem />

        {walletsLoading ? (
          <p className="py-2 text-sm text-muted-foreground">{t('loadingWallets')}</p>
        ) : wallets.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t('noWallets')}</p>
        ) : (
          wallets.map((wallet) => (
            <NativeWalletListItem
              key={wallet.address}
              wallet={wallet}
              copied={copiedAddress === wallet.address}
              selected={isScopeSelected(selectedScope, {
                type: 'wallet',
                address: wallet.address,
              })}
              isRefreshing={isRefreshing}
              primaryLabel={t('primary')}
              onCopy={() => onCopyAddress(wallet.address)}
              onSelect={() => onSelectScope({ type: 'wallet', address: wallet.address })}
              onRecharge={() => setRechargeWallet(wallet)}
              onRequest={() => setRequestWallet(wallet)}
              onSend={() => setSendWallet(wallet)}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>

      {sendWallet && (
        <WalletSendFsModal
          open={Boolean(sendWallet)}
          onOpenChange={(open) => {
            if (!open) setSendWallet(null)
          }}
          locale={locale}
          wallet={sendWallet}
          onSuccess={() => void onRefresh?.()}
        />
      )}

      {requestWallet && (
        <WalletRequestFsModal
          open={Boolean(requestWallet)}
          onOpenChange={(open) => {
            if (!open) setRequestWallet(null)
          }}
          locale={locale}
          wallet={requestWallet}
          onSuccess={() => void onRefresh?.()}
        />
      )}

      {rechargeWallet && (
        <WalletRechargeFsModal
          open={Boolean(rechargeWallet)}
          onOpenChange={(open) => {
            if (!open) setRechargeWallet(null)
          }}
          wallet={rechargeWallet}
          creditBalancePoints={creditAmount}
          onSuccess={() => void onRefresh?.()}
        />
      )}
    </div>
  )
}
