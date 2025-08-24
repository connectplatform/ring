import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { CreditBalanceResponseSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/wallet/credit/balance
 * Get current user's credit balance and subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user credit balance
    let creditBalance = await userCreditService.getUserCreditBalance(userId);
    
    // Initialize balance if it doesn't exist
    if (!creditBalance) {
      creditBalance = await userCreditService.initializeCreditBalance(userId);
    }

    // TODO: Get subscription status from blockchain service
    // For now, using the balance data
    const subscriptionStatus = {
      active: creditBalance.subscription_active || false,
      contract_address: creditBalance.subscription_contract_address,
      next_payment: creditBalance.subscription_next_payment,
      status: creditBalance.subscription_active ? 'ACTIVE' as const : 'INACTIVE' as const,
    };

    // Calculate spending limits (example logic)
    const monthlySpendLimit = '1000'; // 1000 RING per month
    const remainingMonthlyLimit = '750'; // Example remaining limit
    const minBalanceWarning = '12'; // 12 RING (1 year of membership)

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

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get credit balance', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve credit balance' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wallet/credit/balance
 * Update user's credit balance (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { user_id, amount, reason } = await request.json();
    
    if (!user_id || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, amount, reason' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Add credits (admin operation)
    const result = await userCreditService.addCredits(
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
      'airdrop', // Admin adjustments are treated as airdrops
      '1.00' // Default USD rate for admin adjustments
    );

    logger.info('Admin credit balance adjustment', { 
      adminId: session.user.id,
      targetUserId: user_id,
      amount,
      reason,
      transactionId: result.transaction.id 
    });

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