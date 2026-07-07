'use client'

import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { davinciTerminalSurface } from '@/lib/ui/davinci'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
// type-only import: this is a 'use client' component, must not pull server
// config accessors into the client bundle.
import type { NativeChain } from '@/lib/ring-config-chain'

// Props definition for the WalletAddressRow component
interface WalletAddressRowProps {
  address: string // The wallet address to display and copy
  label?: string // Optional label/description for the address
  chain?: NativeChain // Optional blockchain chain name/id
  nativeBalance?: number // Optional address' native token balance
  tokenSymbol?: string // Optional override of the token symbol string
  isPrimary?: boolean // Optional: is this the primary user address?
  primaryLabel: string // Label to use if isPrimary is true
  copied: boolean // Whether the copy button reflects copied state
  selected?: boolean // Whether this row is currently selected
  onCopy: () => void // Called when copy button is pressed
  onSelect?: () => void // Called when user selects (click/keyboard) row
  formatAddress?: (address: string) => string // Optionally customize address formatting
}

// TODO: Switch to React 19 useOptimistic, use(Transition), and Next 16 actions pattern if mutating state from this component for real-time UX.
// TODO: If onSelect/onCopy have async/transition logic, migrate to server actions, React 'action' prop, and React's startTransition for non-blocking UI interactions when supported.

// WalletAddressRow: UI row displaying a wallet address, (optionally) with chain, balance, label, selected and primary badges, and a copy-to-clipboard button.
export default function WalletAddressRow({
  address,
  label,
  chain,
  nativeBalance,
  tokenSymbol = getClientNativeTokenSymbol(), // Default to app-configured token symbol
  isPrimary,
  primaryLabel,
  copied,
  selected = false,
  onCopy,
  onSelect,
  formatAddress = (a) => `${a.slice(0, 8)}...${a.slice(-6)}`, // Default address-truncating formatting
}: WalletAddressRowProps) {
  // Format the balance to two decimals if present; returns a string or undefined
  const formattedNativeBalance = nativeBalance?.toFixed(2)
  // Bail out: if there's no balance provided, render nothing (could improve for list virtualization/UX)
  if (!formattedNativeBalance) return null

  return (
    <div
      // if onSelect supplied, make the whole row behave as a button for a11y
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      // Keyboard accessibility for clickable row: trigger onSelect for Enter or Space
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        davinciTerminalSurface, // Unified app surface styling
        'flex items-center justify-between gap-3 px-3 py-2.5',
        'transition-[border-color,box-shadow] duration-200', // Smooth highlight
        // Highlight/cursor on hover if selectable
        onSelect && 'cursor-pointer hover:border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]', 
        // Stronger border for selected row
        selected && 'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
      )}
    >
      {/* Address, chain badge, and primary badge grouping */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Address (formatted, truncated by default) */}
          <span className="truncate font-mono text-sm">{formatAddress(address)}</span>
          {/* Chain badge, if chain information is provided */}
          {chain && (
            <Badge variant="outline" className="text-[10px] uppercase">
              {chain}
            </Badge>
          )}
          {/* Primary badge, shown if isPrimary is true */}
          {isPrimary && (
            <Badge
              variant="secondary"
              className="border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)] text-xs"
            >
              {primaryLabel}
            </Badge>
          )}
        </div>
        {/* Native balance and token symbol, if present */}
        {nativeBalance !== undefined && (
          <p className="mt-1 text-sm font-medium text-[var(--davinci-beam)]">
            {formattedNativeBalance} {tokenSymbol}
          </p>
        )}
        {/* Optional user-provided label for the address */}
        {label && <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>}
      </div>
      {/* Copy-to-clipboard button, reflects copied state */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          // Prevent row onClick being fired so only copy triggers onCopy
          e.stopPropagation()
          onCopy()
        }}
        className="shrink-0 rounded-lg"
        aria-label="Copy address"
      >
        {copied ? (
          // Use Check icon to show successfully copied
          <Check className="h-4 w-4 text-[var(--davinci-beam)]" />
        ) : (
          // Use Copy icon if not yet copied
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
