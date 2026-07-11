import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service';
import { CreditSpendRequestSchema } from '@/lib/zod/credit-schemas';
import { logger } from '@/lib/logger';
import {
  formatCreditAmount,
  getCreditCurrencyCode,
  getFiatCreditAccountingRate,
} from '@/lib/payments/credit-currency';

/**
 * POST /api/wallet/credit/spend
 * Spend platform credit-balance points via WalletConductor.spendCredits.
 * (Not PaymentConductor — that owns checkout/PSP rails; this is a direct ledger debit API.)
 *
 * Accounting rate = ring-config credit.unitToDefaultCurrency (fiat points → defaultCurrency).
 * Native-token oracle is desk-only — never used for fiat credit spend.
 *
 * Founders /docs/api tree documents POST only.
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
    const creditCurrency = getCreditCurrencyCode();
    const maxSpendAmount = 1000;
    const minSpendAmount = 0.01;

    if (amount > maxSpendAmount) {
      return NextResponse.json(
        { error: `Maximum spend amount is ${formatCreditAmount(maxSpendAmount, creditCurrency)} per transaction` },
        { status: 400 }
      );
    }

    if (amount < minSpendAmount) {
      return NextResponse.json(
        { error: `Minimum spend amount is ${formatCreditAmount(minSpendAmount, creditCurrency)}` },
        { status: 400 }
      );
    }

    // Check if user has sufficient balance before attempting transaction
    const hasSufficientBalance = await creditBalanceService.hasSufficientBalance(
      userId, 
      validatedRequest.amount
    );

    if (!hasSufficientBalance) {
      const currentBalance = await creditBalanceService.getUserCreditBalance(userId);
      
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

    // Fiat points → defaultCurrency (SSOT). Not native-token oracle.
    const usdRate = getFiatCreditAccountingRate()

    // Determine transaction type based on metadata or order context
    let transactionType: 'purchase' | 'membership_fee' | 'payment' = 'purchase';
    
    if (validatedRequest.metadata?.type === 'membership') {
      transactionType = 'membership_fee';
    } else if (validatedRequest.metadata?.type === 'payment') {
      transactionType = 'payment';
    }

    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const result = await WalletConductor.spendCredits({
      userId,
      amount: validatedRequest.amount,
      description: validatedRequest.description,
      orderId: validatedRequest.order_id,
      referenceId: validatedRequest.reference_id,
      metadata: validatedRequest.metadata as Record<string, unknown> | undefined,
      type: transactionType,
      usdRate,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process spend request' },
        { status: 400 },
      )
    }

    logger.info('Credits spent successfully', { 
      userId, 
      amount: validatedRequest.amount,
      type: transactionType,
      transactionId: result.transactionId,
      orderId: validatedRequest.order_id,
      referenceId: validatedRequest.reference_id 
    });

    return NextResponse.json({
      success: true,
      transaction_id: result.transactionId,
      new_balance: result.newBalance,
      amount_spent: validatedRequest.amount,
      usd_equivalent: Math.abs(parseFloat(result.usdEquivalent || '0')).toString(),
      message: `Successfully spent ${formatCreditAmount(validatedRequest.amount, creditCurrency)}`,
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
 * GET /api/wallet/credit/spend — DEPRECATED.
 *
 * Spending summary lives on Server Action `getSpendSummary` and ledger reads on
 * `GET /api/wallet/credit/history`. This path was never documented in founders
 * API tree (POST-only) and had zero in-app callers. Kept as 410 so accidental
 * clients get a clear migration pointer instead of a 500 from the old broken
 * `this._categorizeSpending` call.
 */
export async function GET() {
  await connection()

  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      error:
        'GET /api/wallet/credit/spend is deprecated. Use Server Action getSpendSummary or GET /api/wallet/credit/history for ledger reads. POST remains the credit-spend mutation (WalletConductor.spendCredits).',
      alternatives: {
        spend_mutation: 'POST /api/wallet/credit/spend',
        spend_summary_action: 'getSpendSummary (app/_actions/wallet.ts)',
        credit_history: 'GET /api/wallet/credit/history',
      },
    },
    {
      status: 410,
      headers: {
        Deprecation: 'true',
        Link: '</api/wallet/credit/history>; rel="alternate"',
      },
    },
  )
}
