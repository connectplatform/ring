import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { getEntitiesForRole, type EntityFilters } from '@/features/entities/services/get-entities';
import { resolveSessionUserRole } from '@/features/auth/user-role';
import type { EntityType } from '@/features/entities/types';

function parseEntityFilters(searchParams: URLSearchParams): EntityFilters {
  const sort = searchParams.get('sort') || 'dateAdded'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const employeeMin = searchParams.get('employeeMin')
  const employeeMax = searchParams.get('employeeMax')
  const foundedMin = searchParams.get('foundedMin')
  const foundedMax = searchParams.get('foundedMax')

  return {
    search: searchParams.get('q') || undefined,
    types: (searchParams.get('types')?.split(',').filter(Boolean) || undefined) as EntityType[] | undefined,
    location: searchParams.get('location') || undefined,
    employeeCountMin: employeeMin ? Number.parseInt(employeeMin, 10) : undefined,
    employeeCountMax: employeeMax ? Number.parseInt(employeeMax, 10) : undefined,
    foundedYearMin: foundedMin ? Number.parseInt(foundedMin, 10) : undefined,
    foundedYearMax: foundedMax ? Number.parseInt(foundedMax, 10) : undefined,
    verificationStatus: (searchParams.get('verification') as EntityFilters['verificationStatus']) || undefined,
    membershipTier: (searchParams.get('tier') as EntityFilters['membershipTier']) || undefined,
    services: searchParams.get('services')?.split(',').filter(Boolean) || undefined,
    hasCertifications:
      searchParams.get('certifications') === 'true'
        ? true
        : searchParams.get('certifications') === 'false'
          ? false
          : undefined,
    hasPartnerships:
      searchParams.get('partnerships') === 'true'
        ? true
        : searchParams.get('partnerships') === 'false'
          ? false
          : undefined,
    sortBy: sort as EntityFilters['sortBy'],
    sortOrder,
  }
}

/**
 * Handles GET requests for fetching entities.
 */
export async function GET(request: NextRequest) {
  await connection()

  console.log('API: /api/entities - Starting GET request');
  try {
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/entities - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = resolveSessionUserRole(session.user.role)

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const startAfter = searchParams.get('startAfter') || undefined;
    const filters = parseEntityFilters(searchParams);

    const { entities, lastVisible, totalCount } = await getEntitiesForRole({
      userRole,
      limit,
      startAfter,
      filters,
    })
    console.log('API: /api/entities - entities retrieved:', { count: entities.length });

    return NextResponse.json(
      {
        entities,
        items: entities,
        lastVisible,
        cursor: lastVisible,
        hasMore: !!lastVisible,
        totalCount,
      },
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
