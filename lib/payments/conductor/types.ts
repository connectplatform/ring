export type PaymentPurpose =
  | 'store_order'
  | 'membership_upgrade'
  | 'news_promotion'
  | 'wallet_topup'
  /** Confidential+ card/PayPal → treasury RING (CONFIDENTIAL_TOKEN_ONRAMP). */
  | 'native_token_onramp'

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
}

export interface CreateCheckoutResult {
  success: boolean
  paymentUrl?: string
  orderReference?: string
  paid?: boolean
  /** On-chain transfer hash when rail is native_token */
  txHash?: string
  error?: string
  /** Structured code for UI (e.g. PAYPAL_NOT_IMPLEMENTED) */
  code?: string
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
