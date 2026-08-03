'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Loader2, ArrowLeftRight, CreditCard } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DavinciGlassPanel } from '@/lib/ui/davinci'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
  getClientSiteName,
  previewNativeTokenFromCreditPoints,
} from '@/lib/ring-config-client'
import { formatCreditPoints, parseCreditPoints } from '@/lib/wallet/format-credit-points'
import { canUseTokenDeskClient } from '@/lib/payments/confidential-token-onramp-client'
import { useAuth } from '@/hooks/use-auth'
import { UserRolesArray } from '@/features/auth/user-role'

type DeskQuote = {
  side: 'buy'
  ringAmountUi: string
  creditBalanceAmount: string
  mainCurrency: string
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
  const creditBalanceUnit = getClientCreditUnitLabel()
  const projectName = getClientSiteName()
  const availablePoints = formatCreditPoints(creditBalancePoints)
  const availableNum = parseCreditPoints(availablePoints)
  const hasCredit = availableNum > 0

  const [amount, setAmount] = useState(() =>
    hasCredit ? formatCreditPoints(initialAmount) : '',
  )
  const [quote, setQuote] = useState<DeskQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [insufficientCredit, setInsufficientCredit] = useState(false)
  const quoteRequestId = useRef(0)

  useEffect(() => {
    if (!hasCredit) {
      setAmount('')
      setQuote(null)
      setInsufficientCredit(false)
      return
    }
    const next = formatCreditPoints(initialAmount)
    const nextNum = parseCreditPoints(next)
    setAmount(nextNum > 0 && nextNum <= availableNum ? next : availablePoints)
    setQuote(null)
    setInsufficientCredit(false)
  }, [initialAmount, hasCredit, availableNum, availablePoints])

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
    if (!autoQuote || !hasCredit) return
    const timer = window.setTimeout(() => {
      void fetchQuote(amount)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [amount, autoQuote, fetchQuote, hasCredit])

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
    const digits = value.replace(/[^\d]/g, '')
    setAmount(digits)
    setInsufficientCredit(false)
  }

  const handleUseMax = () => {
    if (!hasCredit) return
    setAmount(availablePoints)
    setInsufficientCredit(false)
  }

  const handleSliderChange = (values: number[]) => {
    const next = Math.max(0, Math.min(availableNum, Math.round(values[0] ?? 0)))
    setAmount(next > 0 ? String(next) : '')
    setInsufficientCredit(false)
  }

  const buyPoints = parseCreditPoints(amount)
  const sliderValue = useMemo(
    () => Math.max(0, Math.min(availableNum, buyPoints)),
    [availableNum, buyPoints],
  )
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

  if (!hasCredit) {
    const empty = (
      <div className="space-y-4 py-2 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('deskNoCreditTitle')}</p>
          <p className="text-sm text-muted-foreground">
            {t('deskNoCreditHint', { project: projectName, unit: creditBalanceUnit })}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('deskNoCreditOr')}</p>
        </div>
        {onPurchaseCredit ? (
          <Button type="button" className="w-full gap-2" onClick={onPurchaseCredit}>
            <CreditCard className="h-4 w-4" />
            {t('deskBuyCreditUnit', { unit: creditBalanceUnit })}
          </Button>
        ) : null}
      </div>
    )
    if (variant === 'embedded') return empty
    return (
      <DavinciGlassPanel
        title={t('deskTitle')}
        icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
        beamDuration="10s"
      >
        {empty}
      </DavinciGlassPanel>
    )
  }

  const body = (
    <>
      {variant === 'embedded' && (
        <p className="mb-3 text-sm text-muted-foreground">
          {t('deskAvailableBalance', {
            amount: availablePoints,
            unit: creditBalanceUnit,
          })}
        </p>
      )}

      <div className="space-y-3">
        <Label htmlFor="desk-buy-amount">{t('deskBuyAmountLabel')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="desk-buy-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="100"
            value={amount}
            onChange={(e) => handleBuyAmountChange(e.target.value)}
            className="w-[6.5rem] shrink-0 tabular-nums"
            aria-label={t('deskBuyAmountLabel')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-2.5 text-xs"
            disabled={!hasCredit}
            onClick={handleUseMax}
          >
            {t('deskMax')}
          </Button>
          <span className="text-sm text-muted-foreground">{creditBalanceUnit}</span>
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
                  {formatCreditPoints(quote.creditBalanceAmount)} {creditBalanceUnit}
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

      <div className="mt-4 space-y-2">
        <Slider
          min={0}
          max={Math.max(availableNum, 1)}
          step={1}
          value={[sliderValue]}
          onValueChange={handleSliderChange}
          disabled={!hasCredit}
          aria-label={t('deskBuyAmountLabel')}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>
            {availablePoints} {creditBalanceUnit}
          </span>
        </div>
      </div>

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
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              {t('deskBuyCreditUnit', { unit: creditBalanceUnit })}
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
