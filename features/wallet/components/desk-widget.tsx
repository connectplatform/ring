'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DavinciGlassPanel } from '@/lib/ui/davinci'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
  previewNativeTokenFromCreditPoints,
} from '@/lib/ring-config-client'
import { formatCreditPoints, parseCreditPoints } from '@/lib/wallet/format-credit-points'
import { canUseTokenDeskClient } from '@/lib/payments/confidential-token-onramp-client'
import { useAuth } from '@/hooks/use-auth'
import { UserRolesArray } from '@/features/auth/user-role'

type DeskQuote = {
  side: 'buy'
  ringAmountUi: string
  creditUsd: string
  creditFiatCurrency: string
  rate: string
  discountBps: number
  quoteToken: string
}

export interface DeskWidgetProps {
  initialAmount?: string
  creditBalancePoints?: string
  variant?: 'panel' | 'embedded'
  autoQuote?: boolean
  onSuccess?: () => void
  onPurchaseCredit?: () => void
}

export default function DeskWidget({
  initialAmount = '',
  creditBalancePoints = '0',
  variant = 'panel',
  autoQuote = variant === 'embedded',
  onSuccess,
  onPurchaseCredit,
}: DeskWidgetProps) {
  const t = useTranslations('modules.wallet')
  const { role } = useAuth()
  const deskAllowed = canUseTokenDeskClient(role ?? UserRolesArray.visitor)
  const nativeSymbol = getClientNativeTokenSymbol()
  const creditUnit = getClientCreditUnitLabel()
  const availablePoints = formatCreditPoints(creditBalancePoints)

  const [amount, setAmount] = useState(() => formatCreditPoints(initialAmount))
  const [quote, setQuote] = useState<DeskQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [insufficientCredit, setInsufficientCredit] = useState(false)
  const quoteRequestId = useRef(0)

  useEffect(() => {
    setAmount(formatCreditPoints(initialAmount))
    setQuote(null)
    setInsufficientCredit(false)
  }, [initialAmount])

  const fetchQuote = useCallback(
    async (nextAmount: string) => {
      const trimmed = nextAmount.trim()
      if (!trimmed || parseCreditPoints(trimmed) <= 0) {
        setQuote(null)
        return
      }

      const requestId = ++quoteRequestId.current
      setLoading(true)
      try {
        const params = new URLSearchParams({ side: 'buy', amount: trimmed })
        const res = await fetch(`/api/wallet/desk/quote?${params}`)
        const data = await res.json()
        if (requestId !== quoteRequestId.current) return
        if (!res.ok) {
          throw new Error(data.error ?? 'Quote failed')
        }
        setQuote(data as DeskQuote)
        setInsufficientCredit(false)
      } catch (error) {
        if (requestId !== quoteRequestId.current) return
        if (autoQuote) {
          setQuote(null)
        } else {
          toast({
            title: t('deskQuoteFailed'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'destructive',
          })
          setQuote(null)
        }
      } finally {
        if (requestId === quoteRequestId.current) {
          setLoading(false)
        }
      }
    },
    [autoQuote, t],
  )

  useEffect(() => {
    if (!autoQuote) return
    const timer = window.setTimeout(() => {
      void fetchQuote(amount)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [amount, autoQuote, fetchQuote])

  const executeQuote = useCallback(async () => {
    if (!quote) return
    const requested = parseCreditPoints(amount)
    const available = parseCreditPoints(availablePoints)
    if (requested > available) {
      setInsufficientCredit(true)
      return
    }

    setExecuting(true)
    setInsufficientCredit(false)
    try {
      const idempotencyKey = `desk_buy_${crypto.randomUUID()}`
      const res = await fetch('/api/wallet/desk/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, quoteToken: quote.quoteToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDIT' || data.error === 'INSUFFICIENT_CREDIT') {
          setInsufficientCredit(true)
          return
        }
        throw new Error(data.error ?? 'Execution failed')
      }
      toast({
        title: t('deskExecuteSuccess'),
        description: `${quote.ringAmountUi} ${nativeSymbol}`,
      })
      setQuote(null)
      setAmount('')
      onSuccess?.()
    } catch (error) {
      toast({
        title: t('deskExecuteFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setExecuting(false)
    }
  }, [amount, availablePoints, nativeSymbol, onSuccess, quote, t])

  const handleBuyAmountChange = (value: string) => {
    setAmount(value.replace(/[^\d]/g, ''))
    setInsufficientCredit(false)
  }

  const handleUseAllPoints = () => {
    if (availablePoints === '0') return
    setAmount(availablePoints)
    setInsufficientCredit(false)
  }

  const buyPoints = parseCreditPoints(amount)
  const localPreview =
    buyPoints > 0
      ? previewNativeTokenFromCreditPoints(buyPoints, quote ? parseFloat(quote.rate) : undefined)
      : null

  if (!deskAllowed) {
    const gated = (
      <p className="text-sm text-muted-foreground">
        {t('deskSubscriberRequired', {
          defaultValue:
            'Token Desk (credit → native) is available to subscribers and above. Sign in with a subscriber+ account.',
        })}
      </p>
    )
    if (variant === 'embedded') return gated
    return (
      <DavinciGlassPanel className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ArrowLeftRight className="h-4 w-4" />
          {t('deskTitle', { defaultValue: 'Token Desk' })}
        </div>
        {gated}
      </DavinciGlassPanel>
    )
  }

  const body = (
    <>
      {variant === 'embedded' && (
        <p className="mb-3 text-sm text-muted-foreground">
          {t('deskAvailableBalance', {
            amount: availablePoints,
            unit: creditUnit,
          })}
        </p>
      )}

      <div className="space-y-3">
        <Label htmlFor="desk-buy-amount">{t('deskBuyAmountLabel')}</Label>
        <div className="relative">
          <Input
            id="desk-buy-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="1"
            step="1"
            placeholder="100"
            value={amount}
            onChange={(e) => handleBuyAmountChange(e.target.value)}
            className="pr-[5.5rem]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
            disabled={availablePoints === '0'}
            onClick={handleUseAllPoints}
          >
            {t('deskUseAllPoints', { unit: creditUnit })}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('deskBuyHint', {
            token: nativeSymbol,
            defaultValue: `Spend platform credits to receive ${nativeSymbol} on-chain.`,
          })}
        </p>
      </div>

      {(autoQuote || quote) && (
        <div className="mt-4 space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('deskQuoteLoading')}
            </div>
          ) : quote ? (
            <>
              <p>
                {t('deskQuoteRing')}:{' '}
                <strong>
                  {quote.ringAmountUi} {nativeSymbol}
                </strong>
              </p>
              <p>
                {t('deskQuoteCredit')}:{' '}
                <strong>
                  {formatCreditPoints(quote.creditUsd)} {creditUnit}
                </strong>
              </p>
              {quote.discountBps > 0 && (
                <p className="text-emerald-600">{t('deskFirstSettlerDiscount')}</p>
              )}
            </>
          ) : localPreview && buyPoints > 0 ? (
            <p>
              {t('deskQuoteRing')}:{' '}
              <strong>
                {localPreview} {nativeSymbol}
              </strong>
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!autoQuote && (
          <Button variant="outline" onClick={() => void fetchQuote(amount)} disabled={loading || !amount}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deskGetQuote')}
          </Button>
        )}
        {quote && (
          <Button onClick={() => void executeQuote()} disabled={executing || loading}>
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deskConfirm')}
          </Button>
        )}
      </div>

      {insufficientCredit && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-destructive">{t('deskInsufficientCredit')}</p>
          {onPurchaseCredit && (
            <Button type="button" variant="outline" size="sm" onClick={onPurchaseCredit}>
              {t('deskPurchaseCreditCertificate')}
            </Button>
          )}
        </div>
      )}
    </>
  )

  if (variant === 'embedded') {
    return body
  }

  return (
    <DavinciGlassPanel
      title={t('deskTitle')}
      icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
      beamDuration="10s"
    >
      {body}
    </DavinciGlassPanel>
  )
}
