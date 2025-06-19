import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/auth'; 
import { getOpportunities } from '@/services/opportunities/get-opportunities';
import { UserRole } from '@/features/auth/types';

/**
 * GET handler for /api/opportunities
 * Fetches a list of opportunities based on user role and pagination parameters
 */
export async function GET(req: NextRequest) {
  console.log('API: /api/opportunities - Starting GET request');

  try {
    // Step 1: Authenticate the session
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.log('API: /api/opportunities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Log session details
    console.log('API: /api/opportunities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(req.headers.entries()),
    });

    // Step 3: Determine user role for filtering
    const userRole: UserRole = (session.user.role as UserRole) || UserRole.SUBSCRIBER;
    console.log('API: /api/opportunities - User role:', userRole);

    // Step 4: Parse query parameters for pagination
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const startAfter = searchParams.get('startAfter') || undefined;

    console.log('API: /api/opportunities - Pagination params:', { limit, startAfter });

    // Step 5: Fetch opportunities via service
    console.log('API: /api/opportunities - Fetching opportunities from service');
    const { opportunities, lastVisible } = await getOpportunities(limit, startAfter);

    // Step 6: Log the result
    console.log('API: /api/opportunities - opportunities retrieved:', {
      count: opportunities.length,
      hasMore: !!lastVisible,
    });

    // Step 7: Return the opportunities and pagination info
    return NextResponse.json(
      { opportunities, lastVisible }, 
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    // Step 8: Error handling
    console.error('API: /api/opportunities - Error occurred:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Access denied: Forbidden' },
          { status: 403 }
        );
      }
      // Add more specific error handling here if needed
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Unable to fetch opportunities: Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';

/**
 * Note: If you need to add POST, PUT, or DELETE methods in the future,
 * you can add them here following a similar structure.
 * 
 * Example:
 * 
 * export async function POST(req: NextRequest) {
 *   // Handle POST requests
 * }
 */