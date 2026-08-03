'use server'

/**
 * Store checkout payment — progressive form action (useActionState compatible).
 * Loads order via StoreOrdersService then PaymentConductor (same SSOT as API routes).
 */

import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { parseFormData, storeCheckoutPaymentSchema, storePlaceAndPayFormSchema } from '@/lib/zod/wallet-store-schemas'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { normalizePaymentRail } from '@/lib/payments/conductor/types'
import {
  canSpendCreditForOrderCurrency,
  isRailEnabled,
} from '@/lib/payments/payment.config'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { getMainCurrencySymbol, convertFromMainCurrency } from '@/lib/ring-oracle'
import { getSupportedCurrencies } from '@/lib/ring-config-core'
import type { SupportedCurrencies } from '@/lib/ring-config-core'

export interface StoreCheckoutPaymentState {
  success?: boolean
  error?: string
  redirectUrl?: string
  paymentUrl?: string
  paymentFields?: Record<string, string | string[]>
  redirect?: {
    mode: 'navigate' | 'form_post'
    url: string
    fields?: Record<string, string | string[]>
  }
  doneInline?: boolean
}

export async function submitStoreCheckoutPayment(
  _prev: StoreCheckoutPaymentState | null,
  formData: FormData,
): Promise<StoreCheckoutPaymentState> {
  const parsed = parseFormData(storeCheckoutPaymentSchema, formData)
  if (parsed.success === false) {
    return { error: parsed.error }
  }

  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }

  const { orderId, paymentMethod, returnUrl, locale, paymentCurrency: paymentCurrencyRaw } = parsed.data
  const rail = normalizePaymentRail(paymentMethod)
  const mainCurrency = getMainCurrencySymbol() as SupportedCurrencies
  const presentmentPool = getSupportedCurrencies()
  const paymentCurrency: SupportedCurrencies =
    rail === 'card' || rail === 'paypal'
      ? presentmentPool.includes(paymentCurrencyRaw as SupportedCurrencies)
        ? (paymentCurrencyRaw as SupportedCurrencies)
        : mainCurrency
      : mainCurrency

  try {
    // Warm NBU FX overlay before presentment conversion (no-op if feed disabled).
    try {
      const { ensureFxFeedFresh } = await import('@/lib/ring-oracle')
      await ensureFxFeedFresh()
    } catch {
      /* feed optional — static exchangeRates still apply */
    }

    const order = (await StoreOrdersService.getOrderById(orderId)) as {
      id?: string
      userId?: string
      total?: number
      items?: unknown[]
      payment?: { status?: string }
      shippingInfo?: Record<string, string>
    } | null

    if (!order?.id) return { error: 'Order not found' }
    if (order.userId !== session.user.id) return { error: 'Order access denied' }
    if (order.payment?.status === 'paid') return { error: 'Order already paid' }

    // Order ledger stays in main currency; card/paypal presentment may differ.
    const amountMain = order.total ?? 0
    const chargeAmount =
      rail === 'card' || rail === 'paypal'
        ? Number(convertFromMainCurrency(amountMain, paymentCurrency).toFixed(2))
        : amountMain
    const currency = rail === 'card' || rail === 'paypal' ? paymentCurrency : mainCurrency
    const amount = chargeAmount
    const processingReturn =
      returnUrl ||
      `/${locale || 'en'}/store/checkout/processing?orderId=${orderId}`

    if (rail === 'card') {
      const result = await PaymentConductor.createCheckout({
        purpose: 'store_order',
        rail: 'card',
        userId: session.user.id,
        userEmail: session.user.email || '',
        entityId: order.id,
        orderId: order.id,
        amount,
        currency,
        items: order.items,
        shippingInfo: order.shippingInfo,
        returnUrl: processingReturn,
        locale: locale === 'uk' ? 'UK' : 'EN',
      })
      if (!result.success) {
        return { error: result.error || 'Card payment failed' }
      }
      try {
        await StoreOrdersService.updateOrderPaymentStatus(order.id, {
          method: 'card',
          status: 'pending',
          amount,
          currency,
        })
      } catch {
        // non-fatal
      }
      return {
        success: true,
        redirect: result.redirect,
        paymentUrl: result.paymentUrl ?? result.redirect?.url,
        paymentFields: result.paymentFields ?? result.redirect?.fields,
        redirectUrl: result.paymentUrl ?? result.redirect?.url,
      }
    }

    if (rail === 'credit_balance') {
      if (!isRailEnabled('store_order', 'credit_balance')) {
        return { error: 'Credit payments are disabled' }
      }
      if (!canSpendCreditForOrderCurrency(currency)) {
        return {
          error: `Credit balance cannot pay ${currency} orders on this site`,
        }
      }
      const result = await PaymentConductor.createCheckout({
        purpose: 'store_order',
        rail: 'credit_balance',
        userId: session.user.id,
        userEmail: session.user.email ?? '',
        entityId: order.id,
        orderId: order.id,
        amount,
        currency,
        returnUrl: '',
      })
      if (!result.success || !result.paid) {
        return { error: result.error ?? 'Credit payment failed' }
      }
      await StoreOrdersService.updateOrderPaymentStatus(order.id, {
        method: 'credit_balance',
        processor: 'credit_balance',
        status: 'paid',
        amount,
        currency,
        paidAt: new Date().toISOString(),
      })
      await StoreOrdersService.adminUpdateOrderStatus(order.id, 'paid')
      return { success: true, doneInline: true }
    }

    if (rail === 'native_token') {
      if (!isRailEnabled('store_order', 'native_token')) {
        return { error: 'Native token payments are disabled' }
      }
      const result = await PaymentConductor.createCheckout({
        purpose: 'store_order',
        rail: 'native_token',
        userId: session.user.id,
        userEmail: session.user.email ?? '',
        entityId: order.id,
        orderId: order.id,
        amount,
        currency,
        returnUrl: '',
      })
      if (!result.success || !result.paid) {
        return { error: result.error ?? 'Token payment failed' }
      }
      await StoreOrdersService.updateOrderPaymentStatus(order.id, {
        method: 'native_token',
        processor: 'native_token',
        status: 'paid',
        amount,
        currency,
        paidAt: new Date().toISOString(),
      })
      await StoreOrdersService.adminUpdateOrderStatus(order.id, 'paid')
      return { success: true, doneInline: true }
    }

    if (rail === 'paypal') {
      const result = await PaymentConductor.createCheckout({
        purpose: 'store_order',
        rail: 'paypal',
        userId: session.user.id,
        userEmail: session.user.email || '',
        entityId: order.id,
        orderId: order.id,
        amount,
        currency,
        returnUrl: processingReturn,
      })
      if (!result.success || !(result.paymentUrl || result.redirect?.url)) {
        return { error: result.error || 'PayPal payment failed' }
      }
      return {
        success: true,
        paymentUrl: result.paymentUrl ?? result.redirect?.url,
        redirectUrl: result.paymentUrl ?? result.redirect?.url,
      }
    }

    return { error: `Unsupported payment method: ${paymentMethod}` }
  } catch (error) {
    logger.error('submitStoreCheckoutPayment failed', { error, orderId })
    return {
      error: error instanceof Error ? error.message : 'Checkout payment failed',
    }
  }
}

