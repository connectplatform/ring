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
} from '@/lib/ring-config-client'
import { formatCreditPoints } from '@/lib/wallet/format-credit-points'
import type { WalletActivityScope } from '@/components/providers/wallet-activity-provider'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import DeskWidget from '@/features/wallet/components/desk-widget'
import CreditAddFsModal from '@/features/wallet/components/credit-add-fs-modal'

export interface CreditBalanceItemWidgetProps {
  creditAmount: string
  creditUsdEquivalent?: string
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
  creditUsdEquivalent,
  selected,
  onSelect,
  onRefresh,
  className,
}: CreditBalanceItemWidgetProps) {
  const t = useTranslations('modules.wallet')
  const creditBalanceUnit = getClientCreditUnitLabel()
  const mainCurrency = getClientMainCurrency()
  const nativeSymbol = getClientNativeTokenSymbol()

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
        innerClassName={cn(davinciBeamInnerSurface, 'space-y-3 p-3.5 sm:p-4')}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full items-start gap-3 text-left"
        >
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {t('creditBalanceItem.title')}
              </p>
              <DavinciGlassChip>{creditBalanceUnit}</DavinciGlassChip>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[var(--davinci-beam)] sm:text-2xl">
              {formatCreditAmount(creditAmount)}
            </p>
            {creditUsdEquivalent ? (
              <p className="text-xs text-muted-foreground">
                ≈ {creditUsdEquivalent} {mainCurrency}
              </p>
            ) : null}
            {convertPreview && parseFloat(creditAmount) > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                {t('creditBalanceItem.convertHint', {
                  amount: convertPreview,
                  token: nativeSymbol,
                })}
              </p>
            ) : null}
          </div>
        </button>

        <div className="flex flex-wrap gap-2 border-t border-[var(--davinci-glass-border)] pt-3">
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
