import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { canSpendCreditForOrderCurrency, getFiatCurrency } from '@/lib/payments/payment.config'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { userCreditService } from '@/features/wallet/services/user-credit-service'
import { priceOracleService } from '@/services/blockchain/price-oracle-service'

export async function createInternalCreditCheckout(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  if (ctx.purpose === 'store_order') {
    if (!canSpendCreditForOrderCurrency(ctx.currency)) {
      return {
        success: false,
        error: `Credit balance (${getFiatCurrency()}) cannot pay for ${ctx.currency} orders. Use card payment or set PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY.`,
      }
    }
  }

  const orderReference = buildOrderReference(ctx.purpose, {
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    articleId: ctx.articleId ?? ctx.entityId,
  })

  await paymentTransactionService.createPending({
    purpose: ctx.purpose,
    processor: 'internal-credit',
    rail: 'internal_credit',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: ctx.currency,
  })

  const amountStr = ctx.amount.toString()
  let priceData = { price: '1' }
  try {
    priceData = await priceOracleService.getRingUsdPrice()
  } catch {
    /* optional oracle */
  }

  try {
    await userCreditService.spendCredits(
      ctx.userId,
      {
        amount: amountStr,
        description: `Payment: ${ctx.purpose} ${ctx.entityId}`,
        order_id: ctx.orderId ?? ctx.entityId,
        metadata: { purpose: ctx.purpose, orderReference },
      },
      'purchase',
      priceData.price
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Insufficient credit balance'
    return { success: false, error: message }
  }

  await paymentTransactionService.markPaid(orderReference, { rail: 'internal_credit' })

  return {
    success: true,
    paid: true,
    orderReference,
  }
}
