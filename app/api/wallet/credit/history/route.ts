import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { parseCreditHistoryQuery } from '@/lib/wallet/parse-credit-history-query';
import { logger } from '@/lib/logger';

/**
 * GET /api/wallet/credit/history
 * Get user's credit transaction history with optional filtering
 *
 * Query parameters:
 * - limit: number (1-100, default 50)
 * - after_id: string (pagination cursor)
 * - type: CreditTransactionType (filter by transaction type)
 * - start_date: number (timestamp filter)
 * - end_date: number (timestamp filter)
 */
export async function GET(request: NextRequest) {
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

    const parsed = parseCreditHistoryQuery(request);
    if (parsed.success === false) {
      logger.warn('Invalid credit history query parameters', {
        userId,
        queryParams: parsed.queryParams,
        validationError: parsed.issues,
      });

      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.issues },
        { status: 400 }
      );
    }

    const history = await userCreditService.getCreditHistory(userId, parsed.data);

    logger.info('Credit history retrieved', {
      userId,
      transactionCount: history.transactions.length,
      hasMore: history.has_more,
      queryParams: parsed.data,
    });

    return NextResponse.json(history);
  } catch (error) {
    logger.error('Failed to get credit history', { error });

    return NextResponse.json(
      { error: 'Failed to retrieve credit history' },
      { status: 500 }
    );
  }
}
