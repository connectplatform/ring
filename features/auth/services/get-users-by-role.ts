import { getAdminDb } from '@/lib/firebase-admin.server';
import { UserRole, AuthUser } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
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

    // Step 2: Firestore setup
    const adminDb = await getAdminDb();
    let query = adminDb.collection('users').where('role', '==', role).orderBy('createdAt', 'desc').limit(limit);

    // Apply pagination if lastUserId is provided
    if (lastUserId) {
      const lastUserDoc = await adminDb.collection('users').doc(lastUserId).get();
      query = query.startAfter(lastUserDoc);
    }

    // Step 3: Retrieve users
    const snapshot = await query.get();

    const users: Partial<AuthUser>[] = [];
    let lastVisible: string | null = null;

    snapshot.forEach((doc) => {
      const userData = doc.data() as AuthUser;
      users.push({
        id: doc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        photoURL: userData.photoURL,
        createdAt: userData.createdAt,
      });
      lastVisible = doc.id;
    });

    console.log(`Services: getUsersByRole - Retrieved ${users.length} users with role ${role}`);
    return { users, lastVisible };

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: getUsersByRole - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: getUsersByRole - Error retrieving users:', error);
    }
    return { users: [], lastVisible: null }; // Return empty array in case of error
  }
}

