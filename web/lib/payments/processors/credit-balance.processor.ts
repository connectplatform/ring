import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { canSpendCreditForOrderCurrency } from '@/lib/payments/payment.config'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import {
  getMainCurrencyCreditAccountingRate,
  getMainCurrencySymbol,
} from '@/lib/ring-oracle'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'

/**
 * Handles checkout process using credit balance.
 *
 * 1. Validates whether credit can pay for orders in specified currency.
 * 2. Builds a unique order reference for tracking the transaction.
 * 3. Creates a pending payment transaction record.
 * 4. Debits credit balance ledger at credit.creditBalanceUnitToMainCurrency rate (SSOT).
 * 5. Marks payment as paid on success.
 *
 * Native-token oracle is intentionally unused — desk owns credit↔native conversion.
 */
export async function createCreditBalanceCheckout(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  if (ctx.purpose === 'store_order') {
    if (!canSpendCreditForOrderCurrency(ctx.currency)) {
      return {
        success: false,
        error: `Credit balance (${getMainCurrencySymbol()}) cannot pay for ${ctx.currency} orders. Use card payment or set PAYMENT_CREDIT_BALANCE_ACCEPTED_ORDER_CURRENCIES.`,
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
    processor: 'credit_balance',
    rail: 'credit_balance',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: ctx.currency,
  })

  const amountStr = ctx.amount.toString()
  const mainCurrencyRate = getMainCurrencyCreditAccountingRate()

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
      mainCurrencyRate,
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Insufficient credit balance'
    return { success: false, error: message }
  }

  await paymentTransactionService.markPaid(orderReference, { rail: 'credit_balance' })

  return {
    success: true,
    paid: true,
    orderReference,
  }
}
