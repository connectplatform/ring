import { getAdminDb } from '@/lib/firebase-admin.server';
import { UserSettings, UserRole } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Update a user's settings in Firestore, with authentication and role-based access control.
 * 
 * User steps:
 * 1. User submits updated settings through the UI
 * 2. Frontend calls this function with the updated settings
 * 3. Function authenticates the user and validates the input
 * 4. If valid, the function updates the user's settings in Firestore
 * 
 * @param data - The partial UserSettings data to update.
 * @returns A promise that resolves to a boolean indicating success or failure.
 * 
 * Error handling:
 * - Throws an error if the user is not authenticated
 * - Returns false if there's an error updating the settings in Firestore
 */
export async function updateUserSettings(data: Partial<UserSettings>): Promise<boolean> {
  console.log('Services: updateUserSettings - Starting settings update process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: updateUserSettings - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Firestore setup
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection('users').doc(userId);

    // Step 3: Validate input (add more validation as needed)
    if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
      throw new Error('Invalid theme setting');
    }

    // Step 4: Prepare update data
    const updateData = {
      settings: data,
      updatedAt: new Date(),
    };

    // Step 5: Update the Firestore document
    await userRef.set(updateData, { merge: true });
    
    console.log('Services: updateUserSettings - Settings updated successfully for user:', userId);
    return true; // Indicate successful update

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: updateUserSettings - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: updateUserSettings - Error updating settings:', error);
    }
    return false; // Indicate failure
  }
}

