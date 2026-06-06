import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { priceOracleService } from '@/services/blockchain/price-oracle-service';
import { logger } from '@/lib/logger';

/**
 * Request schema for price conversion
 */
const ConversionRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number'),
  from: z.enum(['RING', 'USD']),
  to: z.enum(['RING', 'USD']),
});

type ConversionRequest = z.infer<typeof ConversionRequestSchema>;

/**
 * POST /api/prices/conversion
 * Convert between RING and USD amounts
 * 
 * Request body:
 * {
 *   "amount": "100.5",
 *   "from": "RING",
 *   "to": "USD"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();

    // Validate request body
    let validatedRequest: ConversionRequest;
    try {
      validatedRequest = ConversionRequestSchema.parse(requestBody);
    } catch (validationError) {
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

    // Validate same currency conversion
    if (from === to) {
      return NextResponse.json(
        { error: 'Cannot convert between the same currency' },
        { status: 400 }
      );
    }

    // Validate amount limits
    const amountNumber = parseFloat(amount);
    const maxAmount = 1000000; // 1M maximum
    const minAmount = 0.000001; // 1 micro minimum

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

    // Perform conversion
    let conversionResult;
    
    if (from === 'RING' && to === 'USD') {
      conversionResult = await priceOracleService.convertRingToUsd(amount);
    } else if (from === 'USD' && to === 'RING') {
      conversionResult = await priceOracleService.convertUsdToRing(amount);
    } else {
      return NextResponse.json(
        { error: 'Invalid currency conversion pair' },
        { status: 400 }
      );
    }

    // Calculate conversion fees (if any)
    const conversionFee = '0'; // No conversion fees for now
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
        net_amount: finalAmount,
      },
      metadata: {
        conversion_id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        rate_age_seconds: Math.floor((Date.now() - conversionResult.timestamp) / 1000),
        warning: conversionResult.confidence < 0.7 ? 'Conversion based on low confidence rate' : undefined,
      },
    };

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
    logger.error('Failed to perform currency conversion', { error });
    
    return NextResponse.json(
      { error: 'Failed to perform currency conversion' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prices/conversion
 * Get conversion rates and supported currencies
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair') || 'RING_USD';

    // Get current rate
    const priceData = await priceOracleService.getRingUsdPrice();
    
    // Calculate both directions
    const ringToUsd = {
      from: 'RING',
      to: 'USD',
      rate: priceData.price,
      inverse_rate: (1 / parseFloat(priceData.price)).toFixed(8),
    };

    const usdToRing = {
      from: 'USD',
      to: 'RING',
      rate: ringToUsd.inverse_rate,
      inverse_rate: priceData.price,
    };

    const response = {
      supported_pairs: [
        { from: 'RING', to: 'USD' },
        { from: 'USD', to: 'RING' },
      ],
      current_rates: [ringToUsd, usdToRing],
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
      fees: {
        conversion_fee_rate: '0%',
        minimum_fee: '0',
        maximum_fee: '0',
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get conversion rates', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve conversion rates' },
      { status: 500 }
    );
  }
}
