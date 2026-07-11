import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { canSpendCreditForOrderCurrency, getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getFiatCreditAccountingRate } from '@/lib/payments/credit-currency'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'

/**
 * Handles checkout process using internal credit balance.
 *
 * 1. Validates whether credit can pay for orders in specified currency.
 * 2. Builds a unique order reference for tracking the transaction.
 * 3. Creates a pending payment transaction record.
 * 4. Debits fiat credit ledger at credit.unitToDefaultCurrency rate (SSOT).
 * 5. Marks payment as paid on success.
 *
 * Native-token oracle is intentionally unused — desk owns credit↔native conversion.
 */
export async function createInternalCreditCheckout(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  if (ctx.purpose === 'store_order') {
    if (!canSpendCreditForOrderCurrency(ctx.currency)) {
      return {
        success: false,
        error: `Credit balance (${getDefaultStoreCurrencySymbol()}) cannot pay for ${ctx.currency} orders. Use card payment or set PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY.`,
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
  const fiatRate = getFiatCreditAccountingRate()

  try {
    await creditBalanceService.spendCredits(
      ctx.userId,
      {
        amount: amountStr,
        description: `Payment: ${ctx.purpose} ${ctx.entityId}`,
        order_id: ctx.orderId ?? ctx.entityId,
        metadata: {
          purpose: ctx.purpose,
          orderReference,
        },
      },
      'purchase',
      fiatRate,
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
