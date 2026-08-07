export type PaymentPurpose =
  | 'store_order'
  | 'membership_upgrade'
  | 'news_promotion'
  | 'wallet_topup'
  /** Confidential+ card/PayPal → treasury RING (CONFIDENTIAL_TOKEN_ONRAMP). */
  | 'native_token_onramp'
  /** Calculator ringization deposit → CRM project_orders. */
  | 'project_order'
  /** Chat task escrow hold / release. */
  | 'task_escrow'
  /** Collective-order prepaid slot (Groupon-style). */
  | 'collective_order_slot'
  /** Scheduled-services paid slot hold (after collective_order path is green). */
  | 'scheduled_service_slot'
  /** Fiat/card chip-in to public pool (DAO jar) — bumps pledged_native_token; not native donate. */
  | 'public_pool_contribution'

/**
 * **Rail** — the user-facing payment choice. This is what the buyer picks and what
 * we persist on the order. A rail is never a PSP id: `card` may settle through
 * WayForPay or Stripe depending on `payment.cardPaymentProcessor` / purpose env.
 */
export type PaymentRail = 'card' | 'paypal' | 'credit_balance' | 'native_token'

/** Card-rail PSPs — resolved by `getPaymentProvider(purpose)`, never shown in UI. */
export type PaymentCardProcessorId = 'wayforpay' | 'stripe'

/**
 * External PSPs that expose webhook endpoints (`/api/payments/{id}/webhook`).
 * Subset of PaymentProcessorId — excludes internal rails that settle in-process.
 */
export type ExternalPaymentProcessorId = PaymentCardProcessorId | 'paypal'

/**
 * **Processor** — who actually moves the money, persisted on the ledger row.
 * External PSPs for the `card` / `paypal` rails; the internal rails settle
 * synchronously inside `createCheckout` and record themselves as the processor.
 */
export type PaymentProcessorId =
  | ExternalPaymentProcessorId
  | 'credit_balance'
  | 'native_token'

export const PAYMENT_RAILS: readonly PaymentRail[] = [
  'card',
  'paypal',
  'credit_balance',
  'native_token',
] as const

/**
 * Coerce any historical/UI payment id into a rail.
 * PSP ids (`wayforpay`, `stripe`) collapse into `card`; the processor is resolved
 * by the Conductor, never by the caller. `ring`/`crypto` are pre-SSOT aliases.
 */
export function normalizePaymentRail(value: unknown, fallback: PaymentRail = 'card'): PaymentRail {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  switch (raw) {
    case 'card':
      return 'card'
    case 'paypal':
      return 'paypal'
    case 'credit_balance':
      return 'credit_balance'
    case 'native_token':
      return 'native_token'
    // A PSP id arriving where a rail is expected always means the card rail.
    case 'wayforpay':
    case 'stripe':
      return 'card'
    default:
      return fallback
  }
}

/** Processor persisted alongside the rail when the caller already knows the PSP. */
export function normalizePaymentProcessor(value: unknown): PaymentProcessorId | undefined {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  switch (raw) {
    case 'wayforpay':
    case 'stripe':
    case 'paypal':
    case 'credit_balance':
    case 'native_token':
      return raw
    default:
      return undefined
  }
}

export type PaymentTransactionStatus =
  | 'created'
  | 'redirected'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'

/**
 * Processor-agnostic checkout handoff for the browser.
 * - navigate: Stripe Checkout, PayPal approve, WFP invoiceUrl, etc.
 * - form_post: Hosted payment pages that require HTML form POST (e.g. WFP HPP).
 * Clients must only call followCheckoutRedirect() — never PSP-branded helpers.
 */
export type CheckoutRedirectMode = 'navigate' | 'form_post'

export interface CheckoutRedirect {
  mode: CheckoutRedirectMode
  url: string
  /** Required when mode === 'form_post' */
  fields?: Record<string, string | string[]>
}

export interface CreateCheckoutContext {
  purpose: PaymentPurpose
  rail?: PaymentRail
  userId: string
  userEmail: string
  entityId: string
  amount: number
  currency: string
  returnUrl: string
  locale?: string
  metadata?: Record<string, unknown>
  /** Store checkout */
  orderId?: string
  items?: unknown[]
  shippingInfo?: Record<string, unknown>
  /** Membership */
  targetRole?: string
  /** News */
  articleId?: string
  /** Calculator / CRM project order */
  projectOrderId?: string
  /** Chat task escrow document id */
  taskEscrowId?: string
  /** Collective-order slot escrow document id */
  collectiveOrderEscrowId?: string
  /** Public pool (DAO jar) card contribution */
  publicPoolId?: string
  publicPoolSlug?: string
  /** RING units to credit to pledged_native_token (may differ from fiat amount) */
  amountNativeToken?: string
}

export interface CreateCheckoutResult {
  success: boolean
  /** Conductor-owned browser handoff (preferred). */
  redirect?: CheckoutRedirect
  /**
   * @deprecated Prefer `redirect.url`. Mirrored by PaymentConductor.normalize for legacy APIs.
   */
  paymentUrl?: string
  /**
   * @deprecated Prefer `redirect.fields` when mode is form_post.
   */
  paymentFields?: Record<string, string | string[]>
  orderReference?: string
  paid?: boolean
  /** On-chain transfer hash when rail is native_token */
  txHash?: string
  error?: string
  /** Structured code for UI (e.g. PAYPAL_NOT_IMPLEMENTED) */
  code?: string
}

/** Build a GET/location redirect (Stripe, PayPal, invoice URLs). */
export function navigateCheckoutRedirect(url: string): CheckoutRedirect {
  return { mode: 'navigate', url }
}

/** Build an HTML form POST redirect (HPP-style gateways). */
export function formPostCheckoutRedirect(
  url: string,
  fields: Record<string, string | string[]>,
): CheckoutRedirect {
  return { mode: 'form_post', url, fields }
}

/**
 * Ensure `redirect` is set and mirror legacy paymentUrl/paymentFields.
 * Call at PaymentConductor.createCheckout boundary so processors may set either shape.
 */
export function normalizeCheckoutResult(result: CreateCheckoutResult): CreateCheckoutResult {
  if (!result.success) return result

  let redirect = result.redirect
  if (!redirect) {
    if (result.paymentFields && Object.keys(result.paymentFields).length > 0) {
      if (!result.paymentUrl) return result
      redirect = formPostCheckoutRedirect(result.paymentUrl, result.paymentFields)
    } else if (result.paymentUrl) {
      redirect = navigateCheckoutRedirect(result.paymentUrl)
    }
  }

  if (!redirect) return result

  return {
    ...result,
    redirect,
    paymentUrl: result.paymentUrl ?? redirect.url,
    paymentFields: result.paymentFields ?? redirect.fields,
  }
}

export interface WebhookHandleResult {
  success: boolean
  purpose?: PaymentPurpose
  membershipAck?: {
    orderReference: string
    status: 'accept'
    time: number
    signature: string
  }
  error?: string
}
