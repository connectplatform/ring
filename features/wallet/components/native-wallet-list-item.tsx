'use client'

import { Check, Copy, Loader2, Send, Coins, Plus, Receipt } from 'lucide-react'
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
  onRequest?: () => void
  onRecharge?: () => void
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
        'flex items-center gap-2 px-3 py-2.5',
        'transition-[border-color,box-shadow] duration-200',
        selected && 'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
        className,
      )}
    >
      {/* Copy — leftmost control */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onCopy()
        }}
        className="h-8 w-8 shrink-0 rounded-lg p-0"
        aria-label={t('copyAddress')}
      >
        {copied ? (
          <Check className="h-4 w-4 text-[var(--davinci-beam)]" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          onSelect && 'cursor-pointer',
        )}
      >
        {/* Icon without boundary — matches credit sparkles treatment */}
        <Coins className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
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
          {wallet.label && <p className="mt-0.5 text-xs text-muted-foreground">{wallet.label}</p>}
          {balanceStale ? (
            <span className="mt-0.5 block text-[10px] text-amber-600 dark:text-amber-400">
              {t('balanceStale')}
            </span>
          ) : wallet.balanceUpdatedAt ? (
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {t('balanceUpdated')}
            </span>
          ) : null}
        </div>
      </button>

      <div className="flex max-w-[min(100%,22rem)] shrink-0 flex-wrap items-center justify-end gap-1">
        {onRecharge && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onRecharge()
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('rechargeLabel')}
          </Button>
        )}
        {onRequest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onRequest()
            }}
          >
            <Receipt className="mr-1 h-3.5 w-3.5" />
            {t('requestLabel')}
          </Button>
        )}
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
      </div>

      {/* Balance — far right */}
      <div className="min-w-[4.5rem] shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-[var(--davinci-beam)]">
          {isRefreshing ? (
            <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
          ) : (
            displayBalance
          )}
        </p>
        <p className="text-[10px] text-muted-foreground">{tokenSymbol}</p>
      </div>
    </div>
  )
}
