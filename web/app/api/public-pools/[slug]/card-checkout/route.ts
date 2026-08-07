import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { getPublicPoolConfig, getSiteBaseUrl } from '@/lib/ring-config-core'
import { findPoolBySlug } from '@/features/public-pools/lib/public-pool-db'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  mainCurrencyToNativeTokenUiWithMeta,
  nativeTokenUiToMainCurrencyWithMeta,
  getMainCurrencySymbol,
} from '@/lib/ring-oracle'
import type { SupportedCurrencies } from '@/lib/ring-config-core'

const schema = z.object({
  /** Native UI amount (desk-accounted). Optional if amount_main_currency set. */
  amount_native: z.string().optional(),
  /** Fiat major units in store mainCurrency (card/PayPal charge). */
  amount_main_currency: z.coerce.number().positive().optional(),
  locale: z.string().optional(),
  processor: z.enum(['wayforpay', 'stripe', 'paypal']).optional(),
  return_path: z.string().optional(),
})

/**
 * Card/PayPal checkout for public pool contribution.
 * FX: ring-oracle desk (`nativePerMainCurrency`) — nativeUi = fiat / rate.
 * Native RING donate stays on contributeToPool (not PaymentConductor).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { slug: rawSlug } = await context.params
  const poolSlug = decodeURIComponent(rawSlug || '').trim()
  if (!poolSlug) {
    return NextResponse.json({ error: 'Pool slug required' }, { status: 400 })
  }

  const body = schema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: body.error.flatten() },
      { status: 400 },
    )
  }

  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, poolSlug)
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }
  if (pool.status === 'completed' || pool.status === 'cancelled') {
    return NextResponse.json({ error: 'Pool is closed' }, { status: 400 })
  }

  let amountNativeToken = (body.data.amount_native ?? '').trim()
  let amountMainCurrency = body.data.amount_main_currency
  let nativePerMainCurrency: number | undefined
  let mainCurrency = getMainCurrencySymbol() as SupportedCurrencies

  try {
    if (amountMainCurrency != null && amountMainCurrency > 0) {
      const converted = await mainCurrencyToNativeTokenUiWithMeta(amountMainCurrency)
      amountNativeToken = converted.nativeUi
      nativePerMainCurrency = converted.nativePerMainCurrency
      mainCurrency = converted.mainCurrency as SupportedCurrencies
    } else if (amountNativeToken && parseFloat(amountNativeToken) > 0) {
      const converted = await nativeTokenUiToMainCurrencyWithMeta(amountNativeToken)
      amountMainCurrency = converted.mainCurrencyAmount
      nativePerMainCurrency = converted.nativePerMainCurrency
      mainCurrency = converted.mainCurrency as SupportedCurrencies
    } else {
      return NextResponse.json(
        { error: 'Provide amount_main_currency (card) or amount_native (native UI)' },
        { status: 400 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Oracle conversion failed' },
      { status: 400 },
    )
  }

  if (!(parseFloat(amountNativeToken) > 0) || !(amountMainCurrency! > 0)) {
    return NextResponse.json({ error: 'Invalid contribution amount' }, { status: 400 })
  }

  const locale = (body.data.locale || 'en') as Locale
  const base = getSiteBaseUrl().replace(/\/$/, '')
  const returnPath =
    body.data.return_path?.trim() || ROUTES.DAO_POOL(poolSlug, locale)
  const returnUrl = returnPath.startsWith('http')
    ? returnPath
    : `${base}${returnPath.startsWith('/') ? '' : '/'}${returnPath}`

  const result = await PaymentConductor.createCheckout({
    purpose: 'public_pool_contribution',
    rail: 'card',
    userId: session.user.id,
    userEmail: session.user.email ?? '',
    entityId: pool.id,
    publicPoolId: pool.id,
    publicPoolSlug: pool.pool_slug,
    amountNativeToken,
    amount: amountMainCurrency!,
    currency: mainCurrency,
    returnUrl,
    locale: body.data.locale,
    metadata: {
      purpose: 'public_pool_contribution',
      poolSlug: pool.pool_slug,
      amountNativeToken,
      amountMainCurrency: amountMainCurrency!,
      nativePerMainCurrency,
      mainCurrency,
      publicPoolId: pool.id,
      ...(body.data.processor ? { processor: body.data.processor } : {}),
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Checkout failed' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    redirect: result.redirect,
    paymentUrl: result.paymentUrl,
    paymentFields: result.paymentFields,
    orderReference: result.orderReference,
    amountNativeToken,
    amountMainCurrency,
    nativePerMainCurrency,
    mainCurrency,
  })
}
