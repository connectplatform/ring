'use client'

import { Check, Copy, Loader2, Send, Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { davinciTerminalSurface } from '@/lib/ui/davinci'
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
  formatAddress = (a) => `${a.slice(0, 8)}...${a.slice(-6)}`,
  primaryLabel,
  className,
}: NativeWalletListItemProps) {
  const t = useTranslations('modules.wallet')
  const tokenSymbol = resolveTokenSymbol(wallet.tokenSymbol)
  const displayBalance = formatNativeBalance(wallet.nativeBalance)
  const balanceStale = isWalletBalanceStale(wallet.balanceUpdatedAt) && !isRefreshing

  return (
    <div
      className={cn(
        davinciTerminalSurface,
        'flex items-center justify-between gap-2 px-3 py-2.5',
        'transition-[border-color,box-shadow] duration-200',
        selected && 'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          onSelect && 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
            'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
          )}
          aria-hidden
        >
          <Coins className="h-4 w-4 text-[var(--davinci-beam)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--davinci-beam)]">{tokenSymbol}</span>
            {wallet.chain && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {wallet.chain as NativeChain}
              </Badge>
            )}
            {wallet.isPrimary && (
              <Badge
                variant="secondary"
                className="border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)] text-xs"
              >
                {primaryLabel}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {formatAddress(wallet.address)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {isRefreshing ? (
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              ) : null}
              {displayBalance} {tokenSymbol}
            </p>
            {balanceStale ? (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">{t('balanceStale')}</span>
            ) : wallet.balanceUpdatedAt ? (
              <span className="text-[10px] text-muted-foreground">{t('balanceUpdated')}</span>
            ) : null}
          </div>
          {wallet.label && <p className="mt-0.5 text-xs text-muted-foreground">{wallet.label}</p>}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {onSend && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onSend()
            }}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            {t('sendLabel')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onCopy()
          }}
          className="h-8 w-8 rounded-lg p-0"
          aria-label={t('copyAddress')}
        >
          {copied ? (
            <Check className="h-4 w-4 text-[var(--davinci-beam)]" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
