import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { 
  CreditHistoryRequestSchema,
  CreditTransactionType,
} from '@/lib/zod/credit-schemas';
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

    // Parse and validate query parameters
    const queryParams = {
      limit: parseInt(searchParams.get('limit') || '50'),
      after_id: searchParams.get('after_id') || undefined,
      type: searchParams.get('type') as CreditTransactionType | undefined,
      start_date: searchParams.get('start_date') 
        ? parseInt(searchParams.get('start_date')!) 
        : undefined,
      end_date: searchParams.get('end_date') 
        ? parseInt(searchParams.get('end_date')!) 
        : undefined,
    };

    // Validate query parameters
    try {
      CreditHistoryRequestSchema.parse(queryParams);
    } catch (validationError) {
      logger.warn('Invalid credit history query parameters', { 
        userId, 
        queryParams, 
        validationError 
      });
      
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationError },
        { status: 400 }
      );
    }

    // Get credit history
    const history = await userCreditService.getCreditHistory(userId, queryParams);

    logger.info('Credit history retrieved', { 
      userId, 
      transactionCount: history.transactions.length,
      hasMore: history.has_more,
      queryParams 
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