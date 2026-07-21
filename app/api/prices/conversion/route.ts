import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nativeTokenPriceOracleService } from '@/features/wallet/services/native-token-price-oracle';
import { logger } from '@/lib/logger';

// TODO: Native Next.js 13/14/16 API routes now support automatic type validation via `zod` and request helpers. 
// Consider using `next/headers` and `NextRequest.json()` for more idiomatic typed request handling, and moving validation logic
// into reusable middlewares or route helpers for per-route-reuse.

// Schema for price conversion requests. Ensures that the structure and values are as expected.
const ConversionRequestSchema = z.object({
  // Must be a string matching a positive number (integer or decimal).
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number'),
  // From and to must be one of the supported enumerated values.
  from: z.enum(['RING', 'USD']),
  to: z.enum(['RING', 'USD']),
});

// Type derived from schema for type safety.
type ConversionRequest = z.infer<typeof ConversionRequestSchema>;

/**
 * POST /api/prices/conversion
 * Handles conversion between RING and USD. Expects a JSON body with amount, from, to.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body from request
    const requestBody = await request.json();

    // Validate request body using zod schema
    let validatedRequest: ConversionRequest;
    try {
      validatedRequest = ConversionRequestSchema.parse(requestBody);
    } catch (validationError) {
      // Log validation issues and return 400 for invalid input
      logger.warn('Invalid conversion request', { 
        requestBody, 
        validationError 
      });

      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      );
    }

    const { amount, from, to } = validatedRequest;

    // Disallow conversions between the same currency, as it's a noop
    if (from === to) {
      return NextResponse.json(
        { error: 'Cannot convert between the same currency' },
        { status: 400 }
      );
    }

    // Validate amount range
    const amountNumber = parseFloat(amount);
    const maxAmount = 1000000; // Maximum allowed
    const minAmount = 0.000001; // Minimum allowed

    if (amountNumber > maxAmount) {
      return NextResponse.json(
        { error: `Maximum conversion amount is ${maxAmount.toLocaleString()}` },
        { status: 400 }
      );
    }

    if (amountNumber < minAmount) {
      return NextResponse.json(
        { error: `Minimum conversion amount is ${minAmount}` },
        { status: 400 }
      );
    }

    // Perform the conversion according to direction
    let conversionResult;
    if (from === 'RING' && to === 'USD') {
      // Calls oracle service to convert RING to USD
      // Assumes: { usd_amount: string, rate: string, timestamp: number, confidence: number }
      conversionResult = await nativeTokenPriceOracleService.convertNativeTokenToUsd(amount);
    } else if (from === 'USD' && to === 'RING') {
      // Calls oracle service to convert USD to RING
      // Assumes: { ring_amount: string, rate: string, timestamp: number, confidence: number }
      conversionResult = await nativeTokenPriceOracleService.convertUsdToNativeToken(amount);
    } else {
      // Should never happen due to enum guard above, but safe to check
      return NextResponse.json(
        { error: 'Invalid currency conversion pair' },
        { status: 400 }
      );
    }

    // STUB: Fee is hardcoded as '0' -- Replace with dynamic fee when business logic is complete
    // STUB: Fees feature should be implemented using config from fee management microservice or static module
    const conversionFee = '0'; // No fees currently (STUB)
    const finalAmount = conversionResult.usd_amount || conversionResult.ring_amount;

    const response = {
      conversion: {
        from_currency: from,
        to_currency: to,
        from_amount: amount,
        to_amount: finalAmount,
        exchange_rate: conversionResult.rate,
        rate_timestamp: conversionResult.timestamp,
        confidence: conversionResult.confidence,
      },
      fees: {
        conversion_fee: conversionFee,
        fee_currency: to,
        net_amount: finalAmount, // No fees deducted yet (STUB)
      },
      metadata: {
        // Use timestamp and random suffix to generate pseudo-unique conversion ID
        conversion_id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        rate_age_seconds: Math.floor((Date.now() - conversionResult.timestamp) / 1000),
        warning: conversionResult.confidence < 0.7 ? 'Conversion based on low confidence rate' : undefined,
      },
    };

    // Logging for observability/auditing
    logger.info('Currency conversion performed', {
      from,
      to,
      fromAmount: amount,
      toAmount: finalAmount,
      rate: conversionResult.rate,
      confidence: conversionResult.confidence,
    });

    return NextResponse.json(response);

  } catch (error) {
    // Log as error and return 500 for internal failures
    logger.error('Failed to perform currency conversion', { error });

    return NextResponse.json(
      { error: 'Failed to perform currency conversion' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prices/conversion
 * Returns supported currency pairs and real-time rates + metadata.
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query params (if present; may support future pair expansion)
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair') || '{native_token}_USD'; // TODO: Expand multi-currency support

    // STUB: Only supports native_token <=> USD
    // Fetch spot price and metadata from the native token price oracle
    const priceData = await nativeTokenPriceOracleService.getNativeTokenUsdPrice();

    // Compose both forward and inverse rates for client
    const nativeTokenToUsd = {
      from: '{native_token}',
      to: 'USD',
      rate: priceData.price,
      inverse_rate: (1 / parseFloat(priceData.price)).toFixed(8),
    };

    const usdToNativeToken = {
      from: 'USD',
      to: '{native_token}',
      rate: nativeTokenToUsd.inverse_rate,
      inverse_rate: priceData.price,
    };

    const response = {
      supported_pairs: [
        { from: '{native_token}', to: 'USD' },
        { from: 'USD', to: '{native_token}' },
        // TODO: Add other supported pairs when more tokens/currencies onboarded
      ],
      current_rates: [nativeTokenToUsd, usdToNativeToken],
      rate_metadata: {
        timestamp: priceData.timestamp,
        source: priceData.source,
        confidence: priceData.confidence,
        age_seconds: Math.floor((Date.now() - priceData.timestamp) / 1000),
      },
      conversion_limits: {
        min_amount: '0.000001',
        max_amount: '1000000',
        precision: '8',
      },
      // STUB: Fees are static for now, should be loaded from config or dynamic fee schedule
      fees: {
        conversion_fee_rate: '0%',
        minimum_fee: '0',
        maximum_fee: '0',
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    // Log issue and return 500 error if price service fails
    logger.error('Failed to get conversion rates', { error });

    return NextResponse.json(
      { error: 'Failed to retrieve conversion rates' },
      { status: 500 }
    );
  }
}
