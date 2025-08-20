import { getAdminAuth } from '@/lib/firebase-admin.server';
import { UserRole } from '@/features/auth/types';

export async function setUserRole(uid: string, role: UserRole) {
  try {
    const adminAuth = await getAdminAuth();
    await adminAuth.setCustomUserClaims(uid, { role });
    console.log(`Role '${role}' set for user ${uid}`);
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw error;
  }
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  try {
    const adminAuth = await getAdminAuth();
    const user = await adminAuth.getUser(uid);
    return (user.customClaims?.role as UserRole) || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    throw error;
  }
}

export async function verifyUserRole(uid: string, requiredRole: UserRole): Promise<boolean> {
  try {
    const userRole = await getUserRole(uid);
    return userRole === requiredRole;
  } catch (error) {
    console.error('Error verifying user role:', error);
    return false;
  }
}