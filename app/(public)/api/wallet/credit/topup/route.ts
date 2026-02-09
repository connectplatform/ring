import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { CreditTopUpRequestSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';

/**
 * POST /api/wallet/credit/topup
 * Add credits to user's balance
 * 
 * Request body:
 * {
 *   "amount": "100.0",
 *   "description": "Top-up from wallet",
 *   "tx_hash": "0x...", // Optional blockchain transaction hash
 *   "metadata": {} // Optional additional data
 * }
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const requestBody = await request.json();

    // Validate request body
    let validatedRequest;
    try {
      validatedRequest = CreditTopUpRequestSchema.parse(requestBody);
    } catch (validationError) {
      logger.warn('Invalid credit top-up request', { 
        userId, 
        requestBody, 
        validationError 
      });
      
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      );
    }

    // Validate amount limits (security measure)
    const amount = parseFloat(validatedRequest.amount);
    const maxTopUpAmount = 10000; // 10,000 RING maximum per transaction
    const minTopUpAmount = 0.01; // 0.01 RING minimum

    if (amount > maxTopUpAmount) {
      return NextResponse.json(
        { error: `Maximum top-up amount is ${maxTopUpAmount} RING` },
        { status: 400 }
      );
    }

    if (amount < minTopUpAmount) {
      return NextResponse.json(
        { error: `Minimum top-up amount is ${minTopUpAmount} RING` },
        { status: 400 }
      );
    }

    // TODO: Get current RING/USD rate from price oracle service
    // For now, using a default rate
    const usdRate = '1.00'; // $1 USD per RING (placeholder)

    // Determine transaction type based on metadata
    let transactionType: 'top_up' | 'airdrop' | 'bonus' = 'top_up';
    
    if (validatedRequest.metadata?.type === 'airdrop') {
      transactionType = 'airdrop';
    } else if (validatedRequest.metadata?.type === 'bonus') {
      transactionType = 'bonus';
    }

    // Add credits to user balance
    const result = await userCreditService.addCredits(
      userId,
      validatedRequest,
      transactionType,
      usdRate
    );

    logger.info('Credits added via top-up', { 
      userId, 
      amount: validatedRequest.amount,
      type: transactionType,
      transactionId: result.transaction.id,
      txHash: validatedRequest.tx_hash 
    });

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction.id,
      new_balance: result.newBalance,
      amount_added: validatedRequest.amount,
      usd_equivalent: result.transaction.usd_equivalent,
      message: `Successfully added ${validatedRequest.amount} RING to your balance`,
    });

  } catch (error) {
    logger.error('Failed to process credit top-up', { error });
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process top-up request' },
      { status: 500 }
    );
  }
}