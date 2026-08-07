'use client'

/**
 * Custodial native-token wallet row — DaVinci glass surface.
 * Shows what users need: balance, chain, address+copy, primary, actions, stale→refresh.
 */

import { Check, Copy, Loader2, Send, Coins, Plus, Receipt, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  DavinciGlassChip,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import type { NativeChain } from '@/lib/ring-config-chain'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import {
  formatNativeBalance,
  isWalletBalanceStale,
} from '@/features/wallet/utils/balance-cache'

export interface NativeWalletListItemProps {
  wallet: WalletInfo
  copied: boolean
  selected?: boolean
  isRefreshing?: boolean
  onCopy: () => void
  onSelect?: () => void
  onSend?: () => void
  onRequest?: () => void
  onRecharge?: () => void
  /** When balance is stale, wire page-level refresh here. */
  onRefresh?: () => void
  formatAddress?: (address: string) => string
  primaryLabel: string
  className?: string
}

function resolveTokenSymbol(walletSymbol?: string | null): string {
  const clientSymbol = getClientNativeTokenSymbol()
  if (!walletSymbol || walletSymbol.startsWith('Undefined')) {
    return clientSymbol
  }
  return walletSymbol
}

export default function NativeWalletListItem({
  wallet,
  copied,
  selected = false,
  isRefreshing = false,
  onCopy,
  onSelect,
  onSend,
  onRequest,
  onRecharge,
  onRefresh,
  formatAddress = (a) => `${a.slice(0, 8)}...${a.slice(-6)}`,
  primaryLabel,
  className,
}: NativeWalletListItemProps) {
  const t = useTranslations('modules.wallet')
  const tokenSymbol = resolveTokenSymbol(wallet.tokenSymbol)
  const displayBalance = formatNativeBalance(wallet.nativeTokenBalance)
  const balanceStale = isWalletBalanceStale(wallet.balanceUpdatedAt) && !isRefreshing
  const hasActions = Boolean(onRecharge || onRequest || onSend)
  const beamActive = selected

  const identity = (
    <>
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[99px]',
          'border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]',
          'bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]',
          'text-[var(--davinci-beam)]',
        )}
        aria-hidden
      >
        <Coins className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {tokenSymbol}
          </span>
          {wallet.chain ? (
            <DavinciGlassChip className="uppercase tracking-wide">
              {wallet.chain as NativeChain}
            </DavinciGlassChip>
          ) : null}
          {wallet.isPrimary ? (
            <DavinciGlassChip className="text-[var(--davinci-beam)]">
              {primaryLabel}
            </DavinciGlassChip>
          ) : null}
        </div>

        <p className="truncate font-mono text-xs text-muted-foreground">
          {formatAddress(wallet.address)}
        </p>

        {wallet.label ? (
          <p className="truncate text-xs text-muted-foreground">{wallet.label}</p>
        ) : null}
      </div>
    </>
  )

  return (
    <BorderBeam
      disabled={!beamActive}
      duration="7s"
      className={cn(
        davinciGlassSurface,
        davinciAuthButtonLift,
        'rounded-[15px]',
        selected && 'ring-1 ring-[var(--davinci-beam)]/35',
        className,
      )}
      innerClassName={cn(davinciBeamInnerSurface, 'p-3.5 sm:p-4')}
    >
      <div className="flex items-start gap-3">
        {/* Copy is a sibling of the select control — never nest <button> in <button>. */}
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
          >
            {identity}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{identity}</div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="mt-0.5 h-7 w-7 shrink-0 rounded-[99px] p-0 text-muted-foreground hover:text-[var(--davinci-beam)]"
          aria-label={t('copyAddress')}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--davinci-beam)]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>

        <div className="min-w-[4.75rem] shrink-0 text-right">
          <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--davinci-beam)] sm:text-2xl">
            {isRefreshing ? (
              <Loader2 className="inline h-5 w-5 animate-spin" />
            ) : (
              displayBalance
            )}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tokenSymbol}
          </p>
        </div>
      </div>

      {(hasActions || balanceStale || wallet.balanceUpdatedAt) && (
        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--davinci-glass-border)] pt-3',
          )}
        >
          {onRecharge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-[99px] px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onRecharge()
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('rechargeLabel')}
            </Button>
          ) : null}
          {onRequest ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-[99px] px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onRequest()
              }}
            >
              <Receipt className="mr-1 h-3.5 w-3.5" />
              {t('requestLabel')}
            </Button>
          ) : null}
          {onSend ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-[99px] px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onSend()
              }}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {t('sendLabel')}
            </Button>
          ) : null}

          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {balanceStale ? (
              <>
                <span className="max-w-[12rem] truncate text-[10px] text-amber-600 dark:text-amber-400 sm:max-w-none">
                  {t('balanceStaleShort')}
                </span>
                {onRefresh ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-[99px] px-2 text-[11px] text-amber-700 hover:text-amber-800 dark:text-amber-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRefresh()
                    }}
                  >
                    <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
                    {t('refresh')}
                  </Button>
                ) : null}
              </>
            ) : wallet.balanceUpdatedAt ? (
              <span className="text-[10px] text-muted-foreground">{t('balanceUpdated')}</span>
            ) : null}
          </div>
        </div>
      )}
    </BorderBeam>
  )
}
