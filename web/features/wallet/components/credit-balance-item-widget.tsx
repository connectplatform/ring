'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, ArrowRightLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  DavinciGlassChip,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import {
  getClientMainCurrency,
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
  previewNativeTokenFromCreditPoints,
  resolveCreditMainCurrencyEquivalent,
} from '@/lib/ring-config-client'
import { formatCreditPoints } from '@/lib/wallet/format-credit-points'
import type { WalletActivityScope } from '@/components/providers/wallet-activity-provider'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import DeskWidget from '@/features/wallet/components/desk-widget'
import CreditAddFsModal from '@/features/wallet/components/credit-add-fs-modal'

export interface CreditBalanceItemWidgetProps {
  creditAmount: string
  /** Optional stored ledger fiat — ignored when NaN; SSOT is points × creditBalanceUnitToMainCurrency */
  creditMainCurrencyEquivalent?: string
  selected: boolean
  onSelect: () => void
  onRefresh?: () => void
  className?: string
}

function formatCreditAmount(value: string) {
  return formatCreditPoints(value)
}

export default function CreditBalanceItemWidget({
  creditAmount,
  creditMainCurrencyEquivalent,
  selected,
  onSelect,
  onRefresh,
  className,
}: CreditBalanceItemWidgetProps) {
  const t = useTranslations('modules.wallet')
  const creditUnit = getClientCreditUnitLabel()
  const mainCurrency = getClientMainCurrency()
  const nativeSymbol = getClientNativeTokenSymbol()
  const mainEquivalent = resolveCreditMainCurrencyEquivalent(
    creditAmount,
    creditMainCurrencyEquivalent,
  )

  const [convertOpen, setConvertOpen] = useState(false)
  const [addCreditOpen, setAddCreditOpen] = useState(false)
  const [convertPreview, setConvertPreview] = useState<string | null>(null)

  useEffect(() => {
    const points = Math.floor(parseFloat(creditAmount || '0'))
    if (points <= 0) {
      setConvertPreview(null)
      return
    }

    let cancelled = false
    const params = new URLSearchParams({ side: 'buy', amount: String(points) })
    void fetch(`/api/wallet/desk/quote?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ringAmountUi?: string } | null) => {
        if (!cancelled && data?.ringAmountUi) {
          setConvertPreview(data.ringAmountUi)
        } else if (!cancelled) {
          setConvertPreview(previewNativeTokenFromCreditPoints(points))
        }
      })
      .catch(() => {
        if (!cancelled) setConvertPreview(previewNativeTokenFromCreditPoints(points))
      })

    return () => {
      cancelled = true
    }
  }, [creditAmount])

  const handleDeskSuccess = () => {
    setConvertOpen(false)
    void onRefresh?.()
  }

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
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {t('creditBalanceItem.title')}
          </span>
          <DavinciGlassChip>{creditUnit}</DavinciGlassChip>
        </div>
      </div>
    </>
  )

  return (
    <>
      <BorderBeam
        disabled={!selected}
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
          <button
            type="button"
            onClick={onSelect}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
          >
            {identity}
          </button>

          <div className="min-w-[5.5rem] shrink-0 text-right">
            <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--davinci-beam)] sm:text-2xl">
              {formatCreditAmount(creditAmount)}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              ≈ {mainEquivalent} {mainCurrency}
            </p>
            {convertPreview && parseFloat(creditAmount) > 0 ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {t('creditBalanceItem.convertHint', {
                  amount: convertPreview,
                  token: nativeSymbol,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--davinci-glass-border)] pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[99px] gap-1.5 text-xs"
            onClick={() => setConvertOpen(true)}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {t('creditBalanceItem.convertTo', { token: nativeSymbol })}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-[99px] gap-1.5 text-xs"
            onClick={() => setAddCreditOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('creditBalanceItem.addCredit')}
          </Button>
        </div>
      </BorderBeam>

      <WalletFsModal
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={t('creditBalanceItem.deskModalTitle', { token: nativeSymbol })}
      >
        <DeskWidget
          variant="embedded"
          initialAmount={formatCreditPoints(creditAmount)}
          creditBalancePoints={creditAmount}
          autoQuote
          onSuccess={handleDeskSuccess}
          onPurchaseCredit={() => {
            setConvertOpen(false)
            setAddCreditOpen(true)
          }}
        />
      </WalletFsModal>

      <CreditAddFsModal open={addCreditOpen} onOpenChange={setAddCreditOpen} />
    </>
  )
}

export function isCreditScopeSelected(
  selectedScope: WalletActivityScope,
  creditScope: WalletActivityScope = { type: 'credit' },
): boolean {
  return selectedScope.type === creditScope.type
}
