import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { priceOracleService } from '@/services/blockchain/price-oracle-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/prices/ring-usd
 * Get current RING to USD exchange rate
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: external fetch() requires dynamic opt-out

  try {
    // Get price data from oracle service
    const priceData = await priceOracleService.getRingUsdPrice();
    
    logger.info('RING/USD price requested', { 
      price: priceData.price,
      source: priceData.source,
      confidence: priceData.confidence 
    });

    // Return price with metadata
    return NextResponse.json({
      price: priceData.price,
      timestamp: priceData.timestamp,
      source: priceData.source,
      confidence: priceData.confidence,
      currency_pair: 'RING/USD',
      last_updated: new Date(priceData.timestamp).toISOString(),
      age_seconds: Math.floor((Date.now() - priceData.timestamp) / 1000),
      warning: priceData.confidence < 0.7 ? 'Low confidence price data' : undefined,
    });

  } catch (error) {
    logger.error('Failed to get RING/USD price', { error });
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve current RING price',
        fallback_price: '1.00',
        message: 'Using fallback price due to oracle failure',
      },
      { status: 500 }
    );
  }
}