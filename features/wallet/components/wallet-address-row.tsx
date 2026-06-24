'use client'

import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { davinciTerminalSurface } from '@/lib/ui/davinci'
import { getClientRingTokenSymbol } from '@/lib/ring-config-client'

interface WalletAddressRowProps {
  address: string
  label?: string
  chain?: 'solana' | 'evm'
  nativeBalance?: string
  tokenSymbol?: string
  isPrimary?: boolean
  primaryLabel: string
  copied: boolean
  selected?: boolean
  onCopy: () => void
  onSelect?: () => void
  formatAddress?: (address: string) => string
}

export default function WalletAddressRow({
  address,
  label,
  chain,
  nativeBalance,
  tokenSymbol = getClientRingTokenSymbol(),
  isPrimary,
  primaryLabel,
  copied,
  selected = false,
  onCopy,
  onSelect,
  formatAddress = (a) => `${a.slice(0, 8)}...${a.slice(-6)}`,
}: WalletAddressRowProps) {
  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        davinciTerminalSurface,
        'flex items-center justify-between gap-3 px-3 py-2.5',
        'transition-[border-color,box-shadow] duration-200',
        onSelect && 'cursor-pointer hover:border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
        selected && 'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-mono text-sm">{formatAddress(address)}</span>
          {chain && (
            <Badge variant="outline" className="text-[10px] uppercase">
              {chain}
            </Badge>
          )}
          {isPrimary && (
            <Badge
              variant="secondary"
              className="border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)] text-xs"
            >
              {primaryLabel}
            </Badge>
          )}
        </div>
        {nativeBalance !== undefined && (
          <p className="mt-1 text-sm font-medium text-[var(--davinci-beam)]">
            {nativeBalance} {tokenSymbol}
          </p>
        )}
        {label && <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onCopy()
        }}
        className="shrink-0 rounded-lg"
        aria-label="Copy address"
      >
        {copied ? (
          <Check className="h-4 w-4 text-[var(--davinci-beam)]" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
