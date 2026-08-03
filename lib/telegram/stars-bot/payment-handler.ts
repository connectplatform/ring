/**
 * Telegram Stars payment fulfillment — pre_checkout + successful_payment.
 *
 * Never fulfill on pre_checkout alone. Persist telegram_payment_charge_id.
 *
 * Truth lens: telegram_stars_payments_monetization_specialist
 */
import 'server-only'

import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import { answerPreCheckoutQuery } from '@/lib/telegram/stars-bot/bot-config'

export type TelegramSuccessfulPayment = {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
  provider_payment_charge_id?: string
}

export type TelegramPreCheckoutQuery = {
  id: string
  from: { id: number }
  currency: string
  total_amount: number
  invoice_payload: string
}

/**
 * Approve Stars digital invoice when payload maps to a pending telegram_stars ledger.
 */
export async function handleStarsPreCheckout(
  query: TelegramPreCheckoutQuery,
): Promise<void> {
  const payload = String(query.invoice_payload || '').trim()
  if (!payload.startsWith('stars_')) {
    await answerPreCheckoutQuery(query.id, false, 'Unknown invoice')
    return
  }

  const row = await SubscriptionConductor.findByTelegramStarsPayload(payload)
  if (!row) {
    await answerPreCheckoutQuery(query.id, false, 'Subscription not found')
    return
  }

  if (row.status === 'cancelled' || row.status === 'expired') {
    await answerPreCheckoutQuery(query.id, false, 'Subscription no longer available')
    return
  }

  // Currency must be XTR for digital Stars goods
  if (String(query.currency || '').toUpperCase() !== 'XTR') {
    await answerPreCheckoutQuery(query.id, false, 'Invalid currency')
    return
  }

  await answerPreCheckoutQuery(query.id, true)
}

/**
 * Idempotent membership activation after SuccessfulPayment.
 */
export async function handleStarsSuccessfulPayment(
  payment: TelegramSuccessfulPayment,
): Promise<{ ok: boolean; reason?: string }> {
  const payload = String(payment.invoice_payload || '').trim()
  const chargeId = String(payment.telegram_payment_charge_id || '').trim()

  if (!payload.startsWith('stars_') || !chargeId) {
    logger.warn('Stars successful_payment: invalid payload/charge', { payload })
    return { ok: false, reason: 'invalid' }
  }

  if (String(payment.currency || '').toUpperCase() !== 'XTR') {
    logger.warn('Stars successful_payment: non-XTR currency', {
      currency: payment.currency,
    })
    return { ok: false, reason: 'currency' }
  }

  const result = await SubscriptionConductor.activateTelegramStarsPayment({
    invoicePayload: payload,
    telegramPaymentChargeId: chargeId,
    totalAmount: payment.total_amount,
    currency: 'XTR',
  })

  if (!result.ok) {
    logger.error('Stars successful_payment: activation failed', {
      payload,
      chargeId,
      reason: result.reason,
    })
  }

  return result
}
