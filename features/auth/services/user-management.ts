import { getAdminAuth } from '@/lib/firebase-admin.server'; 
// TODO: Move logic to db() abstraction centralized service if possible
// TODO: This file directly interacts with Firebase admin SDK. If mocking is needed for tests or local development, mock getAdminAuth() and all adminAuth methods to return predictable data step-by-step:
// 1. Mock getAdminAuth to resolve to an object with setCustomUserClaims & getUser methods.
// 2. setCustomUserClaims should simulate successful writes.
// 3. getUser should resolve to objects with customClaims property.
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role';

/**
 * Sets a custom user role as a custom claim for the user in Firebase Authentication.
 * @param uid The user ID of the target Firebase user.
 * @param role The role to set for the user (must be a valid UserRolesArray value).
 */
export async function setUserRole(uid: string, role: UserRolesArray) {
  try {
    // Fetch the admin authentication instance.
    const adminAuth = await getAdminAuth();

    // Set custom claims for the user to include their role.
    await adminAuth.setCustomUserClaims(uid, { role });

    // Informational log for tracking.
    console.log(`Role '${role}' set for user ${uid}`);
  } catch (error) {
    // Catch and log any errors that occur during custom claim assignment.
    console.error('Error setting custom claims:', error);
    throw error;
  }
}

/**
 * Retrieves the custom user role from Firebase Authentication for the given user.
 * @param uid The user ID whose role should be retrieved.
 * @returns The user role, or null if not assigned.
 */
export async function getUserRole(uid: string): Promise<UserRolesArray | null> {
  try {
    // Obtain the admin authentication instance.
    const adminAuth = await getAdminAuth();

    // Fetch the user record from Firebase Authentication.
    const user = await adminAuth.getUser(uid);

    // Return the role from custom claims, if present.
    return (user.customClaims?.role as UserRolesArray) || null;
  } catch (error) {
    // Log retrieval errors explicitly.
    console.error('Error getting user role:', error);
    throw error;
  }
}

/**
 * Verifies that the given user's role matches the required role.
 * @param uid The user ID to verify.
 * @param requiredRole The required role to check.
 * @returns True if the user's role matches the required role, false otherwise.
 */
// TODO: With Next.js 16, consider moving this RBAC logic onto server-only route handlers or using Next.js Middleware for some authorization checks, if possible.
export async function verifyUserRole(uid: string, requiredRole: UserRolesArray): Promise<boolean> {
  try {
    // Retrieve the user's current role.
    const userRole = await getUserRole(uid);

    // Assert the user's role is known and perform equality check.
    // NOTE: assertKnownUserRole likely throws if userRole is not valid.
    return assertKnownUserRole(userRole as UserRolesArray) === requiredRole;
  } catch (error) {
    // Upon error (e.g. unknown role, user not found etc.), fail gracefully and log.
    console.error('Error verifying user role:', error);
    return false;
  }
}
