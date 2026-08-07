import 'server-only'

import { crc32 } from 'zlib'
import { createVerify } from 'crypto'
import { getSystemConfigSnapshot, getMainCurrencySymbol } from '@/lib/ring-config-core'
import { logger } from '@/lib/logger'

type CachedToken = { accessToken: string; expiresAtMs: number }

let cachedToken: CachedToken | null = null

export function isPayPalCredentialsConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim())
}

export function isPayPalGatewayEnabled(): boolean {
  const gw = getSystemConfigSnapshot().payment?.gateways?.paypal as
    | { enabled?: boolean; currency?: string }
    | undefined
  return Boolean(gw?.enabled) && isPayPalCredentialsConfigured()
}

export function getPayPalGatewayCurrency(): string {
  const gw = getSystemConfigSnapshot().payment?.gateways?.paypal as { currency?: string } | undefined
  if (gw?.currency?.trim()) return gw.currency.trim().toUpperCase()
  return getMainCurrencySymbol()
}

function paypalBaseUrl(): string {
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase()
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

function isTrustedPayPalCertHost(certUrl: string): boolean {
  try {
    const host = new URL(certUrl).hostname.toLowerCase()
    return (
      host === 'api.paypal.com' ||
      host === 'api.sandbox.paypal.com' ||
      host.endsWith('.paypal.com')
    )
  } catch {
    return false
  }
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !secret) {
    throw new Error('PayPal not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)')
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.accessToken
  }

  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error('PayPal OAuth failed', { status: res.status, text: text.slice(0, 300) })
    throw new Error(`PayPal OAuth failed (${res.status})`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedToken.accessToken
}

export async function paypalApiFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const token = await getPayPalAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.idempotencyKey) {
    headers['PayPal-Request-Id'] = init.idempotencyKey
  }

  let res = await fetch(`${paypalBaseUrl()}${path}`, { ...init, headers })
  if (res.status === 401) {
    cachedToken = null
    const retryToken = await getPayPalAccessToken()
    headers.Authorization = `Bearer ${retryToken}`
    res = await fetch(`${paypalBaseUrl()}${path}`, { ...init, headers })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PayPal API ${path} failed (${res.status}): ${text.slice(0, 400)}`)
  }

  if (res.status === 204) return {} as T
  return (await res.json()) as T
}

export type PayPalLink = { href: string; rel: string; method?: string }

export function extractPayPalApproveUrl(links: PayPalLink[] | undefined): string | undefined {
  if (!Array.isArray(links)) return undefined
  const approve = links.find((l) => l.rel === 'approve' || l.rel === 'payer-action')
  return approve?.href
}

/**
 * Verify PayPal webhook transmission (self-verify preferred).
 * message = transmissionId|time|WEBHOOK_ID|crc32(rawBody as decimal)
 */
export async function verifyPayPalWebhook(
  rawBody: string,
  headers: {
    transmissionId: string
    transmissionTime: string
    transmissionSig: string
    certUrl: string
    authAlgo: string
  },
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim()
  if (!webhookId) {
    logger.warn('PayPal webhook: PAYPAL_WEBHOOK_ID missing')
    return false
  }
  if (!isTrustedPayPalCertHost(headers.certUrl)) {
    logger.warn('PayPal webhook: untrusted cert host', { certUrl: headers.certUrl })
    return false
  }

  try {
    const crc = crc32(Buffer.from(rawBody, 'utf8')) >>> 0
    const message = `${headers.transmissionId}|${headers.transmissionTime}|${webhookId}|${crc}`
    const certRes = await fetch(headers.certUrl)
    if (!certRes.ok) return false
    const certPem = await certRes.text()
    const verifier = createVerify(headers.authAlgo?.includes('SHA256') ? 'SHA256' : 'SHA256')
    verifier.update(message)
    verifier.end()
    return verifier.verify(certPem, Buffer.from(headers.transmissionSig, 'base64'))
  } catch (error) {
    logger.error('PayPal webhook self-verify failed', { error })
    return false
  }
}

export function formatPayPalAmountValue(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  return amount.toFixed(2)
}

// ---------------------------------------------------------------------------
// Subscriptions v1 — Product / Plan / Subscription lifecycle
// @see paypal-payment-conductor-processor.nodus.json → subscriptions_v1
// ---------------------------------------------------------------------------

export type PayPalBillingSubscription = {
  id: string
  status?: string
  custom_id?: string
  plan_id?: string
  links?: PayPalLink[]
  billing_info?: {
    next_billing_time?: string
    last_payment?: { amount?: { value?: string; currency_code?: string } }
  }
}

async function ensurePayPalMembershipProduct(): Promise<string> {
  const cached = process.env.PAYPAL_MEMBERSHIP_PRODUCT_ID?.trim()
  if (cached) return cached

  const product = await paypalApiFetch<{ id: string }>('/v1/catalogs/products', {
    method: 'POST',
    idempotencyKey: `ring-membership-product-${getPayPalGatewayCurrency()}`,
    body: JSON.stringify({
      name: 'Ring Platform Membership',
      description: 'Monthly Ring Platform membership subscription',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  })

  if (!product.id) throw new Error('PayPal product create returned no id')
  logger.info('PayPal membership product created — cache as PAYPAL_MEMBERSHIP_PRODUCT_ID', {
    productId: product.id,
  })
  return product.id
}

async function ensurePayPalMembershipPlan(opts: {
  amount: number
  currency: string
  /** MONTH (default) or YEAR — separate env cache keys. */
  intervalUnit?: 'MONTH' | 'YEAR'
}): Promise<string> {
  const intervalUnit = opts.intervalUnit ?? 'MONTH'
  const cachedEnv =
    intervalUnit === 'YEAR'
      ? process.env.PAYPAL_MEMBERSHIP_PLAN_ID_YEARLY?.trim()
      : process.env.PAYPAL_MEMBERSHIP_PLAN_ID?.trim()
  if (cachedEnv) return cachedEnv

  const productId = await ensurePayPalMembershipProduct()
  const currency = opts.currency.toUpperCase()
  const value = formatPayPalAmountValue(opts.amount)
  const periodLabel = intervalUnit === 'YEAR' ? 'yr' : 'mo'
  const periodName = intervalUnit === 'YEAR' ? 'Yearly' : 'Monthly'

  const plan = await paypalApiFetch<{ id: string }>('/v1/billing/plans', {
    method: 'POST',
    idempotencyKey: `ring-membership-plan-${intervalUnit}-${currency}-${value}`,
    body: JSON.stringify({
      product_id: productId,
      name: `Ring Membership ${currency} ${value}/${periodLabel}`,
      description: `${periodName} membership billing`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value, currency_code: currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  })

  if (!plan.id) throw new Error('PayPal plan create returned no id')
  const cacheHint =
    intervalUnit === 'YEAR' ? 'PAYPAL_MEMBERSHIP_PLAN_ID_YEARLY' : 'PAYPAL_MEMBERSHIP_PLAN_ID'
  logger.info(`PayPal membership plan created — cache as ${cacheHint}`, {
    planId: plan.id,
    productId,
    currency,
    value,
    intervalUnit,
  })
  return plan.id
}

/**
 * Create a PayPal Subscriptions v1 subscription and return approve URL + I-… id.
 * SSOT: paypalApiFetch + extractPayPalApproveUrl (same as one-shot order approve flow).
 */
export async function createPayPalBillingSubscription(opts: {
  amount: number
  currency: string
  customId: string
  returnUrl: string
  cancelUrl?: string
  userEmail?: string
  idempotencyKey?: string
  /** MONTH (default) or YEAR plan. */
  intervalUnit?: 'MONTH' | 'YEAR'
}): Promise<{ subscriptionId: string; approveUrl: string; planId: string }> {
  const currency = opts.currency.toUpperCase()
  const planId = await ensurePayPalMembershipPlan({
    amount: opts.amount,
    currency,
    intervalUnit: opts.intervalUnit ?? 'MONTH',
  })

  const returnUrl = opts.returnUrl
  const cancelUrl = opts.cancelUrl || returnUrl

  const body: Record<string, unknown> = {
    plan_id: planId,
    custom_id: opts.customId,
    application_context: {
      brand_name: 'Ring Platform',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  }
  if (opts.userEmail) {
    body.subscriber = { email_address: opts.userEmail }
  }

  const sub = await paypalApiFetch<PayPalBillingSubscription>('/v1/billing/subscriptions', {
    method: 'POST',
    idempotencyKey: opts.idempotencyKey || opts.customId,
    body: JSON.stringify(body),
  })

  if (!sub.id) {
    throw new Error('PayPal subscription create returned no id')
  }
  const approveUrl = extractPayPalApproveUrl(sub.links)
  if (!approveUrl) {
    throw new Error('PayPal subscription missing approve link')
  }

  return {
    subscriptionId: sub.id,
    approveUrl,
    planId,
  }
}

export async function cancelPayPalBillingSubscription(
  subscriptionId: string,
  reason = 'User requested cancellation',
): Promise<void> {
  await paypalApiFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function getPayPalBillingSubscription(
  subscriptionId: string,
): Promise<PayPalBillingSubscription> {
  return paypalApiFetch<PayPalBillingSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: 'GET' },
  )
}
