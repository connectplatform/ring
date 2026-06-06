export type PaymentPurpose =
  | 'store_order'
  | 'membership_upgrade'
  | 'news_promotion'
  | 'wallet_topup'

export type PaymentRail = 'merchant_redirect' | 'internal_credit' | 'native_token'

export type PaymentProcessorId = 'wayforpay' | 'stripe' | 'internal-credit'

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
  error?: string
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
