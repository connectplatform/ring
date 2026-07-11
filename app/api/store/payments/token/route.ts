import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { isRailEnabled } from '@/lib/payments/payment.config'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

const schema = z.object({
  orderId: z.string().min(1),
  /** Optional explicit token amount; otherwise converted via RING/USD oracle */
  tokenAmount: z.union([z.string(), z.number()]).optional(),
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
      payment?: { status?: string }
    } | null

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 })
    }
    if (order.payment?.status === 'paid') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
    }

    const currency = 'UAH'
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
      metadata: body.tokenAmount !== undefined ? { tokenAmount: body.tokenAmount } : undefined,
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

    await StoreOrdersService.updateOrderPaymentStatus(body.orderId, {
      method: 'crypto',
      status: 'paid',
      amount: order.total ?? 0,
      currency,
      paidAt: new Date().toISOString(),
      cryptoTxHash: result.txHash,
    })
    await StoreOrdersService.adminUpdateOrderStatus(body.orderId, 'paid')

    const paidOrder = await StoreOrdersService.getOrderWithPaymentDetails(body.orderId)
    if (paidOrder) {
      if (paidOrder.items?.length) {
        try {
          await ERPStockService.deductStockForOrder(body.orderId, paidOrder.items, paidOrder.userId, {
            referralCode: paidOrder.referralCode,
            assisted: Boolean(paidOrder.referralCode),
          })
        } catch (stockError) {
          logger.error('Store token: stock deduction failed', { orderId: body.orderId, stockError })
        }
      }

      if (paidOrder.vendorSettlements?.length && result.orderReference) {
        try {
          await VendorSettlementService.processSettlements(body.orderId, {
            paymentMethod: 'crypto',
            transactionId: result.orderReference,
            amount: paidOrder.total ?? 0,
            currency,
          })
        } catch (settlementError) {
          logger.error('Store token: settlement failed', { orderId: body.orderId, settlementError })
        }
      }

      if (result.orderReference) {
        try {
          await ReferralRewardService.onOrderPaid({
            order: paidOrder,
            orderReference: result.orderReference,
            rail: 'crypto',
          })
        } catch (referralError) {
          logger.error('Store token: referral reward failed', { orderId: body.orderId, referralError })
        }
      }
    }

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
