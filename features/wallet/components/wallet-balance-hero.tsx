'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import type { WalletActivityScope } from '@/components/providers/wallet-activity-provider'
import NativeWalletListItem from '@/features/wallet/components/native-wallet-list-item'
import CreditBalanceItemWidget from '@/features/wallet/components/credit-balance-item-widget'
import WalletSendFsModal from '@/features/wallet/components/wallet-send-fs-modal'
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
  hasLowBalance?: boolean
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
  hasLowBalance = false,
  isRefreshing = false,
  onRefresh,
  className,
}: WalletBalanceHeroProps) {
  const t = useTranslations('modules.wallet')
  const [sendWallet, setSendWallet] = useState<WalletInfo | null>(null)

  return (
    <div className={cn('relative space-y-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
            )}
          >
            <Wallet className="h-5 w-5 text-[var(--davinci-beam)]" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('balancesTitle')}</p>
            {hasLowBalance && (
              <Badge
                variant="secondary"
                className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t('lowBalance')}
              </Badge>
            )}
            {isRefreshing && (
              <p className="mt-1 text-[10px] text-muted-foreground">{t('refreshingBalances')}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {selectedScope.type !== 'all' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs"
              onClick={() => onSelectScope({ type: 'all' })}
            >
              {t('activityAll', { defaultValue: 'All activity' })}
            </Button>
          )}
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t('refresh')}
              title={t('autoRefreshEvery')}
            >
              <RefreshCw
                className={cn('h-4 w-4 text-[var(--davinci-beam)]', isRefreshing && 'animate-spin')}
              />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <CreditBalanceItemWidget
          creditAmount={creditAmount}
          creditUsdEquivalent={creditUsdEquivalent}
          selected={isScopeSelected(selectedScope, { type: 'credit' })}
          onSelect={() => onSelectScope({ type: 'credit' })}
          onRefresh={onRefresh}
        />

        {walletsLoading ? (
          <p className="py-2 text-sm text-muted-foreground">{t('loadingWallets')}</p>
        ) : wallets.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t('noWallets')}</p>
        ) : (
          wallets.map((wallet) => (
            <div
              key={wallet.address}
              className={cn(
                'rounded-xl transition-colors',
                isScopeSelected(selectedScope, { type: 'wallet', address: wallet.address }) &&
                  'ring-1 ring-[var(--davinci-beam)]/30',
              )}
            >
              <NativeWalletListItem
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
                onSend={() => setSendWallet(wallet)}
              />
            </div>
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
    </div>
  )
}
