/**
 * Telegram Stars (XTR) membership subscription provider.
 *
 * Creates a pending ledger row with id = invoice payload (`stars_<uuid>`).
 * Activation: POST /api/telegram/stars-bot/webhook on successful_payment.
 *
 * Env: TELEGRAM_MINI_APP_BOT_TOKEN (preferred) or ADMIN_BOT_TOKEN / TELEGRAM_BOT_TOKEN.
 * Input metadata.telegramUserId required for checkout attribution.
 *
 * Truth lens: telegram_stars_payments_monetization_specialist
 */
import 'server-only'

import type {
  CancelSubscriptionResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  RenewSubscriptionResult,
  SubscriptionProviderModule,
} from '@/lib/payments/subscription/subscription-types'
import { getTelegramMiniAppBotToken } from '@/lib/auth/telegram-miniapp-initdata'
import { randomUUID } from 'node:crypto'

export const telegramStarsSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'telegram_stars',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const token = getTelegramMiniAppBotToken()
    if (!token) {
      return {
        success: false,
        error:
          'TELEGRAM_MINI_APP_BOT_TOKEN (or ADMIN_BOT_TOKEN) missing for Stars invoices',
      }
    }

    const subscriptionId = `stars_${randomUUID()}`
    const telegramUserId = String(input.metadata?.telegramUserId || '')
    if (!telegramUserId) {
      return {
        success: false,
        error: 'metadata.telegramUserId required for Telegram Stars checkout',
      }
    }

    const starsAmount = Math.max(1, Math.round(input.amount))
    const title =
      String(input.metadata?.invoiceTitle || '').trim() || 'Ring Premium Membership'
    const description =
      String(input.metadata?.invoiceDescription || '').trim() ||
      'Monthly membership — Telegram Stars (XTR)'

    const invoiceRes = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload: subscriptionId,
        currency: 'XTR',
        prices: [{ label: 'Premium', amount: starsAmount }],
      }),
    })

    const invoiceJson = (await invoiceRes.json().catch(() => null)) as {
      ok?: boolean
      result?: string
      description?: string
    } | null

    if (!invoiceJson?.ok || !invoiceJson.result) {
      return {
        success: false,
        error: invoiceJson?.description || 'Failed to create Telegram Stars invoice link',
      }
    }

    return {
      success: true,
      subscriptionId,
      gatewayReference: invoiceJson.result,
      ledgerStatus: 'pending',
      redirect: {
        mode: 'navigate',
        url: invoiceJson.result,
      },
      redirectUrl: invoiceJson.result,
    }
  },

  async cancelSubscription(
    _userId: string,
    _gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    return { success: true }
  },

  async renewSubscription(
    _userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    return {
      success: true,
      nextPaymentDue: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      txSignature: `stars_renew_${gatewayReference || 'unknown'}`,
    }
  },
}
