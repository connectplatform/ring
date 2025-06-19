import { getAuth, applyActionCode, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-client';

export async function verifyEmailAddress(oobCode: string): Promise<void> {
  const auth = getAuth();

  try {
    await applyActionCode(auth, oobCode);

    // Update the user's emailVerified status in Firestore
    const user = auth.currentUser;
    if (user) {
      await updateUserEmailVerificationStatus(user);
    }

    console.log("Email verified successfully");
  } catch (error) {
    console.error("Error verifying email:", error);
    throw error;
  }
}

async function updateUserEmailVerificationStatus(user: User): Promise<void> {
  const userRef = doc(db, 'userProfiles', user.uid);
  await updateDoc(userRef, {
    emailVerified: new Date(),
    isVerified: true,
  });
}

