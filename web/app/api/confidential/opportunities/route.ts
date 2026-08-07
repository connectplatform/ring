import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { getConfidentialOpportunities } from '@/features/opportunities/services/get-confidential-opportunities';
import { hasConfidentialAccess } from '@/features/auth/user-role';

/**
 * API endpoint for retrieving confidential opportunities
 * 
 * User Flow:
 * 1. User makes GET request to /api/confidential/opportunities
 * 2. System authenticates the user's session
 * 3. System verifies user has appropriate role (confidential or admin)
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
 * - Requires confidential or admin role
 * - Dynamic rendering (no caching)
 */
export async function GET(request: NextRequest) {
  // Opt out of prerendering - ensures this endpoint is always executed at runtime.
  await connection();

  // TODO: Consider implementing a request logging middleware or using the new Next.js instrumentation hooks for standardized logging.

  console.log('API: /api/confidential/opportunities - Starting GET request');

  try {
    // ========== Step 1: User Authentication ==========
    // Checks if there is a valid user session.
    const session = await auth();
    if (!session || !session.user) {
      // No session found, unauthorized.
      console.log('API: /api/confidential/opportunities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ========== Step 2: User Authorization ==========
    // Validates whether the user has confidential access (confidential or admin).
    if (!hasConfidentialAccess(session.user.role)) {
      // User does not have required permissions.
      console.log('API: /api/confidential/opportunities - Permission denied', {
        userId: session.user.id,
        role: session.user.role
      });
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Log session details (for debugging/audit trail).
    console.log('API: /api/confidential/opportunities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // ========== Step 3: Parse Query Parameters ==========
    // This section parses pagination, sorting, filtering, and cursor parameters from the request URL.
    const searchParams = request.nextUrl.searchParams;
    // Default page is 1 if not specified.
    const page = parseInt(searchParams.get('page') || '1', 10);
    // Default limit is 20 if not specified.
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    // Default sort is by createdAt descending.
    const sort = searchParams.get('sort') || 'createdAt:desc';
    // Default filter is empty (no search).
    const filter = searchParams.get('filter') || '';
    // startAfter can be used as a cursor for efficient pagination.
    const startAfter = searchParams.get('startAfter') || undefined;

    // TODO: Could validate query parameters for min/max values and correct formatting here.

    // ========== Step 4: Retrieve Data ==========
    // Fetches confidential opportunities based on parsed parameters.
    const result = await getConfidentialOpportunities({
      page,
      limit,
      sort,
      filter,
      startAfter,
    });

    // Logging the outcome for debugging and monitoring.
    console.log('API: /api/confidential/opportunities - opportunities retrieved:', {
      count: result.opportunities.length,
      totalPages: result.totalPages,
      totalOpportunities: result.totalOpportunities,
      lastVisible: result.lastVisible
    });

    // ========== Step 5: Return Response ==========
    // Responds with the paginated, filtered confidential opportunities.
    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Prevents caching by clients or proxies.
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    // TODO: If using larger datasets, consider native Next.js streaming/partial responses for improved performance.

  } catch (error) {
    // ========== Step 6: Error Handling ==========
    // Any errors during authentication, permission checking, parameter parsing, or data retrieval end up here.
    console.error('API: /api/confidential/opportunities - Error occurred:', error);

    // Handles known error scenarios for granular error reporting.
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        // Backend explicitly denied permission.
        return NextResponse.json(
          { error: 'Permission denied to access confidential opportunities' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('not-found')) {
        // Resource was not found on lookup.
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
    }

    // Generic internal server error fallback for any unknown/unhandled exceptions.
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// TODO: Starting in Next.js 16, route-specific configuration (dynamic='force-dynamic') can be set for always dynamic rendering instead of relying on connection()
// TODO: Add zod or similar schema validation for query params for more robust API (Next.js 16 supports middlewares and advanced validations)

/**
 * Route Configuration
 * This ensures that each request always fetches fresh data
 */
