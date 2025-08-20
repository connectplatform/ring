import { getAdminDb } from '@/lib/firebase-admin.server';
import crypto from 'crypto';

export async function generateNonce(publicAddress: string): Promise<{ nonce: string, expires: number }> {
  console.log('Services: generateNonce - Starting nonce generation process');

  if (!publicAddress) {
    console.error('Services: generateNonce - Public address not provided');
    throw new Error('Public address is required');
  }

  try {
    // Generate a random nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    console.log('Services: generateNonce - Nonce generated');

    // Calculate nonce expiration time (1 hour from now)
    const expires = Date.now() + 3600000; // 1 hour in milliseconds

    // Store the nonce in Firestore
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection('users').doc(publicAddress);
    
    await userRef.set({
      nonce,
      nonceExpires: expires,
    }, { merge: true });

    console.log('Services: generateNonce - Nonce stored in Firestore');

    return { nonce, expires };
  } catch (error) {
    console.error('Services: generateNonce - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while generating nonce');
  }
}

