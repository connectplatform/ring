'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Coins, Crown, KeyRound, Loader2 } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PayPalIcon } from '@/components/payments/paypal-icon'
import CreditAddFsModal from '@/features/wallet/components/credit-add-fs-modal'
import { listGateTemplatesAction, purchaseGateAction } from '@/app/_actions/nft-gates'
import { initiateMembershipPayment } from '@/app/_actions/membership-payment'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import {
  MEMBERSHIP_DESK_CREDIT_HINT_MIN,
  formatMembershipMainCurrencyAmount,
  getMemberMainCurrencyTierForPeriod,
  getMembershipRingAmountForPeriod,
  getMembershipRingAnnualAmount,
  getMembershipRingUpgradeAmount,
  type MembershipBillingPeriod,
} from '@/lib/membership/pricing'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import { UserRolesArray } from '@/features/auth/user-role'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import type { NftGateSlug } from '@/features/nft-gates/types'
import {
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

const BENEFIT_KEYS = ['entity_creation', 'entity_management', 'premium_access'] as const

type MethodTab = 'card' | 'paypal' | 'native' | 'nft'
type PlanOption = 'monthly' | 'yearly' | 'eternal' | 'nft_month' | 'nft_year'

interface MemberUpgradeGateProps {
  returnTo?: string
  className?: string
}

const paypalEnabled = process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL === 'true'

/**
 * Mobile-first member upgrade gate with Select-method tabs (Card / PayPal / native / NFT).
 * Inline conductors — does not bounce to the legacy PaymentModal as primary flow.
 */
export function MemberUpgradeGate({
  returnTo = '/entities/add',
  className,
}: MemberUpgradeGateProps) {
  const t = useTranslations('modules.membership')
  const tEntities = useTranslations('modules.entities')
  const locale = useLocale() as Locale
  const nativeSymbol = getClientNativeTokenSymbol()
  const creditBalanceUnit = getClientCreditUnitLabel()

  const [method, setMethod] = useState<MethodTab>('card')
  const [plan, setPlan] = useState<PlanOption>('monthly')
  const [nftTabVisible, setNftTabVisible] = useState(false)
  const [nftPrices, setNftPrices] = useState<{ month: number; year: number; eternal: number }>({
    month: 1,
    year: 10,
    eternal: 100,
  })
  const [ringBalance, setRingBalance] = useState(0)
  const [ringLoading, setRingLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [showCreditAdd, setShowCreditAdd] = useState(false)
  const { balance: creditBalanceRaw } = useCreditBalanceContext()
  const creditBalance = Number(creditBalanceRaw ?? 0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setRingLoading(true)
        const res = await fetch('/api/wallet/token/balance', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { balance?: string }
        if (!cancelled) setRingBalance(parseFloat(data.balance ?? '0') || 0)
      } catch {
        if (!cancelled) setRingBalance(0)
      } finally {
        if (!cancelled) setRingLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await listGateTemplatesAction()
      if (cancelled || !result.success) return
      const membership = result.templates.filter((tpl) =>
        ['one-month-membership', 'annual-membership', 'lifetime-membership'].includes(tpl.slug),
      )
      const activated = membership.some((tpl) => Boolean(tpl.activeTemplateAsset))
      setNftTabVisible(activated)
      const month = membership.find((t) => t.slug === 'one-month-membership')?.priceRing ?? 1
      const year = membership.find((t) => t.slug === 'annual-membership')?.priceRing ?? 10
      const eternal = membership.find((t) => t.slug === 'lifetime-membership')?.priceRing ?? 100
      setNftPrices({ month, year, eternal })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (method === 'card' || method === 'paypal') {
      setPlan((p) => (p === 'monthly' || p === 'yearly' ? p : 'monthly'))
    } else if (method === 'native') {
      setPlan((p) =>
        p === 'monthly' || p === 'yearly' || p === 'eternal' ? p : 'monthly',
      )
    } else if (method === 'nft') {
      setPlan((p) => (p === 'nft_month' || p === 'nft_year' ? p : 'nft_month'))
    }
  }, [method])

  const monthlyFiat = useMemo(() => getMemberMainCurrencyTierForPeriod('monthly'), [])
  const yearlyFiat = useMemo(() => getMemberMainCurrencyTierForPeriod('yearly'), [])
  const monthlyRing = getMembershipRingUpgradeAmount()
  const yearlyRing = getMembershipRingAnnualAmount()

  const requiredRing = useMemo(() => {
    if (plan === 'yearly') return yearlyRing
    if (plan === 'eternal') return nftPrices.eternal
    if (plan === 'nft_month') return nftPrices.month
    if (plan === 'nft_year') return nftPrices.year
    return monthlyRing
  }, [plan, yearlyRing, monthlyRing, nftPrices])

  const nftInsufficient = (method === 'nft' || plan === 'eternal') && ringBalance < requiredRing

  const onSubscribe = useCallback(() => {
    setError(null)
    startTransition(async () => {
      try {
        if (method === 'card') {
          const period: MembershipBillingPeriod = plan === 'yearly' ? 'yearly' : 'monthly'
          const fd = new FormData()
          fd.set('targetRole', UserRolesArray.member)
          fd.set('paymentMethod', 'card')
          fd.set('billingPeriod', period)
          fd.set('returnUrl', returnTo.startsWith('http') ? returnTo : `${typeof window !== 'undefined' ? window.location.origin : ''}${returnTo}`)
          const result = await initiateMembershipPayment(null, fd, locale)
          if (result.error) {
            setError(result.error)
            return
          }
          followCheckoutResult({
            redirect: result.redirect,
            paymentUrl: result.paymentUrl,
            paymentFields: result.paymentFields,
          })
          if (result.redirectUrl && !result.paymentUrl && !result.redirect) {
            window.location.href = result.redirectUrl
          }
          return
        }

        if (method === 'paypal') {
          const period: MembershipBillingPeriod = plan === 'yearly' ? 'yearly' : 'monthly'
          // Price comes from the live desk on the server — never send an amount.
          const res = await fetch('/api/membership/payment/paypal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'membership_upgrade',
              auto_subscribe: true,
              billingPeriod: period,
            }),
          })
          const data = await res.json()
          if (!res.ok || !data.paymentUrl) {
            setError(data.error || data.message || 'PayPal checkout failed')
            return
          }
          window.location.href = data.paymentUrl
          return
        }

        if (method === 'native') {
          if (plan === 'eternal') {
            if (ringBalance < nftPrices.eternal) {
              setError(t('gate.nft_need_token', { symbol: nativeSymbol }))
              return
            }
            const purchased = await purchaseGateAction('lifetime-membership' as NftGateSlug)
            if (!purchased.success) {
              setError(purchased.error || 'NFT purchase failed')
              return
            }
            window.location.href = returnTo
            return
          }
          if (ringBalance < requiredRing) {
            setError(t('gate.native_insufficient_short', { symbol: nativeSymbol }))
            return
          }
          const period: MembershipBillingPeriod = plan === 'yearly' ? 'yearly' : 'monthly'
          const amount = String(getMembershipRingAmountForPeriod(period))
          const res = await fetch('/api/membership/payment/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'membership_upgrade',
              amount,
              auto_subscribe: period === 'monthly',
              rail: 'on_chain_ring',
            }),
          })
          const data = await res.json()
          if (!res.ok || data.success === false) {
            setError(data.error || data.message || 'Token payment failed')
            return
          }
          window.location.href = returnTo
          return
        }

        if (method === 'nft') {
          if (nftInsufficient) {
            setError(t('gate.nft_need_token', { symbol: nativeSymbol }))
            return
          }
          const slug = (
            plan === 'nft_year' ? 'annual-membership' : 'one-month-membership'
          ) as NftGateSlug
          const purchased = await purchaseGateAction(slug)
          if (!purchased.success) {
            setError(purchased.error || 'NFT purchase failed')
            return
          }
          window.location.href = returnTo
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Checkout failed')
      }
    })
  }, [
    method,
    plan,
    locale,
    returnTo,
    ringBalance,
    nftPrices.eternal,
    requiredRing,
    nftInsufficient,
    nativeSymbol,
    t,
  ])

  const tabCount =
    1 + (paypalEnabled ? 1 : 0) + 1 + (nftTabVisible ? 1 : 0)

  return (
    <>
      <div className={cn('relative mx-auto w-full max-w-md pt-0 pb-10', className)}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--davinci-beam)_22%,transparent),transparent_70%)]"
          aria-hidden
        />

        <div className="relative space-y-6 px-4 pt-6 text-center sm:px-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]">
            <Crown className="h-8 w-8 text-[var(--davinci-beam)]" aria-hidden />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('gate.title')}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('gate.subtitle')}
            </p>
          </div>

          <ul className="space-y-3 text-left">
            {BENEFIT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]">
                  <Check className="h-3.5 w-3.5 text-[var(--davinci-beam)]" aria-hidden />
                </span>
                <span className="text-sm text-foreground">{t(`modal.benefits.${key}`)}</span>
              </li>
            ))}
          </ul>

          <Tabs
            value={method}
            onValueChange={(v) => setMethod(v as MethodTab)}
            className="w-full text-left"
          >
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('gate.select_method')}
            </p>
            <TabsList
              className={cn(
                'grid h-auto w-full gap-1 bg-transparent p-0',
                tabCount === 4 ? 'grid-cols-4' : tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2',
              )}
            >
              <TabsTrigger
                value="card"
                className="flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 data-[state=active]:border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] data-[state=active]:bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]"
              >
                <Image
                  src="/icons/mc-visa-google-apple-pay.svg"
                  alt=""
                  width={48}
                  height={16}
                  className="h-4 w-auto"
                />
                <span className="text-[10px] font-medium">{t('payment.fiat')}</span>
              </TabsTrigger>
              {paypalEnabled ? (
                <TabsTrigger
                  value="paypal"
                  className="flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 data-[state=active]:border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] data-[state=active]:bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]"
                >
                  <PayPalIcon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">PayPal</span>
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="native"
                className="flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 data-[state=active]:border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] data-[state=active]:bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]"
              >
                <Coins className="h-4 w-4 text-[var(--davinci-beam)]" />
                <span className="text-[10px] font-medium">{nativeSymbol}</span>
              </TabsTrigger>
              {nftTabVisible ? (
                <TabsTrigger
                  value="nft"
                  className="flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 data-[state=active]:border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] data-[state=active]:bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]"
                >
                  <KeyRound className="h-4 w-4 text-[var(--davinci-beam)]" />
                  <span className="text-[10px] font-medium">NFT</span>
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="card" className="mt-4 space-y-3">
              <PlanCard
                checked={plan === 'monthly'}
                onSelect={() => setPlan('monthly')}
                title={`${formatMembershipMainCurrencyAmount(monthlyFiat)} ${t('gate.fiat_period')}`}
                hint={t('gate.plan_monthly_hint')}
              />
              <PlanCard
                checked={plan === 'yearly'}
                onSelect={() => setPlan('yearly')}
                title={`${formatMembershipMainCurrencyAmount(yearlyFiat)} ${t('gate.fiat_period_year')}`}
                hint={t('gate.plan_annual_off')}
              />
            </TabsContent>

            {paypalEnabled ? (
              <TabsContent value="paypal" className="mt-4 space-y-3">
                <PlanCard
                  checked={plan === 'monthly'}
                  onSelect={() => setPlan('monthly')}
                  title={`${formatMembershipMainCurrencyAmount(monthlyFiat)} ${t('gate.fiat_period')}`}
                  hint={t('gate.plan_monthly_hint')}
                />
                <PlanCard
                  checked={plan === 'yearly'}
                  onSelect={() => setPlan('yearly')}
                  title={`${formatMembershipMainCurrencyAmount(yearlyFiat)} ${t('gate.fiat_period_year')}`}
                  hint={t('gate.plan_annual_off')}
                />
              </TabsContent>
            ) : null}

            <TabsContent value="native" className="mt-4 space-y-3">
              <PlanCard
                checked={plan === 'monthly'}
                onSelect={() => setPlan('monthly')}
                title={`${monthlyRing} ${nativeSymbol} ${t('gate.fiat_period')}`}
                hint={t('gate.plan_monthly_hint')}
              />
              <PlanCard
                checked={plan === 'yearly'}
                onSelect={() => setPlan('yearly')}
                title={`${yearlyRing} ${nativeSymbol} ${t('gate.fiat_period_year')}`}
                hint={t('gate.plan_annual_off')}
              />
              <PlanCard
                checked={plan === 'eternal'}
                onSelect={() => setPlan('eternal')}
                title={t('gate.eternal_nft', {
                  amount: nftPrices.eternal,
                  symbol: nativeSymbol,
                })}
                hint={t('gate.eternal_hint')}
              />
              {!ringLoading && ringBalance < requiredRing && plan !== 'eternal' ? (
                <NativeBalanceHint
                  creditBalance={creditBalance}
                  creditBalanceUnit={creditBalanceUnit}
                  nativeSymbol={nativeSymbol}
                  onBuyCredit={() => setShowCreditAdd(true)}
                />
              ) : null}
              {!ringLoading && plan === 'eternal' && ringBalance < nftPrices.eternal ? (
                <p className="text-xs text-muted-foreground">
                  {t('gate.nft_need_token', { symbol: nativeSymbol })}
                </p>
              ) : null}
            </TabsContent>

            {nftTabVisible ? (
              <TabsContent value="nft" className="mt-4 space-y-3">
                <PlanCard
                  checked={plan === 'nft_month'}
                  onSelect={() => setPlan('nft_month')}
                  disabled={ringBalance < nftPrices.month}
                  title={t('gate.nft_month', {
                    amount: nftPrices.month,
                    symbol: nativeSymbol,
                  })}
                  hint={t('gate.nft_month_off')}
                />
                <PlanCard
                  checked={plan === 'nft_year'}
                  onSelect={() => setPlan('nft_year')}
                  disabled={ringBalance < nftPrices.year}
                  title={t('gate.nft_year', {
                    amount: nftPrices.year,
                    symbol: nativeSymbol,
                  })}
                  hint={t('gate.nft_year_off')}
                />
                {nftInsufficient ? (
                  <p className="text-xs text-muted-foreground">
                    {t('gate.nft_need_token', { symbol: nativeSymbol })}
                  </p>
                ) : null}
              </TabsContent>
            ) : null}
          </Tabs>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="space-y-3">
            <Button
              type="button"
              disabled={pending || (method === 'nft' && nftInsufficient)}
              className={cn(davinciCtaPrimary, 'h-12 w-full gap-2 text-base font-semibold')}
              onClick={onSubscribe}
              data-testid="button-member-upgrade-gate-subscribe"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crown className="h-4 w-4 text-[var(--davinci-beam)]" aria-hidden />
              )}
              {method === 'nft' && nftInsufficient
                ? t('gate.nft_need_token', { symbol: nativeSymbol })
                : t('gate.subscribe_now')}
            </Button>

            <Link
              href="/entities"
              className="inline-flex w-full items-center justify-center py-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t('gate.continue_free')}
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">{t('gate.cancel_anytime')}</p>
          <p className="sr-only">{tEntities('subscriberUpgradeMessage')}</p>
        </div>
      </div>

      <CreditAddFsModal open={showCreditAdd} onOpenChange={setShowCreditAdd} />
    </>
  )
}

