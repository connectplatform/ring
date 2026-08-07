'use client'

/**
 * Desktop nav trailing credit chip — Profile row right slot (Admin CircleEllipsis pattern).
 * Reads CreditBalanceProvider only (single tunnel `credit:balance` subscription).
 * No wagmi / on-chain reads — credit points are DB + tunnel, so this must never
 * block desktop-nav paint. Shows a compact skeleton while bootstrap loads.
 */

import { ChartColumnIncreasing } from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { getClientCreditUnitLabel } from '@/lib/ring-config-client'
import { formatCreditPoints } from '@/lib/wallet/format-credit-points'
import { cn } from '@/lib/utils'

function CreditChipSkeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'ml-auto flex shrink-0 items-center gap-1 text-[var(--color-contrast-medium)]',
        className,
      )}
      aria-hidden
      data-testid="nav-credit-skeleton"
    >
      <ChartColumnIncreasing className="size-3.5 shrink-0 opacity-40" strokeWidth={1.5} />
      <span className="inline-block h-3.5 w-10 animate-pulse rounded bg-muted" />
      <span className="inline-block h-2.5 w-8 animate-pulse rounded bg-muted" />
    </span>
  )
}

export function NavCreditTrailing({ className }: { className?: string }) {
  const { balance, isLoading } = useCreditBalanceContext()
  const unit = getClientCreditUnitLabel()

  if (isLoading && !balance) {
    return <CreditChipSkeleton className={className} />
  }

  const amount = formatCreditPoints(balance?.amount ?? '0')

  return (
    <span
      className={cn(
        'ml-auto flex shrink-0 items-center gap-1 text-[var(--color-contrast-medium)]',
        className,
      )}
      aria-label={`${amount} ${unit}`}
      title={`${amount} ${unit}`}
    >
      <ChartColumnIncreasing className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
      <span className="text-[13px] font-bold tabular-nums text-foreground">{amount}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide">{unit}</span>
    </span>
  )
}
