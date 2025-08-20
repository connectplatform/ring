import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/auth'; 
import { getCachedOpportunitiesForRole } from '@/lib/cached-data';
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

    // Step 5: Fetch opportunities via cached accessor (role-aware tag key)
    console.log('API: /api/opportunities - Fetching opportunities (cached)');
    console.log('API: /api/opportunities - Calling getCachedOpportunitiesForRole with role:', userRole);
    const cached = getCachedOpportunitiesForRole(userRole)
    console.log('API: /api/opportunities - Cached function created, calling with params:', { limit, startAfter });
    const { opportunities, lastVisible } = await cached(limit, startAfter);

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
      console.error('API: /api/opportunities - Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      if (error.message.includes('permission-denied') || error.message.includes('PERMISSION_DENIED')) {
        return NextResponse.json(
          { error: 'Access denied: Forbidden' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('Unauthorized') || error.message.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: 'Unauthorized access' },
          { status: 401 }
        );
      }
      
      // Return more detailed error in development
      const isDev = process.env.NODE_ENV === 'development';
      return NextResponse.json(
        { 
          error: 'Unable to fetch opportunities: Internal Server Error',
          hint: 'Verify Firestore is configured and the `opportunities` collection exists.',
          ...(isDev && { details: error.message })
        },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Unable to fetch opportunities: Internal Server Error', hint: 'Check server logs for details.' },
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