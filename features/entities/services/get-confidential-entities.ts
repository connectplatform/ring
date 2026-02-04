/**
 * Get Confidential Entities Service
 * 
 * Retrieves confidential entities with pagination and filtering
 * Uses PostgreSQL DatabaseService abstraction
 */

import { Entity } from '@/features/entities/types'
import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

interface getConfidentialEntitiesParams {
  page: number;
  limit: number;
  sort: string;
  filter: string;
  startAfter?: string;
  userId: string;
  userRole: UserRole.CONFIDENTIAL | UserRole.ADMIN;
}

interface getConfidentialEntitiesResult {
  entities: Entity[];
  lastVisible: string | null;
  totalPages: number;
  totalEntities: number;
}

/**
 * React 19 cache() wrapper for request deduplication
 * Prevents redundant queries when called multiple times in same request cycle
 */
export const getConfidentialEntities = cache(async (
  params: getConfidentialEntitiesParams
): Promise<getConfidentialEntitiesResult> => {
  try {
    console.log('Services: getConfidentialEntities - Starting...', params);

    const { limit, startAfter, sort, filter, userRole, page } = params;

    // Validate role: only CONFIDENTIAL or ADMIN allowed here
    if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      throw new Error('Invalid or missing user role for confidential access');
    }

    // Step 1: Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Step 2: Build database query filters
    const dbFilters: any[] = [
      { field: 'isConfidential', operator: '=', value: true }
    ]

    // Apply status filter if provided
    if (filter) {
      dbFilters.push({ field: 'status', operator: '=', value: filter })
    }

    // Parse sorting
    const [sortField, sortDirection] = sort.split(':')

    // Step 3: Get total count for pagination
    const countResult = await db.count('entities', dbFilters)
    const totalEntities = countResult.success ? (countResult.data || 0) : 0
    const totalPages = Math.ceil(totalEntities / limit)

    // Step 4: Execute paginated query
    const result = await db.query({
      collection: 'entities',
      filters: dbFilters,
      orderBy: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
      pagination: { limit, offset: (page - 1) * limit }
    })

    if (!result.success || !result.data) {
      console.error('Services: getConfidentialEntities - Query failed:', result.error)
      throw new Error('Failed to fetch confidential entities')
    }

    // Step 5: Extract entities from result
    const rawEntities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    const entities: Entity[] = rawEntities.map((doc: any) => ({
      ...(doc.data || doc),
      id: doc.id
    }))

    const lastVisible = entities.length > 0 ? entities[entities.length - 1].id : null

    console.log('Services: getConfidentialEntities - Results:', {
      entitiesCount: entities.length,
      totalEntities,
      totalPages,
      lastVisible
    });

    return {
      entities,
      lastVisible,
      totalPages,
      totalEntities
    };
  } catch (error) {
    console.error('Services: getConfidentialEntities - Error:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Unknown error occurred while fetching confidential entities');
  }
});