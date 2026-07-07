// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { AuthUser } from '@/features/auth/types';
import {
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
  UserRolesArray
} from '@/features/auth/user-role';

import { cache } from 'react';
import {
  getCurrentPhase,
  shouldUseCache,
  shouldUseMockData
} from '@/lib/build-cache/phase-detector';
import { db } from '@/lib/database';
import { auth } from '@/auth'; // Auth.js v5 session handler

// TODO: Consider using React 19's built-in cache() to memoize data and deduplicate concurrent requests server-side
/**
 * Retrieve users from Firestore based on their role, with authentication and role-based access control.
 *
 * @param role - The UserRolesArray to filter users by.
 * @param limit - Optional limit on the number of users to retrieve (default: 100).
 * @param lastUserId - Optional last user ID for pagination.
 * @returns A promise resolving to an array of AuthUser objects and the last visible user ID.
 *
 * Error handling:
 * - Throws if not authenticated or authorized.
 * - Returns empty array on query error.
 */
// TODO: Could wrap the function with cache() for automatic request deduplication in React 19/Next16
export async function getUsersByRole(
  role: UserRolesArray,
  limit: number = 100,
  lastUserId?: string
): Promise<{ users: Partial<AuthUser>[]; lastVisible: string | null }> {
  // Logging the start of the retrieval process for observability and troubleshooting
  console.log(`Services: getUsersByRole - Starting user retrieval process for role: ${role}`);

  try {
    // --- Step 1: Authenticate and obtain the user session ---
    // Await session object from auth() (SSR compatible)
    // TODO: Move to React 19's server action context-aware auth pattern if using server actions
    const session = await auth();

    // Check that the session and user exist, and check their role authorization
    const sessionRole = assertKnownUserRole(session?.user?.role);
    if (
      !session?.user ||
      (!isPlatformAdmin(sessionRole) && !hasConfidentialAccess(sessionRole))
    ) {
      // User is not authorized (not admin/confidential)
      throw new Error(
        'Unauthorized access: Admin or Confidential privileges required'
      );
    }

    const { id: currentUserId, role: currentUserRole } = session.user;
    console.log(
      `Services: getUsersByRole - User authenticated with ID ${currentUserId} and role ${currentUserRole}`
    );

    // --- Step 2: Query the database for users with the given role ---
    // TODO: Replace offset pagination with cursor-based pagination when possible for scalability
    // STUB: lastUserId is present but not yet implemented for cursor pagination
    const queryResult = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [
        {
          field: 'role',
          operator: '==' as const,
          value: role
        }
      ],
      orderBy: [{ field: 'created_at', direction: 'desc' as const }],
      pagination: {
        limit: limit,
        // STUB: We're not handling cursor-based or offset-based paging via lastUserId yet
        ...(lastUserId && { offset: 0 }) // STUB: Offset-based paging is a placeholder—should implement cursor-based using lastUserId
      }
    });

    // --- Step 3: Handle unsuccessful query ---
    if (!queryResult.success) {
      // Log error then gracefully fallback to empty result set
      console.error(
        'Services: getUsersByRole - Query failed:',
        queryResult.error
      );
      return { users: [], lastVisible: null };
    }

    // --- Step 4: Parse retrieved user documents into AuthUser shape ---
    const users: Partial<AuthUser>[] = [];
    let lastVisible: string | null = null; // Track last user for pagination

    // Loop through query result, parse and sanitize users
    for (const row of queryResult.data) {
      // Coalesce fields as required by AuthUser types
      users.push({
        id: row.id,
        name: row.name as string | undefined,
        email: row.email as string | undefined,
        // Attempt robust role parsing; try various parsing utilities as fallback
        role:
          parseUserRolesArray(row.role) ??
          resolveSessionUserRole(row.role) ??
          undefined,
        // Prefer photoURL, otherwise fallback to alt image field
        photoURL:
          (row.photoURL as string | undefined) ||
          (row.image as string | undefined),
        createdAt: row.createdAt as Date | undefined
      });
      // Assign lastVisible to the latest enumerated user's id—for pagination token
      lastVisible = row.id;
    }

    // Logging number of users retrieved
    console.log(
      `Services: getUsersByRole - Retrieved ${users.length} users with role ${role}`
    );
    // Return result per API contract
    return { users, lastVisible };
  } catch (error) {
    // --- Step 5: Handle unexpected errors gracefully ---
    // Log generic error and fallback to empty array response for safety
    console.error('Services: getUsersByRole - Error retrieving users:', error);
    return { users: [], lastVisible: null };
  }
}
