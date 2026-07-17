'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import type { CalculatorInputs } from '@/features/calculator/types'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Loader2 } from 'lucide-react'

export function OrderThisBuildButton({ inputs, disabled }: { inputs: CalculatorInputs; disabled?: boolean }) {
  const t = useTranslations('calculator')
  const locale = useLocale() as Locale
  const { status } = useSession()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onOrder = () => {
    setError(null)
    if (status !== 'authenticated') {
      router.push(ROUTES.LOGIN(locale))
      return
    }

    startTransition(async () => {
      try {
        const createRes = await fetch('/api/calculator/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputs),
        })
        const createJson = await createRes.json()
        if (!createRes.ok || !createJson.orderId) {
          throw new Error(createJson.error || 'Failed to create order')
        }
        router.push(ROUTES.CALCULATOR_CHECKOUT(locale, createJson.orderId))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Order failed')
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={disabled || pending} onClick={onOrder} size="lg">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('actions.orderThisBuild', { defaultValue: 'Order this build' })}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function PayProjectOrderButtons({ orderId }: { orderId: string }) {
  const t = useTranslations('calculator')
  const locale = useLocale() as Locale
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const pay = (rail?: 'merchant_redirect' | 'internal_credit') => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/calculator/orders/${orderId}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rail, locale }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Checkout failed')
        if (json.paid) {
          router.push(ROUTES.CALCULATOR_SUCCESS(locale, orderId))
          return
        }
        followCheckoutResult({
          redirect: json.redirect,
          paymentUrl: json.paymentUrl,
          paymentFields: json.paymentFields,
        })
        return
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Payment failed')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button disabled={pending} onClick={() => pay('merchant_redirect')} size="lg">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('checkout.payCard', { defaultValue: 'Pay with card' })}
      </Button>
      <Button disabled={pending} onClick={() => pay('internal_credit')} size="lg" variant="outline">
        {t('checkout.payCredit', { defaultValue: 'Pay with credits' })}
      </Button>
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
