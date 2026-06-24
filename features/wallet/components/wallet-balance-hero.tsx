'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, Plus, RefreshCw, Wallet, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
  davinciTerminalSurface,
  HeroAmbient,
} from '@/lib/ui/davinci'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import type { WalletActivityScope } from '@/components/providers/wallet-activity-provider'
import WalletAddressRow from '@/features/wallet/components/wallet-address-row'
import { getClientCreditFiatCurrency, getClientRingTokenSymbol } from '@/lib/ring-config-client'

export interface WalletBalanceHeroProps {
  creditAmount: string
  creditCurrency?: string
  wallets: WalletInfo[]
  walletsLoading?: boolean
  selectedScope: WalletActivityScope
  onSelectScope: (scope: WalletActivityScope) => void
  copiedAddress: string | null
  onCopyAddress: (address: string) => void
  hasLowBalance?: boolean
  isRefreshing?: boolean
  onRefresh?: () => void
  onTopUp?: () => void
  className?: string
}

function formatNativeBalance(value?: string) {
  if (!value || value === '0') return '0'
  const n = parseFloat(value)
  if (Number.isNaN(n)) return value
  return n < 1 ? n.toFixed(4) : n.toFixed(2)
}

function formatCreditAmount(value: string) {
  const n = parseFloat(value || '0')
  if (Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}

function isScopeSelected(a: WalletActivityScope, b: WalletActivityScope): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'wallet' && b.type === 'wallet') return a.address === b.address
  return true
}

export function WalletBalanceHero({
  creditAmount,
  creditCurrency = getClientCreditFiatCurrency(),
  wallets,
  walletsLoading = false,
  selectedScope,
  onSelectScope,
  copiedAddress,
  onCopyAddress,
  hasLowBalance = false,
  isRefreshing = false,
  onRefresh,
  onTopUp,
  className,
}: WalletBalanceHeroProps) {
  const t = useTranslations('modules.wallet')

  return (
    <BorderBeam
      duration="5s"
      className={cn(
        davinciGlassSurface,
        davinciAuthButtonLift,
        'ring-wallet-balance relative overflow-hidden',
        className,
      )}
      innerClassName={cn(davinciBeamInnerSurface, 'p-6 sm:p-8')}
    >
      <HeroAmbient className="rounded-[inherit] opacity-60" />

      <div className="relative z-[1] space-y-5">
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
            </div>
          </div>

          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t('refresh')}
            >
              <RefreshCw
                className={cn('h-4 w-4 text-[var(--davinci-beam)]', isRefreshing && 'animate-spin')}
              />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onSelectScope({ type: 'credit' })}
            className={cn(
              davinciTerminalSurface,
              'flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors',
              isScopeSelected(selectedScope, { type: 'credit' }) &&
                'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] ring-1 ring-[var(--davinci-beam)]/30',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Coins className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
              <div>
                <p className="text-xs text-muted-foreground">{t('creditsBalance')}</p>
                <p className="text-lg font-semibold text-[var(--davinci-beam)]">
                  {formatCreditAmount(creditAmount)} {creditCurrency}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {t('activityCredit')}
            </Badge>
          </button>

          {walletsLoading ? (
            <p className="text-sm text-muted-foreground py-2">{t('loadingWallets')}</p>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('noWallets')}</p>
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
                <WalletAddressRow
                  address={wallet.address}
                  label={wallet.label}
                  chain={wallet.chain}
                  nativeBalance={formatNativeBalance(wallet.nativeBalance)}
                  tokenSymbol={wallet.tokenSymbol ?? getClientRingTokenSymbol()}
                  isPrimary={wallet.isPrimary}
                  primaryLabel={t('primary')}
                  copied={copiedAddress === wallet.address}
                  onCopy={() => onCopyAddress(wallet.address)}
                  onSelect={() => onSelectScope({ type: 'wallet', address: wallet.address })}
                  selected={isScopeSelected(selectedScope, {
                    type: 'wallet',
                    address: wallet.address,
                  })}
                />
              </div>
            ))
          )}
        </div>

        {onTopUp && (
          <button
            type="button"
            onClick={onTopUp}
            className={cn(
              davinciCtaPrimary,
              'inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm',
            )}
          >
            <Plus className="h-4 w-4 text-[var(--davinci-beam)]" aria-hidden />
            {t('topUpNow')}
          </button>
        )}
      </div>
    </BorderBeam>
  )
}
