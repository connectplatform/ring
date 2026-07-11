'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, ArrowRightLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { davinciTerminalSurface } from '@/lib/ui/davinci'
import {
  getClientCreditFiatCurrency,
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
  const creditUnit = getClientCreditUnitLabel()
  const fiatCurrency = getClientCreditFiatCurrency()
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
      <div
        className={cn(
          davinciTerminalSurface,
          'space-y-3 px-3 py-3 transition-colors',
          selected && 'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] ring-1 ring-[var(--davinci-beam)]/30',
          className,
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
            <div>
              <p className="text-xs text-muted-foreground">{t('creditBalanceItem.title')}</p>
              <p className="text-lg font-semibold text-[var(--davinci-beam)]">
                {formatCreditAmount(creditAmount)} {creditUnit}
              </p>
              {creditUsdEquivalent && (
                <p className="text-xs text-muted-foreground">
                  ≈ {creditUsdEquivalent} {fiatCurrency}
                </p>
              )}
              {convertPreview && parseFloat(creditAmount) > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {t('creditBalanceItem.convertHint', {
                    amount: convertPreview,
                    token: nativeSymbol,
                  })}
                </p>
              )}
            </div>
          </div>
        </button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setConvertOpen(true)}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {t('creditBalanceItem.convertTo', { token: nativeSymbol })}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddCreditOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('creditBalanceItem.addCredit')}
          </Button>
        </div>
      </div>

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
