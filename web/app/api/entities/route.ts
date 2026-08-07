import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { getEntitiesForRole, type EntityFilters } from '@/features/entities/services/get-entities';
import { resolveSessionUserRole } from '@/features/auth/user-role';
import type { EntityType } from '@/features/entities/types';

/**
 * Parses URL search parameters into an EntityFilters object.
 * Ensures type conversion and fallbacks for each expected filter.
 */
function parseEntityFilters(searchParams: URLSearchParams): EntityFilters {
  // Extract sorting fields, with default sort field and order
  const sort = searchParams.get('sort') || 'dateAdded';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // Read min/max values for employees and founded years from search params
  const employeeMin = searchParams.get('employeeMin');
  const employeeMax = searchParams.get('employeeMax');
  const foundedMin = searchParams.get('foundedMin');
  const foundedMax = searchParams.get('foundedMax');

  return {
    // Text search filter, or undefined if missing
    search: searchParams.get('q') || undefined,
    // Types filter: split by comma, filter out empty, or undefined if missing
    types: (searchParams.get('types')?.split(',').filter(Boolean) || undefined) as EntityType[] | undefined,
    // Optional filter for location string
    location: searchParams.get('location') || undefined,
    // Parse integer filters, converting only if a value is present
    employeeCountMin: employeeMin ? Number.parseInt(employeeMin, 10) : undefined,
    employeeCountMax: employeeMax ? Number.parseInt(employeeMax, 10) : undefined,
    foundedYearMin: foundedMin ? Number.parseInt(foundedMin, 10) : undefined,
    foundedYearMax: foundedMax ? Number.parseInt(foundedMax, 10) : undefined,
    // Categorical filters (enum)
    verificationStatus: (searchParams.get('verification') as EntityFilters['verificationStatus']) || undefined,
    membershipTier: (searchParams.get('tier') as EntityFilters['membershipTier']) || undefined,
    // Services filter: split comma string to array if present
    services: searchParams.get('services')?.split(',').filter(Boolean) || undefined,
    // Boolean filter for certifications. Only explicit 'true'/'false'
    hasCertifications:
      searchParams.get('certifications') === 'true'
        ? true
        : searchParams.get('certifications') === 'false'
          ? false
          : undefined,
    // Boolean filter for partnerships. Only explicit 'true'/'false'
    hasPartnerships:
      searchParams.get('partnerships') === 'true'
        ? true
        : searchParams.get('partnerships') === 'false'
          ? false
          : undefined,
    // Sorting options
    sortBy: sort as EntityFilters['sortBy'],
    sortOrder,
  };
}

/**
 * Handles GET requests for fetching entities.
 * Validates session, parses filters, fetches entities, and returns a JSON response.
 */
export async function GET(request: NextRequest) {
  // Ensure database connection before processing request
  await connection();

  // TODO: Consider switching to native Next.js 16 caching APIs for fetch, if possible (e.g. revalidateTag or request.cacheControl)
  // TODO: Use the new React 19 Server Actions for form-style filtering if relevant

  console.log('API: /api/entities - Starting GET request');

  try {
    // Attempt to authenticate the user session
    const session = await auth();
    if (!session || !session.user) {
      // User is not authenticated
      console.log('API: /api/entities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine the user's role (with custom logic)
    const userRole = resolveSessionUserRole(session.user.role);

    // Parse relevant query params
    const searchParams = request.nextUrl.searchParams;
    // Limit value, defaults to 20 if not specified
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    // 'startAfter' cursor for pagination, or undefined if not present
    const startAfter = searchParams.get('startAfter') || undefined;
    // Transform query params into entity filter set
    const filters = parseEntityFilters(searchParams);

    // Fetch entities for user's role and filters; handles any internal filtering logic
    const { entities, lastVisible, totalCount } = await getEntitiesForRole({
      userRole,
      limit,
      startAfter,
      filters,
    });

    // Log the number of entities retrieved for debugging
    console.log('API: /api/entities - entities retrieved:', { count: entities.length });

    // Respond with entity data plus standard pagination fields
    return NextResponse.json(
      {
        entities,
        items: entities, // TODO: Once clients migrate to 'entities', remove 'items' for consistency
        lastVisible,
        cursor: lastVisible,
        hasMore: !!lastVisible,
        totalCount,
      },
      {
        status: 200,
        // Disable caching for all responses due to auth-sensitive data
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    // Catch-all for errors/exceptions in handling the request
    console.error('API: /api/entities - Error occurred:', error);

    // Handle permission error cases
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to access entities' },
          { status: 403 }
        );
      }
    }

    // Generic internal server error fallback
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