export interface PlaceAndPayStoreOrderState extends StoreCheckoutPaymentState {
  orderId?: string
  referralApplied?: boolean
  referralCode?: string
}

/**
 * Progressive checkout: create order + start payment in one server action.
 * Prefer over client `fetch('/api/store/orders')` + manual payment call.
 */
export async function placeAndPayStoreOrder(
  _prev: PlaceAndPayStoreOrderState | null,
  formData: FormData,
): Promise<PlaceAndPayStoreOrderState> {
  const parsedForm = parseFormData(storePlaceAndPayFormSchema, formData)
  if (parsedForm.success === false) {
    return { error: parsedForm.error }
  }

  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }

  const { paymentMethod, returnUrl, locale, paymentCurrency } = parsedForm.data
  let orderPayload: unknown
  try {
    orderPayload = JSON.parse(parsedForm.data.payload)
  } catch {
    return { error: 'Invalid order payload JSON' }
  }

  try {
    const { orderCreateSchema } = await import('@/lib/zod')
    const parsedOrder = orderCreateSchema.safeParse(orderPayload)
    if (!parsedOrder.success) {
      return {
        error: `Invalid order: ${parsedOrder.error.issues.map((i) => i.message).join('; ')}`,
      }
    }

    const data = parsedOrder.data
    const shippingInfo = data.shippingInfo || data.checkoutInfo
    const total =
      typeof data.total === 'number'
        ? data.total
        : Object.values(data.totals || {}).reduce(
            (s, n) => s + (typeof n === 'number' ? n : 0),
            0,
          )

    const normalized = {
      ...data,
      shippingInfo,
      checkoutInfo: data.checkoutInfo || shippingInfo,
      total,
      subtotal: data.subtotal ?? total,
      payment: {
        ...data.payment,
        method: normalizePaymentRail(data.payment.method),
      },
    }

    const { REF_COOKIE_NAME } = await import('@/features/refcodes/constants')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const refCode = cookieStore.get(REF_COOKIE_NAME)?.value
    const {
      getBuyerWalletAddresses,
      resolveOrderReferral,
    } = await import('@/features/refcodes/services/attribution-service')
    const buyerWallets = await getBuyerWalletAddresses(session.user.id)
    const referral = await resolveOrderReferral(
      session.user.id,
      refCode,
      buyerWallets,
    )

    const { orderId } = await StoreOrdersService.createOrder(
      session.user.id,
      normalized as never,
      referral || undefined,
    )

    try {
      const {
        reserveInventoryForOrder,
        releaseReservationsForOrder,
      } = await import('@/features/store/services/inventory-sync')
      const { cartHoldOrderId } = await import('@/features/store/constants/stock')
      await releaseReservationsForOrder(cartHoldOrderId(session.user.id))
      const reservationItems = (data.items || []).map((item) => {
        const product = (
          item as {
            product?: { id?: string; digitalProduct?: boolean; instantDelivery?: boolean }
            isPreorder?: boolean
          }
        ).product
        return {
          productId: item.productId || product?.id || '',
          quantity: item.quantity,
          digitalProduct: Boolean(product?.digitalProduct),
          instantDelivery: Boolean(product?.instantDelivery),
          isPreorder: Boolean((item as { isPreorder?: boolean }).isPreorder),
        }
      })
      await reserveInventoryForOrder(orderId, reservationItems)
    } catch (reservationError) {
      logger.warn('placeAndPayStoreOrder inventory reserve failed', {
        orderId,
        error: reservationError,
      })
    }

    const rail = normalizePaymentRail(paymentMethod)

    const processingReturn =
      (returnUrl || `/${locale || 'en'}/store/checkout/processing?orderId=${orderId}`).replace(
        /orderId=(PENDING|PLACEHOLDER)/,
        `orderId=${orderId}`,
      )

    const payFd = new FormData()
    payFd.set('orderId', orderId)
    payFd.set('paymentMethod', rail)
    payFd.set('returnUrl', processingReturn)
    if (locale) payFd.set('locale', locale)
    if (paymentCurrency) payFd.set('paymentCurrency', paymentCurrency)

    const paymentResult = await submitStoreCheckoutPayment(null, payFd)
    return {
      ...paymentResult,
      orderId,
      referralApplied: Boolean(referral),
      ...(referral ? { referralCode: referral.referralCode } : {}),
    }
  } catch (error) {
    logger.error('placeAndPayStoreOrder failed', { error })
    return {
      error: error instanceof Error ? error.message : 'Failed to place order',
    }
  }
}
