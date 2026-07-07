import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { isPlatformAdmin } from '@/features/auth/user-role';
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service';
import { CreditBalanceResponseSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';
import { userMigrationService } from '@/features/auth/services/user-migration';

// Simple in-memory cache for balance responses
// TODO: Replace with Next.js 16 Edge Runtime caching for improved scalability and SSR/ISR alignment (see: https://nextjs.org/docs/app/building-your-application/caching)
const balanceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds TTL for cached balance data

/**
 * GET /api/wallet/credit/balance
 * Handler for retrieving the current user's credit balance and subscription status.
 * Returns cached value if inside the TTL; initializes user doc as needed.
 */
export async function GET(request: NextRequest) {
  // Next.js 16: opt out of prerendering (prevents this API route from being statically rendered)
  await connection();

  try {
    // Authenticate the current user/session
    const session = await auth();
    if (!session?.user?.id) {
      // User is not authenticated
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Build per-user cacheKey for credit balance caching
    const cacheKey = `balance_${userId}`;
    const cached = balanceCache.get(cacheKey);

    // If valid cache exists, return early
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.info('Credit balance served from cache', { userId });
      return NextResponse.json(cached.data);
    }

    // Ensure user document exists in database (migration)
    // STUB: Ideally caching/check-then-set should be atomic or backed by DB
    try {
      const userExists = await userMigrationService.userDocumentExists(userId);
      if (!userExists) {
        logger.warn('Credit balance API: User document missing, initializing', { userId });
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('Credit balance API: User document created successfully', { userId });
      }
    } catch (migrationError) {
      // Log error, but continue (graceful degradation; creditBalanceService may recover)
      logger.error('Credit balance API: Failed to check/create user document', {
        userId,
        error: migrationError instanceof Error ? migrationError.message : migrationError
      });
    }

    // Retrieve user credit balance from persistent store
    let creditBalance = await creditBalanceService.getUserCreditBalance(userId);

    // If balance not found, attempt to initialize it
    if (!creditBalance) {
      try {
        creditBalance = await creditBalanceService.initializeCreditBalance(userId);
      } catch (initError) {
        logger.error('Failed to initialize credit balance, returning default zero balance', {
          userId,
          error: initError instanceof Error ? initError.message : initError
        });

        // Return default/zero values (for graceful fallback)
        creditBalance = {
          amount: '0',
          usd_equivalent: '0',
          fiat_currency: 'USD',
          last_updated: Date.now(),
          subscription_active: false,
          // STUB: include any missing fields required for default creditBalance shape
        };
      }
    }

    // TODO: Replace with blockchain subscription service call using Next 16 async API functions.
    // STUB: "subscriptionStatus" is directly derived from user doc (not on-chain)
    const subscriptionStatus = {
      active: creditBalance.subscription_active || false,
      contract_address: creditBalance.subscription_contract_address, // STUB: may be undefined
      next_payment: creditBalance.subscription_next_payment,          // STUB: may be undefined
      status: creditBalance.subscription_active ? 'ACTIVE' as const : 'INACTIVE' as const,
    };

    // TODO: Calculate monthly limits dynamically based on user or org plan, not hard-coded values.
    // STUB: These are currently static example values only
    const monthlySpendLimit = '1000'; // 1000 RING per month
    const remainingMonthlyLimit = '750'; // Example hard-coded "remaining" value
    const minBalanceWarning = '12'; // 12 RING (example hard-coded threshold)

    // Assemble response object in well-structured format (validated shape optional)
    const response = {
      balance: {
        amount: creditBalance.amount,
        usd_equivalent: creditBalance.usd_equivalent,
        last_updated: creditBalance.last_updated,
      },
      subscription: subscriptionStatus,
      limits: {
        monthly_spend_limit: monthlySpendLimit,
        remaining_monthly_limit: remainingMonthlyLimit,
        min_balance_warning: minBalanceWarning,
      },
    };

    logger.info('Credit balance retrieved', {
      userId,
      balance: creditBalance.amount,
      subscriptionActive: subscriptionStatus.active
    });

    // Cache successful response (per-user) in in-memory cache
    balanceCache.set(cacheKey, { data: response, timestamp: Date.now() });

    // TODO: Validate output with zod (CreditBalanceResponseSchema) before returning. Implement via CreditBalanceResponseSchema.safeParse(response).

    return NextResponse.json(response);

  } catch (error) {
    // Thorough error logging for diagnostics
    logger.error('Failed to get credit balance', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve credit balance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wallet/credit/balance
 * Handler for admin credit balance top-up/adjustment (requires admin permission).
 */
export async function PUT(request: NextRequest) {
  await connection(); // Next.js 16: opt out of prerendering

  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      // Not logged in
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only platform admins can update other users' credits
    if (!isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse incoming payload
    const { user_id, amount, reason } = await request.json();

    // Validate required fields presence
    if (!user_id || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, amount, reason' },
        { status: 400 }
      );
    }

    // The amount must be a positive number
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Add credits for the target user (admin operation: reward_credit_add event)
    const result = await creditBalanceService.addCredits(
      user_id,
      {
        amount: amount,
        description: `Admin adjustment: ${reason}`,
        metadata: {
          admin_id: session.user.id,
          admin_email: session.user.email,
          adjustment_reason: reason,
        },
      },
      'reward_credit_add', // Event type for admin adjustment
      '1.00'               // USD exchange rate for admin adjustment (STUB: should be determined by FX service)
    );

    logger.info('Admin credit balance adjustment', {
      adminId: session.user.id,
      targetUserId: user_id,
      amount,
      reason,
      transactionId: result.transaction.id
    });

    // Invalidate balance cache for the adjusted user
    balanceCache.delete(`balance_${user_id}`);

    // TODO: Respond with shape validated by CreditBalanceResponseSchema as needed.

    // Respond with result (transaction and new balance)
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction.id,
      new_balance: result.newBalance,
      message: `Successfully added ${amount} RING to user balance`,
    });

  } catch (error) {
    logger.error('Failed to update credit balance', { error });

    return NextResponse.json(
      { error: 'Failed to update credit balance' },
      { status: 500 }
    );
  }
}