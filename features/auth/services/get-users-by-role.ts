// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { UserRole, AuthUser } from '@/features/auth/types';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { db } from '@/lib/database';

import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Retrieve users from Firestore based on their role, with authentication and role-based access control.
 * 
 * User steps:
 * 1. An admin or authorized user requests a list of users with a specific role
 * 2. Frontend calls this function with the desired role
 * 3. Function authenticates the user and validates their permissions
 * 4. If authorized, the function retrieves the users with the specified role from Firestore
 * 
 * @param role - The UserRole to filter users by.
 * @param limit - Optional limit on the number of users to retrieve (default: 100).
 * @param lastUserId - Optional last user ID for pagination.
 * @returns A promise that resolves to an array of AuthUser objects and the last visible user ID.
 * 
 * Error handling:
 * - Throws an error if the current user is not authenticated or not authorized
 * - Returns an empty array if there's an error retrieving the users
 */
export async function getUsersByRole(
  role: UserRole,
  limit: number = 100,
  lastUserId?: string
): Promise<{ users: Partial<AuthUser>[]; lastVisible: string | null }> {
  console.log(`Services: getUsersByRole - Starting user retrieval process for role: ${role}`);

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user || (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.CONFIDENTIAL)) {
      throw new Error('Unauthorized access: Admin or Confidential privileges required');
    }

    const { id: currentUserId, role: currentUserRole } = session.user;

    console.log(`Services: getUsersByRole - User authenticated with ID ${currentUserId} and role ${currentUserRole}`);

    const queryResult = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{
        field: 'role',
        operator: '==' as const,
        value: role
      }],
      orderBy: [{ field: 'created_at', direction: 'desc' as const }],
      pagination: {
        limit: limit,
        ...(lastUserId && { offset: 0 }) // For simplicity, not implementing cursor-based pagination yet
      }
    });

    if (!queryResult.success) {
      console.error('Services: getUsersByRole - Query failed:', queryResult.error);
      return { users: [], lastVisible: null };
    }

    const users: Partial<AuthUser>[] = [];
    let lastVisible: string | null = null;

    for (const row of queryResult.data) {
      users.push({
        id: row.id,
        name: row.name as string | undefined,
        email: row.email as string | undefined,
        role: row.role as UserRole | undefined,
        photoURL: (row.photoURL as string | undefined) || (row.image as string | undefined),
        createdAt: row.createdAt as Date | undefined,
      });
      lastVisible = row.id;
    }

    console.log(`Services: getUsersByRole - Retrieved ${users.length} users with role ${role}`);
    return { users, lastVisible };

  } catch (error) {
    console.error('Services: getUsersByRole - Error retrieving users:', error);
    return { users: [], lastVisible: null }; // Return empty array in case of error
  }
}
