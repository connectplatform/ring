import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { CreditTopUpRequestSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';
import { isPlatformAdmin } from '@/features/auth/user-role';
import {
  isChainProofRequired,
  reserveTopUpTxHash,
  verifyTopUpTransaction,
} from '@/features/wallet/services/topup-verification';
import { getWalletAddressesForUser } from '@/features/refcodes/lib/user-wallets';
import { priceOracleService } from '@/services/blockchain/price-oracle-service';

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

    // RING/USD rate from the price oracle (multi-source with cached fallback)
    let usdRate = '1.00';
    try {
      const price = await priceOracleService.getRingUsdPrice();
      if (price?.price && parseFloat(price.price) > 0) {
        usdRate = price.price;
      }
    } catch (oracleError) {
      logger.warn('Credit top-up: price oracle unavailable, using fallback rate', { oracleError });
    }

    // Determine transaction type based on metadata
    let transactionType: 'top_up' | 'airdrop' | 'bonus' = 'top_up';

    if (validatedRequest.metadata?.type === 'airdrop') {
      transactionType = 'airdrop';
    } else if (validatedRequest.metadata?.type === 'bonus') {
      transactionType = 'bonus';
    }

    // Airdrop/bonus mint credits without chain proof — admin only.
    if (transactionType !== 'top_up' && !isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Airdrop and bonus credits require admin access' },
        { status: 403 }
      );
    }

    // Regular top-ups must be backed by an on-chain transfer to the treasury.
    if (transactionType === 'top_up' && isChainProofRequired()) {
      if (!validatedRequest.tx_hash) {
        return NextResponse.json(
          { error: 'tx_hash is required: top-ups must reference an on-chain transfer' },
          { status: 400 }
        );
      }

      const reserved = await reserveTopUpTxHash(validatedRequest.tx_hash, userId, validatedRequest.amount);
      if (!reserved) {
        return NextResponse.json(
          { error: 'This transaction hash was already used for a top-up' },
          { status: 409 }
        );
      }

      const userWallets = await getWalletAddressesForUser(userId);
      const verification = await verifyTopUpTransaction({
        txHash: validatedRequest.tx_hash,
        amount: validatedRequest.amount,
        userWallets,
      });

      if (!verification.verified) {
        logger.warn('Credit top-up: chain verification failed', {
          userId,
          txHash: validatedRequest.tx_hash,
          reason: verification.reason,
        });
        return NextResponse.json(
          { error: `Transaction verification failed: ${verification.reason}` },
          { status: 400 }
        );
      }
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