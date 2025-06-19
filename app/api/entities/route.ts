import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/auth'; // Fixed import to use getServerAuthSession
import { getEntities } from '@/services/entities/get-entities'; // Service that handles Firestore logic
import { UserRole } from '@/features/auth/types';

/**
 * Handles GET requests for fetching entities.
 * 
 * This route allows authenticated users to retrieve entities with pagination.
 * 
 * @param request - The incoming request object
 * @returns A response containing the entities or an error message
 */
export async function GET(request: NextRequest) {
  console.log('API: /api/entities - Starting GET request');
  try {
    // Authenticate the session
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.log('API: /api/entities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('API: /api/entities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Determine user role for filtering
    const userRole: UserRole = (session.user.role as UserRole) || UserRole.SUBSCRIBER;
    console.log('API: /api/entities - User role:', userRole);

    // Get pagination parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const startAfter = searchParams.get('startAfter') || undefined;

    // Fetch entities via service
    const { entities, lastVisible } = await getEntities(limit, startAfter);
    console.log('API: /api/entities - entities retrieved:', { count: entities.length });

    return NextResponse.json(
      { entities, lastVisible }, 
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
    console.error('API: /api/entities - Error occurred:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to access entities' },
          { status: 403 }
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
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';