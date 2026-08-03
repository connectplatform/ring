/**
 * Telegram Stars bot webhook — pre_checkout_query + successful_payment.
 *
 * Point Mini App bot setWebhook at:
 *   POST /api/telegram/stars-bot/webhook
 * with secret_token = TELEGRAM_STARS_WEBHOOK_SECRET
 * allowed_updates: ["pre_checkout_query","message"]
 *
 * Always returns 200 so Telegram does not retry-storm.
 *
 * Truth lens: telegram_stars_payments_monetization_specialist
 */
import { NextRequest, NextResponse, connection } from 'next/server'
import { validateStarsWebhookSecret } from '@/lib/telegram/stars-bot/bot-config'
import {
  handleStarsPreCheckout,
  handleStarsSuccessfulPayment,
  type TelegramPreCheckoutQuery,
  type TelegramSuccessfulPayment,
} from '@/lib/telegram/stars-bot/payment-handler'
import { logger } from '@/lib/logger'

interface TelegramUpdate {
  update_id: number
  pre_checkout_query?: TelegramPreCheckoutQuery
  message?: {
    message_id: number
    from?: { id: number }
    successful_payment?: TelegramSuccessfulPayment
  }
}

export async function POST(request: NextRequest) {
  await connection()

  try {
    const secret = request.headers.get('x-telegram-bot-api-secret-token')
    if (!validateStarsWebhookSecret(secret)) {
      // Silent 200 — do not leak auth failures to Telegram retry logic
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const update = (await request.json()) as TelegramUpdate

    if (update.pre_checkout_query) {
      await handleStarsPreCheckout(update.pre_checkout_query)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const payment = update.message?.successful_payment
    if (payment) {
      await handleStarsSuccessfulPayment(payment)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logger.error('Stars webhook error', {
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
