import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { canSpendCreditForOrderCurrency, getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { NativeTokenPriceOracleService } from '@/services/blockchain/price-oracle-service'

// Singleton instance of price oracle for native token to USD conversions
const priceOracleService = NativeTokenPriceOracleService.getInstance()

/**
 * Handles checkout process using internal credit balance.
 * 
 * 1. Validates whether credit can pay for orders in specified currency.
 * 2. Builds a unique order reference for tracking the transaction.
 * 3. Creates a pending payment transaction record.
 * 4. (Optionally) fetches current native token/USD price.
 * 5. Attempts to spend user credit for the payment.
 * 6. If successful, marks payment as paid.
 * 7. Returns detailed payment status/result.
 * 
 * @param ctx - Context needed to process internal credit payments.
 * @returns Promise resolving to a CreateCheckoutResult
 */
export async function createInternalCreditCheckout(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  // Step 1: Verify that internal credits can be used for this order's currency.
  if (ctx.purpose === 'store_order') {
    if (!canSpendCreditForOrderCurrency(ctx.currency)) {
      // Early-out error: Credit not eligible for specified currency.
      return {
        success: false,
        error: `Credit balance (${getDefaultStoreCurrencySymbol()}) cannot pay for ${ctx.currency} orders. Use card payment or set PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY.`,
      }
    }
  }

  // Step 2: Generate a unique order reference to track the transaction.
  const orderReference = buildOrderReference(ctx.purpose, {
    orderId: ctx.orderId ?? ctx.entityId,  // Use fallback if no orderId provided
    userId: ctx.userId,
    articleId: ctx.articleId ?? ctx.entityId,
  })

  // Step 3: Record a pending transaction for audit and consistency.
  // TODO: Consider switching to the Promise.allSettled pattern for batch transaction creation if building extensibility for multi-rail support (native Next16/Node features)
  await paymentTransactionService.createPending({
    purpose: ctx.purpose,
    processor: 'internal-credit',
    rail: 'internal_credit',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100), // Convert to minor currency unit (e.g., cents)
    currency: ctx.currency,
  })

  // Step 4: Fetch and stringify payment amount
  const amountStr = ctx.amount.toString()

  // Step 5: Fetch token/USD price for accounting (oracle is optional)
  let priceData = { price: '1' } // Default stub value in case oracle is down or unavailable.
  try {
    priceData = await priceOracleService.getNativeTokenUsdPrice()
  } catch {
    // Optional Oracle: ignore if price feed unavailable (proceed with stub value)
    // STUB: graceful fallback to price = '1' on failure, consider alerting downstream in production environments
    // TODO: Consider an alert/log when oracle fetch fails (integrate with monitoring/observability pipeline, native Next.js middleware for server logging)
  }

  // Step 6: Attempt to charge user's credit balance.
  try {
    await creditBalanceService.spendCredits(
      ctx.userId,
      {
        amount: amountStr,
        description: `Payment: ${ctx.purpose} ${ctx.entityId}`,
        order_id: ctx.orderId ?? ctx.entityId,
        metadata: { 
          purpose: ctx.purpose, 
          orderReference 
        },
      },
      'purchase',
      priceData.price
    )
  } catch (e) {
    // If error occurs (e.g., insufficient balance), return failure with error message.
    // TODO: Consider specific error handling/types from spendCredits once implemented (Currently broad catch)
    const message = e instanceof Error ? e.message : 'Insufficient credit balance'
    return { success: false, error: message }
  }

  // Step 7: Mark transaction as paid if spendCredits succeeded.
  await paymentTransactionService.markPaid(orderReference, { rail: 'internal_credit' })

  // Step 8: Return success response and relevant reference.
  return {
    success: true,
    paid: true,
    orderReference,
  }
}
