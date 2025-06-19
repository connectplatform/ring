import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getConfidentialEntities } from '@/services/entities/get-confidential-entities';
import { UserRole } from '@/features/auth/types';

export async function GET(request: NextRequest) {
  console.log('API: /api/confidential/entities - Starting GET request');

  try {
    // Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/confidential/entities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Additional role-based access check for confidential entities
    if (session.user.role !== UserRole.CONFIDENTIAL && session.user.role !== UserRole.ADMIN) {
      console.log('API: /api/confidential/entities - Permission denied', {
        userId: session.user.id,
        role: session.user.role
      });
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    console.log('API: /api/confidential/entities - Session checked', {
      userId: session.user.id,
      role: session.user.role,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Get pagination and filtering parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || 'createdAt:desc';
    const filter = searchParams.get('filter') || '';
    const startAfter = searchParams.get('startAfter') || undefined;

    // Fetch confidential entities via service
    const { 
      entities, 
      lastVisible, 
      totalPages, 
      totalEntities 
    } = await getConfidentialEntities({
      page,
      limit,
      sort,
      filter,
      startAfter,
      userId: session.user.id,
      userRole: session.user.role
    });

    console.log('API: /api/confidential/entities - entities retrieved:', { 
      count: entities.length,
      totalPages,
      totalEntities
    });

    return NextResponse.json({ 
      entities, 
      lastVisible,
      totalPages,
      totalEntities
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('API: /api/confidential/entities - Error occurred:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to access confidential entities' },
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

// Prevent caching for this route
export const dynamic = 'force-dynamic';