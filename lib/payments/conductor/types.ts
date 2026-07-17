export type PaymentPurpose =
  | 'store_order'
  | 'membership_upgrade'
  | 'news_promotion'
  | 'wallet_topup'
  /** Confidential+ card/PayPal → treasury RING (CONFIDENTIAL_TOKEN_ONRAMP). */
  | 'native_token_onramp'
  /** Calculator ringization deposit → CRM project_orders. */
  | 'project_order'

export type PaymentRail = 'merchant_redirect' | 'internal_credit' | 'native_token'

export type PaymentProcessorId =
  | 'wayforpay'
  | 'stripe'
  | 'internal-credit'
  | 'native-token'
  | 'paypal'

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
