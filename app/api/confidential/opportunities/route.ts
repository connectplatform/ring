import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getConfidentialOpportunities } from '@/services/opportunities/get-confidential-opportunities';
import { UserRole } from '@/features/auth/types';

/**
 * API endpoint for retrieving confidential opportunities
 * 
 * User Flow:
 * 1. User makes GET request to /api/confidential/opportunities
 * 2. System authenticates the user's session
 * 3. System verifies user has appropriate role (CONFIDENTIAL or ADMIN)
 * 4. System processes query parameters for pagination, sorting, and filtering
 * 5. System retrieves and returns filtered confidential opportunities
 * 
 * URL Parameters:
 * @param {string} page - Page number for pagination (default: 1)
 * @param {string} limit - Number of items per page (default: 20)
 * @param {string} sort - Sort order (format: field:direction, default: createdAt:desc)
 * @param {string} filter - Filter string for searching opportunities
 * @param {string} startAfter - Cursor for pagination after specific record
 * 
 * Response Format:
 * {
 *   opportunities: Array<Opportunity>,
 *   totalPages: number,
 *   totalOpportunities: number,
 *   lastVisible: string | null
 * }
 * 
 * Error Responses:
 * - 401: Unauthorized (no valid session)
 * - 403: Permission denied (insufficient role)
 * - 404: Resource not found
 * - 500: Internal server error
 * 
 * Security:
 * - Requires authenticated session
 * - Requires CONFIDENTIAL or ADMIN role
 * - No caching allowed (force-dynamic route)
 */
export async function GET(request: NextRequest) {
  console.log('API: /api/confidential/opportunities - Starting GET request');

  try {
    // Step 1: Authentication
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/confidential/opportunities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Authorization
    if (session.user.role !== UserRole.CONFIDENTIAL && session.user.role !== UserRole.ADMIN) {
      console.log('API: /api/confidential/opportunities - Permission denied', {
        userId: session.user.id,
        role: session.user.role
      });
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    console.log('API: /api/confidential/opportunities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Step 3: Parse Query Parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || 'createdAt:desc';
    const filter = searchParams.get('filter') || '';
    const startAfter = searchParams.get('startAfter') || undefined;

    // Step 4: Retrieve Data
    const result = await getConfidentialOpportunities({
      page,
      limit,
      sort,
      filter,
      startAfter,
      userId: session.user.id,
      userRole: session.user.role as UserRole.CONFIDENTIAL | UserRole.ADMIN
    });

    console.log('API: /api/confidential/opportunities - opportunities retrieved:', {
      count: result.opportunities.length,
      totalPages: result.totalPages,
      totalOpportunities: result.totalOpportunities,
      lastVisible: result.lastVisible
    });

    // Step 5: Return Response
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    // Step 6: Error Handling
    console.error('API: /api/confidential/opportunities - Error occurred:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to access confidential opportunities' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('not-found')) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Route Configuration
 * force-dynamic: Prevents caching of this route at the Next.js level
 * This ensures that each request always fetches fresh data
 */
export const dynamic = 'force-dynamic';
