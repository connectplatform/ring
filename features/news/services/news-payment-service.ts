import type { NewsPromotionPayment } from '@/features/news/types'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { getPaymentProvider } from '@/lib/payments/payment.config'

export type PromotionPaymentProvider = 'wayforpay' | 'stripe'

/** @deprecated Use getPaymentProvider('news_promotion') from payment.config */
export function getPromotionPaymentProvider(): PromotionPaymentProvider {
  return getPaymentProvider('news_promotion') as PromotionPaymentProvider
}

export async function createPromotionPayment(params: {
  articleId: string
  userId: string
  userEmail: string
  amountUah: number
  returnUrl: string
}): Promise<{ success: boolean; paymentUrl?: string; orderReference?: string; error?: string }> {
  const result = await PaymentConductor.createCheckout({
    purpose: 'news_promotion',
    userId: params.userId,
    userEmail: params.userEmail,
    entityId: params.articleId,
    articleId: params.articleId,
    amount: params.amountUah,
    currency: 'UAH',
    returnUrl: params.returnUrl,
  })

  return {
    success: result.success,
    paymentUrl: result.paymentUrl,
    orderReference: result.orderReference,
    error: result.error,
  }
}

export function buildPaymentRecord(
  provider: PromotionPaymentProvider,
  orderReference: string,
  amount: number
): NewsPromotionPayment {
  return {
    provider,
    orderReference,
    amount,
    currency: 'UAH',
  }
}
