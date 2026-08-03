'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Coins, CreditCard, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOptionalCreditBalance } from '@/components/providers/credit-balance-provider'
import { getClientNativeTokenSymbol, getClientMainCurrency } from '@/lib/ring-config-client'
import { contributeToPoolClient, contributeToPoolCardClient } from '@/features/public-pools/actions/public-pool-client'
import { followCheckoutRedirect } from '@/lib/payments/checkout-redirect'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

export type PoolContributePanelProps = {
  poolSlug: string
  locale: Locale
  /** Called after successful native chip-in (optional jar meta refresh). */
  onNativeTokenSuccess?: () => void | Promise<void>
  /** Builder need blurb — keep short. */
  needSummary?: string
  className?: string
  /** When false, hide cancel (parent controls open state). */
  onCancel?: () => void
}

/**
 * Universal dual-rail jar CTA:
 * - Card/PayPal: amount in store fiat (desk oracle → pledged native)
 * - Native: amount in native token symbol; enabled when live balance allows
 * Capacity hint from credit points + /api/wallet/balance.
 */
export function PoolContributePanel({
  poolSlug,
  locale,
  onNativeTokenSuccess,
  needSummary,
  className,
  onCancel,
}: PoolContributePanelProps) {
  const tokenSymbol = getClientNativeTokenSymbol()
  const mainCurrency = getClientMainCurrency()
  const credit = useOptionalCreditBalance()
  const creditBalanceUnit = credit?.balance?.amount ?? null

  const [nativeTokenBalance, setNativeTokenBalance] = useState<string | null>(null)
  const [oracleHint, setOracleHint] = useState<string | null>(null)
  const [mode, setMode] = useState<'native_token' | 'main_currency'>('native_token')
  const [amount, setAmount] = useState('1')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/wallet/balance', { credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as { balance?: { amount?: string | number } | string | number }
        const raw = json.balance
        const amt =
          typeof raw === 'object' && raw && 'amount' in raw
            ? String(raw.amount)
            : raw != null
              ? String(raw)
              : null
        if (!cancelled) setNativeTokenBalance(amt)
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // GET returns desk rates as ValueDenomination pairs (native_token ↔ main_currency).
        const res = await fetch('/api/prices/conversion', { credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as {
          current_rates?: Array<{ from: string; to: string; rate: string; inverse_rate: string }>
        }
        const row = json.current_rates?.find(
          (r) => r.from === mainCurrency && r.to === tokenSymbol,
        )
        if (!cancelled && row?.rate) {
          setOracleHint(`1 ${mainCurrency} ≈ ${row.rate} ${tokenSymbol}`)
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mainCurrency, tokenSymbol])

  const nativeTokenAvail = useMemo(() => {
    const n = nativeTokenBalance != null ? parseFloat(nativeTokenBalance) : NaN
    return Number.isFinite(n) ? n : null
  }, [nativeTokenBalance])

  const canNativeToken = nativeTokenAvail == null || nativeTokenAvail >= parseFloat(amount || '0')
  const creditAvail = creditBalanceUnit != null ? parseFloat(creditBalanceUnit) : null

  const onNative = useCallback(() => {
    if (pending) return
    setError(null)
    startTransition(async () => {
      try {
        const key =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `chip-${Date.now()}`
        await contributeToPoolClient(poolSlug, amount, key, 'donation')
        toast({ title: `${tokenSymbol} contribution sent` })
        await onNativeTokenSuccess?.()
        onCancel?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Contribution failed'
        setError(msg)
        toast({ title: msg, variant: 'destructive' })
      }
    })
  }, [amount, onCancel, onNativeTokenSuccess, pending, poolSlug, tokenSymbol])

  const onCard = useCallback(() => {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const mainCurrencyAmount = mode === 'main_currency' ? parseFloat(amount) : undefined
      const nativeAmount = mode === 'native_token' ? amount : undefined
      const result = await contributeToPoolCardClient(poolSlug, nativeAmount ?? '0', {
        amountMainCurrency: mainCurrencyAmount,
        locale,
      })
      if (!result.success) {
        setError(result.error ?? 'Card checkout failed')
        toast({ title: result.error ?? 'Card checkout failed', variant: 'destructive' })
        return
      }
      if (result.redirect) {
        followCheckoutRedirect(result.redirect)
        return
      }
      if (result.paymentUrl) {
        followCheckoutRedirect({ mode: 'navigate', url: result.paymentUrl })
        return
      }
      toast({ title: 'No payment redirect returned', variant: 'destructive' })
    })
  }, [amount, locale, mode, pending, poolSlug])

  return (
    <div className={className ?? 'space-y-2 rounded-md border border-border/50 bg-muted/20 p-2'}>
      {needSummary ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{needSummary}</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Wallet className="h-3 w-3" aria-hidden />
          {tokenSymbol}: {nativeTokenBalance ?? '…'}
        </span>
        <span className="inline-flex items-center gap-1">
          Credit: {creditBalanceUnit ?? '…'}
          {creditAvail != null && Number.isFinite(creditAvail) ? ` pts` : ''}
        </span>
        {oracleHint ? <span>{oracleHint}</span> : null}
      </div>

      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === 'native_token' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => setMode('native_token')}
        >
          {tokenSymbol}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'main_currency' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => setMode('main_currency')}
        >
          {mainCurrency}
        </Button>
      </div>

      <input
        type="number"
        min="0.00000001"
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        aria-label={mode === 'main_currency' ? `${mainCurrency} amount` : `${tokenSymbol} amount`}
        placeholder={mode === 'main_currency' ? mainCurrency : tokenSymbol}
      />

      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {mode === 'native_token' ? (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={pending || !canNativeToken}
            onClick={onNative}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
            Send {tokenSymbol}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1 text-xs"
          disabled={pending}
          onClick={onCard}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Pay {mainCurrency}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <p className="text-[10px] opacity-70">
        Card/PayPal charge in {mainCurrency} (desk oracle → {tokenSymbol} pledged). Native sends{' '}
        {tokenSymbol} to treasury. Full jar pays builder wallet net of platform fee.
      </p>
    </div>
  )
}

export default PoolContributePanel
