import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { getConfidentialEntities } from '@/features/entities/services/get-entities';
import { hasConfidentialAccess } from '@/features/auth/user-role'

export async function GET(request: NextRequest) {
  // Ensure DB/API connection and opt out of Next.js prerendering for this route.
  // (as recommended for dynamic data in Next.js 16)
  await connection();

  // Log the start of the API request for debugging purposes.
  console.log('API: /api/confidential/entities - Starting GET request');

  try {
    // Authenticate the current session and check if a user exists.
    const session = await auth();
    if (!session || !session.user) {
      // No session or no user found: unauthorized attempt.
      console.log('API: /api/confidential/entities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user has permission to access confidential entities.
    if (!hasConfidentialAccess(session.user.role)) {
      // User's role is not permitted.
      console.log('API: /api/confidential/entities - Permission denied', {
        userId: session.user.id,
        role: session.user.role,
      });
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Log successful session & headers (may help in debugging client issues).
    console.log('API: /api/confidential/entities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Extract pagination, sorting, filtering parameters from request query.
    const searchParams = request.nextUrl.searchParams;

    // Page & limit fallback to defaults if query not present.
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || 'createdAt:desc';
    const filter = searchParams.get('filter') || '';
    const startAfter = searchParams.get('startAfter') || undefined;

    // TODO: If params are not valid numbers, fallback to safe values or respond with a 400.

    // Service call to get entities, supports paging and filtering.
    const {
      entities,
      lastVisible,
      totalPages,
      totalEntities,
    } = await getConfidentialEntities({
      page,
      limit,
      sort,
      filter,
      startAfter,
    });

    // Log number of entities and relevant paging meta.
    console.log('API: /api/confidential/entities - entities retrieved:', {
      count: entities.length,
      totalPages,
      totalEntities,
    });

    // Respond with entities and meta info, and with headers to prevent caching.
    return NextResponse.json(
      {
        entities,
        lastVisible,
        totalPages,
        totalEntities,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate', // Prevent response caching.
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    // Log error for debugging.
    console.error('API: /api/confidential/entities - Error occurred:', error);

    // Return different error codes and messages depending on error type/message.
    if (error instanceof Error) {
      // Permission-denied error from DB/API.
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to access confidential entities' },
          { status: 403 }
        );
      }
      // Not-found error from DB/API.
      if (error.message.includes('not-found')) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
    }

    // Fallback for unknown/unhandled errors.
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Prevent caching for this route (handled in response headers).
// TODO: Consider using Next.js route segment config (`export const dynamic = "force-dynamic"`) instead of manual connection+headers.