function NativeBalanceHint({
  creditBalance,
  creditBalanceUnit,
  nativeSymbol,
  onBuyCredit,
}: {
  creditBalance: number
  creditBalanceUnit: string
  nativeSymbol: string
  onBuyCredit: () => void
}) {
  const t = useTranslations('modules.membership')

  if (creditBalance >= MEMBERSHIP_DESK_CREDIT_HINT_MIN) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('gate.no_token_has_credit', {
          symbol: nativeSymbol,
          credit: creditBalance,
          unit: creditBalanceUnit,
        })}{' '}
        <Link
          href="/wallet/topup"
          className="font-medium text-[var(--davinci-beam)] underline-offset-2 hover:underline"
        >
          {t('gate.visit_desk', { symbol: nativeSymbol })}
        </Link>
      </p>
    )
  }

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {t('gate.token_insufficient_buy_credit', {
        symbol: nativeSymbol,
        unit: creditBalanceUnit,
      })}{' '}
      <button
        type="button"
        onClick={onBuyCredit}
        className="font-medium text-[var(--davinci-beam)] underline-offset-2 hover:underline"
      >
        {t('gate.buy_credit', { unit: creditBalanceUnit, symbol: nativeSymbol })}
      </button>
    </p>
  )
}

function PlanCard({
  checked,
  onSelect,
  title,
  hint,
  disabled,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  hint: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        davinciGlassSurface,
        checked && davinciBeamInnerSurface,
        'relative w-full p-4 text-left transition',
        checked &&
          'border-[color-mix(in_oklch,var(--davinci-beam)_55%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold tabular-nums text-foreground">{title}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            checked
              ? 'border-[var(--davinci-beam)] bg-[var(--davinci-beam)]'
              : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {checked ? <span className="h-2 w-2 rounded-full bg-background" /> : null}
        </span>
      </div>
    </button>
  )
}
