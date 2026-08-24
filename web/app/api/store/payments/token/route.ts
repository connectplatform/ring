import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { isRailEnabled } from '@/lib/payments/payment.config'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { fulfillStoreOrderPaid } from '@/lib/payments/conductor/fulfill-store-order-paid'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

const schema = z.object({
  orderId: z.string().min(1),
  /** Optional explicit token amount; otherwise converted via RING/USD oracle */
  tokenAmount: z.union([z.string(), z.number()]).optional(),
  /** Idempotency contract: retries with the same key replay the payment, never double-charge. */
  idempotencyKey: z.string().min(8).max(120).optional(),
})

/**
 * POST /api/store/payments/token
 * Pay store order with native token via PaymentConductor (rail: native_token).
 * Requires PAYMENT_STORE_ALLOW_TOKEN=true.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!isRailEnabled('store_order', 'native_token')) {
      return NextResponse.json(
        {
          error: 'Native token store payments are disabled',
          code: 'NATIVE_TOKEN_RAIL_DISABLED',
          message: 'Set PAYMENT_STORE_ALLOW_TOKEN=true to enable',
        },
        { status: 403 }
      )
    }

    const body = schema.parse(await request.json())
    const order = (await StoreOrdersService.getOrderById(body.orderId)) as {
      userId?: string
      total?: number
      currency?: string
      payment?: { status?: string; currency?: string }
    } | null

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 })
    }

    // Idempotency contract: a retry of an already-completed payment replays success.
    // Must run before the "already paid" guard — that guard is for no-key / mismatched
    // retries; the paid-order replay must return success, not 400.
    if (body.idempotencyKey) {
      const existing = await paymentTransactionService.findByIdempotencyKey(
        session.user.id,
        'store_order',
        body.idempotencyKey,
      )
      if (existing?.status === 'paid') {
        return NextResponse.json({
          success: true,
          paid: true,
          idempotentReplay: true,
          orderReference: existing.order_reference,
          txHash:
            (existing.processor_payload as { txHash?: string } | undefined)?.txHash,
        })
      }
      if (existing) {
        return NextResponse.json(
          {
            error: 'Payment with this idempotency key is already in progress',
            code: 'IDEMPOTENCY_IN_FLIGHT',
            orderReference: existing.order_reference,
          },
          { status: 409 },
        )
      }
    }

    if (order.payment?.status === 'paid') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
    }

    const currency = (
      order.currency ||
      order.payment?.currency ||
      getMainCurrencySymbol()
    ).toUpperCase()
    const result = await PaymentConductor.createCheckout({
      purpose: 'store_order',
      rail: 'native_token',
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      entityId: body.orderId,
      orderId: body.orderId,
      amount: order.total ?? 0,
      currency,
      returnUrl: '',
      metadata:
        body.tokenAmount !== undefined || body.idempotencyKey !== undefined
          ? {
              ...(body.tokenAmount !== undefined ? { tokenAmount: body.tokenAmount } : {}),
              ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
            }
          : undefined,
    })

    if (!result.success || !result.paid) {
      return NextResponse.json(
        {
          error: result.error ?? 'Native token payment failed',
          code: result.code,
          orderReference: result.orderReference,
        },
        { status: 400 }
      )
    }

    await fulfillStoreOrderPaid({
      orderId: body.orderId,
      orderReference: result.orderReference ?? '',
      amount: order.total ?? 0,
      currency,
      rail: 'native_token',
      processor: 'native_token',
      processorPayload: { orderReference: result.orderReference, txHash: result.txHash },
      paymentDetails: { cryptoTxHash: result.txHash },
      source: 'Store native token',
    })

    return NextResponse.json({
      success: true,
      paid: true,
      orderReference: result.orderReference,
      orderId: body.orderId,
      txHash: result.txHash,
      tokenSymbol: getNativeTokenSymbol(),
    })
  } catch (error) {
    logger.error('Store native token payment error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
