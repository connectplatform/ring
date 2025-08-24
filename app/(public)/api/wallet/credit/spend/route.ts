import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { CreditSpendRequestSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';
import { UserCreditBalanceSchema } from '@/lib/zod/credit-schemas';

/**
 * POST /api/wallet/credit/spend
 * Spend credits from user's balance
 * 
 * Request body:
 * {
 *   "amount": "10.0",
 *   "description": "Store purchase",
 *   "order_id": "order_123", // Optional order reference
 *   "reference_id": "ref_456", // Optional external reference
 *   "metadata": {} // Optional additional data
 * }
 */
export async function POST(request: NextRequest) {
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
      validatedRequest = CreditSpendRequestSchema.parse(requestBody);
    } catch (validationError) {
      logger.warn('Invalid credit spend request', { 
        userId, 
        requestBody, 
        validationError 
      });
      
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      );
    }

    // Validate amount limits
    const amount = parseFloat(validatedRequest.amount);
    const maxSpendAmount = 1000; // 1,000 RING maximum per transaction
    const minSpendAmount = 0.01; // 0.01 RING minimum

    if (amount > maxSpendAmount) {
      return NextResponse.json(
        { error: `Maximum spend amount is ${maxSpendAmount} RING per transaction` },
        { status: 400 }
      );
    }

    if (amount < minSpendAmount) {
      return NextResponse.json(
        { error: `Minimum spend amount is ${minSpendAmount} RING` },
        { status: 400 }
      );
    }

    // Check if user has sufficient balance before attempting transaction
    const hasSufficientBalance = await userCreditService.hasSufficientBalance(
      userId, 
      validatedRequest.amount
    );

    if (!hasSufficientBalance) {
      const currentBalance = await userCreditService.getUserCreditBalance(userId);
      
      logger.warn('Insufficient balance for spend request', { 
        userId, 
        requestedAmount: validatedRequest.amount,
        currentBalance: currentBalance?.amount || '0' 
      });
      
      return NextResponse.json(
        { 
          error: 'Insufficient credit balance',
          current_balance: currentBalance?.amount || '0',
          required_amount: validatedRequest.amount,
        },
        { status: 400 }
      );
    }

    // TODO: Get current RING/USD rate from price oracle service
    const usdRate = '1.00'; // $1 USD per RING (placeholder)

    // Determine transaction type based on metadata or order context
    let transactionType: 'purchase' | 'membership_fee' | 'payment' = 'purchase';
    
    if (validatedRequest.metadata?.type === 'membership') {
      transactionType = 'membership_fee';
    } else if (validatedRequest.metadata?.type === 'payment') {
      transactionType = 'payment';
    }

    // Spend credits from user balance
    const result = await userCreditService.spendCredits(
      userId,
      validatedRequest,
      transactionType,
      usdRate
    );

    logger.info('Credits spent successfully', { 
      userId, 
      amount: validatedRequest.amount,
      type: transactionType,
      transactionId: result.transaction.id,
      orderId: validatedRequest.order_id,
      referenceId: validatedRequest.reference_id 
    });

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction.id,
      new_balance: result.newBalance,
      amount_spent: validatedRequest.amount,
      usd_equivalent: Math.abs(parseFloat(result.transaction.usd_equivalent)).toString(),
      message: `Successfully spent ${validatedRequest.amount} RING`,
    });

  } catch (error) {
    logger.error('Failed to process credit spend', { error });
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Insufficient balance')) {
        return NextResponse.json(
          { error: 'Insufficient credit balance' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process spend request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallet/credit/spend
 * Get spending summary and limits
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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // day, week, month, year

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get spending history for the period
    const spendingHistory = await userCreditService.getCreditHistory(userId, {
      limit: 100,
      type: 'purchase', // Only get purchase transactions
      start_date: startDate.getTime(),
      end_date: now.getTime(),
    });

    // Calculate spending summary
    const totalSpent = spendingHistory.transactions.reduce((sum, tx) => {
      return sum + Math.abs(parseFloat(tx.amount));
    }, 0);

    // Define spending limits (these could come from user settings or system config)
    const spendingLimits = {
      daily_limit: '100',
      weekly_limit: '500',
      monthly_limit: '2000',
      yearly_limit: '20000',
    };

    // Calculate remaining limits (simplified logic)
    const remainingLimits = {
      daily_remaining: Math.max(0, parseFloat(spendingLimits.daily_limit) - (period === 'day' ? totalSpent : 0)).toString(),
      weekly_remaining: Math.max(0, parseFloat(spendingLimits.weekly_limit) - (period === 'week' ? totalSpent : 0)).toString(),
      monthly_remaining: Math.max(0, parseFloat(spendingLimits.monthly_limit) - (period === 'month' ? totalSpent : 0)).toString(),
      yearly_remaining: Math.max(0, parseFloat(spendingLimits.yearly_limit) - (period === 'year' ? totalSpent : 0)).toString(),
    };

    const response = {
      period,
      period_start: startDate.getTime(),
      period_end: now.getTime(),
      spending_summary: {
        total_spent: totalSpent.toString(),
        transaction_count: spendingHistory.transactions.length,
        average_transaction: spendingHistory.transactions.length > 0 
          ? (totalSpent / spendingHistory.transactions.length).toString()
          : '0',
        largest_transaction: spendingHistory.transactions.length > 0
          ? Math.max(...spendingHistory.transactions.map(tx => Math.abs(parseFloat(tx.amount)))).toString()
          : '0',
      },
      limits: spendingLimits,
      remaining: remainingLimits,
      categories: this._categorizeSpending(spendingHistory.transactions),
    };

    logger.info('Spending summary retrieved', { 
      userId, 
      period, 
      totalSpent,
      transactionCount: spendingHistory.transactions.length 
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get spending summary', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve spending summary' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to categorize spending
 */
function _categorizeSpending(transactions: any[]) {
  const categories: Record<string, { amount: string; count: number }> = {};
  
  transactions.forEach(tx => {
    const category = tx.metadata?.category || 'other';
    const amount = Math.abs(parseFloat(tx.amount));
    
    if (!categories[category]) {
      categories[category] = { amount: '0', count: 0 };
    }
    
    categories[category].amount = (parseFloat(categories[category].amount) + amount).toString();
    categories[category].count++;
  });
  
  return categories;
}
