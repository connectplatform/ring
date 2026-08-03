import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  mainCurrencyToNativeTokenUi,
  getNativeTokenToMainCurrencyRate,
  mainTokenToMainCurrencyUi,
  getNativeTokenSymbol,
} from '@/lib/ring-oracle'

const ConversionRequestSchema = z
  .object({
    amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number'),
    from: z.enum(['native_token', 'main_currency']),
    to: z.enum(['native_token', 'main_currency']),
  })
  .refine((data) => data.from !== data.to, {
    message: 'Cannot convert between the same denomination',
    path: ['to'],
  })

/**
 * POST /api/prices/conversion — native ↔ main via ring-oracle desk SSOT.
 * Denominations: ValueDenomination `native_token` | `main_currency`
 * (credit_balance uses the credit accounting rate surface, not this route).
 */
export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json()
    const validated = ConversionRequestSchema.safeParse(requestBody)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validated.error.flatten() },
        { status: 400 },
      )
    }

    const { amount, from, to } = validated.data

    const amountNumber = parseFloat(amount)
    if (amountNumber > 1_000_000 || amountNumber < 0.000001) {
      return NextResponse.json({ error: 'Amount out of allowed range' }, { status: 400 })
    }

    const { nativePerMainCurrency, source, mainCurrency } = await getNativeTokenToMainCurrencyRate()
    const nativeSymbol = getNativeTokenSymbol()
    let toAmount: string
    if (from === 'native_token' && to === 'main_currency') {
      toAmount = String(await mainTokenToMainCurrencyUi(amountNumber))
    } else {
      toAmount = await mainCurrencyToNativeTokenUi(amountNumber)
    }

    const confidence = source === 'desk_oracle' ? 0.95 : 0.85
    const now = Date.now()
    const fromCurrency = from === 'native_token' ? nativeSymbol : mainCurrency
    const toCurrency = to === 'native_token' ? nativeSymbol : mainCurrency

    return NextResponse.json({
      conversion: {
        from_denomination: from,
        to_denomination: to,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: amount,
        to_amount: toAmount,
        exchange_rate: String(nativePerMainCurrency),
        rate_timestamp: now,
        confidence,
      },
      fees: {
        conversion_fee: '0',
        fee_currency: toCurrency,
        net_amount: toAmount,
      },
      metadata: {
        conversion_id: `conv_${now}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: now,
        source,
      },
    })
  } catch (error) {
    logger.error('Failed to perform currency conversion', { error })
    return NextResponse.json(
      { error: 'Failed to perform currency conversion' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const symbol = getNativeTokenSymbol()
    const { nativePerMainCurrency, source, mainCurrency } = await getNativeTokenToMainCurrencyRate()
    const now = Date.now()
    const rate = String(nativePerMainCurrency)
    const inverse = (1 / nativePerMainCurrency).toFixed(8)

    return NextResponse.json({
      denominations: ['native_token', 'main_currency'] as const,
      supported_pairs: [
        { from: 'native_token', to: 'main_currency', from_currency: symbol, to_currency: mainCurrency },
        { from: 'main_currency', to: 'native_token', from_currency: mainCurrency, to_currency: symbol },
      ],
      current_rates: [
        { from: symbol, to: mainCurrency, rate, inverse_rate: inverse },
        { from: mainCurrency, to: symbol, rate: inverse, inverse_rate: rate },
      ],
      rate_metadata: {
        timestamp: now,
        source,
        confidence: source === 'desk_oracle' ? 0.95 : 0.85,
        age_seconds: 0,
      },
      conversion_limits: {
        min_amount: '0.000001',
        max_amount: '1000000',
        precision: '8',
      },
    })
  } catch (error) {
    logger.error('Failed to get conversion rates', { error })
    return NextResponse.json({ error: 'Failed to get rates' }, { status: 500 })
  }
}
