/**
 * Telegram Stars payment-handler contract tests (no live Bot API).
 */
jest.mock('@/lib/payments/subscription/subscription-conductor', () => ({
  SubscriptionConductor: {
    findByTelegramStarsPayload: jest.fn(),
    activateTelegramStarsPayment: jest.fn(),
  },
}))

jest.mock('@/lib/telegram/stars-bot/bot-config', () => ({
  answerPreCheckoutQuery: jest.fn(async () => ({ ok: true })),
}))

import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { answerPreCheckoutQuery } from '@/lib/telegram/stars-bot/bot-config'
import {
  handleStarsPreCheckout,
  handleStarsSuccessfulPayment,
} from '@/lib/telegram/stars-bot/payment-handler'

describe('Stars payment handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects pre_checkout when payload is not stars_*', async () => {
    await handleStarsPreCheckout({
      id: 'q1',
      from: { id: 1 },
      currency: 'XTR',
      total_amount: 100,
      invoice_payload: 'bad_payload',
    })
    expect(answerPreCheckoutQuery).toHaveBeenCalledWith(
      'q1',
      false,
      'Unknown invoice',
    )
  })

  it('approves pre_checkout for pending stars ledger', async () => {
    ;(SubscriptionConductor.findByTelegramStarsPayload as jest.Mock).mockResolvedValue({
      id: 'stars_abc',
      user_id: 'u1',
      provider: 'telegram_stars',
      gateway: 'Telegram Stars',
      method: 'stars',
      status: 'pending',
      amount: 100,
      currency: 'XTR',
      gateway_fee_percent: 0,
      gateway_fee_fixed: 0,
      start_time: 1,
      next_payment_due: 2,
      failed_attempts: 0,
      max_failed_attempts: 3,
      auto_renew: true,
      total_paid: '0',
      payments_count: 0,
    })

    await handleStarsPreCheckout({
      id: 'q2',
      from: { id: 1 },
      currency: 'XTR',
      total_amount: 100,
      invoice_payload: 'stars_abc',
    })
    expect(answerPreCheckoutQuery).toHaveBeenCalledWith('q2', true)
  })

  it('activates on successful_payment', async () => {
    ;(SubscriptionConductor.activateTelegramStarsPayment as jest.Mock).mockResolvedValue({
      ok: true,
    })

    const result = await handleStarsSuccessfulPayment({
      currency: 'XTR',
      total_amount: 100,
      invoice_payload: 'stars_abc',
      telegram_payment_charge_id: 'charge_1',
    })

    expect(result.ok).toBe(true)
    expect(SubscriptionConductor.activateTelegramStarsPayment).toHaveBeenCalledWith({
      invoicePayload: 'stars_abc',
      telegramPaymentChargeId: 'charge_1',
      totalAmount: 100,
      currency: 'XTR',
    })
  })

  it('rejects non-XTR successful_payment', async () => {
    const result = await handleStarsSuccessfulPayment({
      currency: 'USD',
      total_amount: 100,
      invoice_payload: 'stars_abc',
      telegram_payment_charge_id: 'charge_1',
    })
    expect(result.ok).toBe(false)
    expect(SubscriptionConductor.activateTelegramStarsPayment).not.toHaveBeenCalled()
  })
})
