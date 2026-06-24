/**
 * Ring Wallet Balance Component
 *
 * Displays the RING credit balance with USD equivalent.
 * Used in wallet center pane and profile rails.
 *
 * @author LegioX Commander
 * @version 1.0.0
 */

'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, Plus, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
  HeroAmbient,
} from '@/lib/ui/davinci'

export interface RingWalletBalanceProps {
  /** Formatted RING amount, e.g. "12.50" */
  displayBalance: string
  /** USD equivalent string */
  usdEquivalent?: string
  isLoading?: boolean
  isRefreshing?: boolean
  hasLowBalance?: boolean
  onTopUp?: () => void
  onRefresh?: () => void
  className?: string
  compact?: boolean
}

/**
 * DaVinci glass RING credit balance hero — theme-aware via CSS tokens.
 * Used in /wallet center pane and reusable in profile rails.
 */
export function RingWalletBalance({
  displayBalance,
  usdEquivalent = '0.00',
  isLoading = false,
  isRefreshing = false,
  hasLowBalance = false,
  onTopUp,
  onRefresh,
  className,
  compact = false,
}: RingWalletBalanceProps) {
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
      innerClassName={cn(davinciBeamInnerSurface, compact ? 'p-5' : 'p-6 sm:p-8')}
    >
      <HeroAmbient className="rounded-[inherit] opacity-60" />

      <div className="relative z-[1]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
                compact ? 'h-9 w-9' : 'h-10 w-10',
              )}
              aria-hidden
            >
              <Wallet className={cn('text-[var(--davinci-beam)]', compact ? 'h-4 w-4' : 'h-5 w-5')} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{t('ringBalance')}</p>
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
              className={cn(
                'shrink-0 rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_6%,transparent)]',
                'hover:bg-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]',
              )}
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t('refresh')}
              title={t('refresh')}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 text-[var(--davinci-beam)]',
                  isRefreshing && 'animate-spin',
                )}
              />
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div
              className={cn(
                'font-bold tracking-tight text-[var(--davinci-beam)]',
                compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl',
                hasLowBalance && 'text-amber-600 dark:text-amber-400',
              )}
            >
              {isLoading ? (
                <span className="inline-block animate-pulse opacity-60">···</span>
              ) : (
                <>
                  {displayBalance}{' '}
                  <span className="text-xl font-semibold text-muted-foreground sm:text-2xl">RING</span>
                </>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">≈ ${usdEquivalent} USD</p>
          </div>

          {onTopUp && (
            <button
              type="button"
              onClick={onTopUp}
              className={cn(
                davinciCtaPrimary,
                'inline-flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 text-sm',
              )}
            >
              <Plus className="h-4 w-4 text-[var(--davinci-beam)]" aria-hidden />
              {t('topUpNow')}
            </button>
          )}
        </div>
      </div>
    </BorderBeam>
  )
}
