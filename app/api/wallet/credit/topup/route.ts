import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service';
import { CreditTopUpRequestSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';
import { formatCreditAmount, getCreditCurrencyCode } from '@/lib/payments/credit-currency';
import { isPlatformAdmin } from '@/features/auth/user-role';
import {
  isChainProofRequired,
  reserveTopUpTxHash,
  verifyTopUpTransaction,
} from '@/features/wallet/services/topup-verification';
import { getWalletAddressesForUser } from '@/features/refcodes/lib/user-wallets';
import { nativeTokenPriceOracleService } from '@/services/blockchain/price-oracle-service';
import { getNativeChainConfig } from '@/lib/ring-config-chain';

/**
 * POST /api/wallet/credit/topup
 * Handler for credit top-up to user's wallet.
 * 
 * Expects JSON body:
 * {
 *   "amount": "100.0",
 *   "description": "Top-up from wallet",
 *   "tx_hash": "0x...", // Optional blockchain transaction hash
 *   "metadata": {} // Optional additional data
 * }
 */
export async function POST(request: NextRequest) {
  // Opt out of prerendering in Next.js 16 (required for serverless DB connections)
  await connection();

  try {
    // Authenticate and validate session
    const session = await auth();
    if (!session?.user?.id) {
      // No user, unauthorized request
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    // Parse the incoming request JSON
    const requestBody = await request.json();

    // Validate request body shape and content
    let validatedRequest;
    try {
      validatedRequest = CreditTopUpRequestSchema.parse(requestBody);
    } catch (validationError) {
      // Log malformed input for debugging/auditing
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

    // Security check: enforce min/max amount limits
    const amount = parseFloat(validatedRequest.amount);
    const creditCurrency = getCreditCurrencyCode();
    const maxTopUpAmount = 10000; // TODO: move to config or env
    const minTopUpAmount = 0.01;

    if (amount > maxTopUpAmount) {
      // Reject too-large top up
      return NextResponse.json(
        { error: `Maximum top-up amount is ${formatCreditAmount(maxTopUpAmount, creditCurrency)}` },
        { status: 400 }
      );
    }

    if (amount < minTopUpAmount) {
      // Reject tiny top up
      return NextResponse.json(
        { error: `Minimum top-up amount is ${formatCreditAmount(minTopUpAmount, creditCurrency)}` },
        { status: 400 }
      );
    }

    // Lookup current native token/USD rate (Solana default chain, fallback to 1.00 on error)
    let usdRate = '1.00';
    try {
      // Fetch rate from multi-source blockchain price oracle (can be cached)
      // TODO: use React Server Actions for price oracle when available in Next16
      const solanaChainId = getNativeChainConfig().solana?.chainId as number; // STUB: null-check chainId
      const price = await nativeTokenPriceOracleService.getNativeTokenUsdPrice(solanaChainId);
      if (price?.price && parseFloat(price.price) > 0) {
        usdRate = price.price;
      }
    } catch (oracleError) {
      // Log oracle issues, fallback to static rate for reliability
      logger.warn('Credit top-up: price oracle unavailable, using fallback rate', { oracleError });
    }

    // Prepare transaction type: support for top_up, bonus, admin/manual, etc.
    // TODO: Implement transaction type inference based on metadata or admin action
    let transactionType:
      | 'top_up'
      | 'bonus'
      | 'payment'
      | 'reward_credit_add'
      | 'reimbursement'
      | 'purchase'
      | 'membership_fee'
      | 'penalty'
      | 'desk_buy'
      | 'desk_sell'
      | 'desk_refund' = 'top_up';

    // TODO: Implement airdrop/bonus credit minting logic using Next Actions (when available)
    // STUB: implement native token airdrops (step-by-step: infer type from metadata, verify admin, update logic below)

    // If this is an airdrop/bonus/promotion, only admins are allowed.
    if (transactionType !== 'top_up' && !isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Airdrop and bonus credits require admin access' },
        { status: 403 }
      );
    }

    // For standard top-ups, blockchain proof may be required as platform-level policy.
    if (transactionType === 'top_up' && isChainProofRequired()) {
      // Must provide a tx_hash matching chain transfer to treasury
      if (!validatedRequest.tx_hash) {
        return NextResponse.json(
          { error: 'tx_hash is required: top-ups must reference an on-chain transfer' },
          { status: 400 }
        );
      }

      // Attempt to reserve the tx_hash to prevent double-spending
      const reserved = await reserveTopUpTxHash(
        validatedRequest.tx_hash,
        userId,
        validatedRequest.amount
      );
      if (!reserved) {
        // Double-spend or replay, tx_hash already used
        return NextResponse.json(
          { error: 'This transaction hash was already used for a top-up' },
          { status: 409 }
        );
      }

      // Check the user's saved wallets to verify the transaction source
      // TODO: Use cache or session-provided wallets if available for performance
      const userWallets = await getWalletAddressesForUser(userId);
      // Validate the on-chain transfer itself
      const verification = await verifyTopUpTransaction({
        txHash: validatedRequest.tx_hash,
        amount: validatedRequest.amount,
        userWallets,
      });

      if (!verification.verified) {
        // Log the details of chain verification failure for audit
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

    // Top-up passed all validation: apply credit increment/add transaction
    // TODO: Switch to React Server Actions under Next 16 for improved streaming and error propagation
    const result = await creditBalanceService.addCredits(
      userId,
      validatedRequest,
      transactionType,
      usdRate
    );

    // Log successful credit event for audit/tracking
    logger.info('Credits added via top-up', { 
      userId, 
      amount: validatedRequest.amount,
      type: transactionType,
      transactionId: result.transaction.id,
      txHash: validatedRequest.tx_hash 
    });

    // Return updated balance and transaction metadata to client
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction.id,
      new_balance: result.newBalance,
      amount_added: validatedRequest.amount,
      usd_equivalent: result.transaction.usd_equivalent,
      message: `Successfully added ${formatCreditAmount(validatedRequest.amount, creditCurrency)} to your balance`,
    });

  } catch (error) {
    // Handle runtime and uncaught errors
    logger.error('Failed to process credit top-up', { error });
    // Specific error feedback for user/admin-side errors
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }
    }
    // Fallback: Generic error in the top-up flow
    return NextResponse.json(
      { error: 'Failed to process top-up request' },
      { status: 500 }
    );
  }
}