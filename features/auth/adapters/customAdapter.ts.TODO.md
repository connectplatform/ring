import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "@auth/core/adapters"
import { UserRole } from "@/features/auth/types"
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin-server'

export function createCustomAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const adminDb = await getAdminDb();
      const { id } = await adminDb.collection('users').add({
        ...user,
        role: UserRole.SUBSCRIBER,
        walletAddress: undefined,
        createdAt: new Date(),
        lastLogin: new Date(),
      });
      return { 
        ...user, 
        id, 
        image: user.image ?? null,
      };
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const adminDb = await getAdminDb();
      const doc = await adminDb.collection('users').doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data();
      return { 
        id: doc.id, 
        name: data?.name ?? null, 
        email: data?.email ?? '',
        emailVerified: data?.emailVerified ? new Date(data.emailVerified) : null,
        image: data?.image ?? null,
      };
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const adminDb = await getAdminDb();
      const snapshot = await adminDb.collection('users').where('email', '==', email).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      const data = doc.data();
      return { 
        id: doc.id, 
        name: data.name ?? null, 
        email: data.email ?? '',
        emailVerified: data.emailVerified ? new Date(data.emailVerified) : null,
        image: data.image ?? null,
      };
    },

    async getUserByAccount(account: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
      const adminDb = await getAdminDb();
      const snapshot = await adminDb.collection('accounts')
        .where('provider', '==', account.provider)
        .where('providerAccountId', '==', account.providerAccountId)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const accountDoc = snapshot.docs[0];
      const userDoc = await adminDb.collection('users').doc(accountDoc.data().userId).get();
      if (!userDoc.exists) return null;
      const data = userDoc.data();
      return { 
        id: userDoc.id, 
        name: data?.name ?? null, 
        email: data?.email ?? '',
        emailVerified: data?.emailVerified ? new Date(data.emailVerified) : null,
        image: data?.image ?? null,
      };
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      const adminDb = await getAdminDb();
      const updateData = {
        ...user,
        lastLogin: new Date(),
      };
      await adminDb.collection('users').doc(user.id).update(updateData);
      const updatedDoc = await adminDb.collection('users').doc(user.id).get();
      const data = updatedDoc.data();
      return { 
        id: updatedDoc.id, 
        name: data?.name ?? null, 
        email: data?.email ?? '',
        emailVerified: data?.emailVerified ? new Date(data.emailVerified) : null,
        image: data?.image ?? null,
      };
    },

    async deleteUser(userId: string): Promise<void> {
      const adminDb = await getAdminDb();
      const adminAuth = await getAdminAuth();
      await adminDb.collection('users').doc(userId).delete();
      await adminAuth.deleteUser(userId);
    },

    async linkAccount(account: AdapterAccount): Promise<void> {
      const adminDb = await getAdminDb();
      await adminDb.collection('accounts').add(account);
    },

    async unlinkAccount(account: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<void> {
      const adminDb = await getAdminDb();
      const snapshot = await adminDb.collection('accounts')
        .where('provider', '==', account.provider)
        .where('providerAccountId', '==', account.providerAccountId)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.delete();
      }
    },

    async createSession(session: { sessionToken: string; userId: string; expires: Date }): Promise<AdapterSession> {
      const adminDb = await getAdminDb();
      const { id } = await adminDb.collection('sessions').add(session);
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires
      };
    },

    async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const adminDb = await getAdminDb();
      const sessionSnapshot = await adminDb.collection('sessions').where('sessionToken', '==', sessionToken).limit(1).get();
      if (sessionSnapshot.empty) return null;
      const sessionDoc = sessionSnapshot.docs[0];
      const sessionData = sessionDoc.data();
      const userDoc = await adminDb.collection('users').doc(sessionData.userId).get();
      if (!userDoc.exists) return null;
      const userData = userDoc.data();
      return {
        session: {
          sessionToken: sessionData.sessionToken,
          userId: sessionData.userId,
          expires: sessionData.expires.toDate()
        },
        user: { 
          id: userDoc.id, 
          name: userData?.name ?? null, 
          email: userData?.email ?? '',
          emailVerified: userData?.emailVerified ? new Date(userData.emailVerified) : null,
          image: userData?.image ?? null,
        },
      };
    },

    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">): Promise<AdapterSession | null | undefined> {
      const adminDb = await getAdminDb();
      const sessionSnapshot = await adminDb.collection('sessions').where('sessionToken', '==', session.sessionToken).limit(1).get();
      if (sessionSnapshot.empty) return null;
      const sessionDoc = sessionSnapshot.docs[0];
      await sessionDoc.ref.update(session);
      const updatedDoc = await sessionDoc.ref.get();
      const updatedData = updatedDoc.data();
      return {
        sessionToken: updatedData?.sessionToken,
        userId: updatedData?.userId,
        expires: updatedData?.expires.toDate()
      };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      const adminDb = await getAdminDb();
      const sessionSnapshot = await adminDb.collection('sessions').where('sessionToken', '==', sessionToken).limit(1).get();
      if (!sessionSnapshot.empty) {
        await sessionSnapshot.docs[0].ref.delete();
      }
    },

    async createVerificationToken(verificationToken: VerificationToken): Promise<VerificationToken | null | undefined> {
      const adminDb = await getAdminDb();
      const { id } = await adminDb.collection('verificationTokens').add(verificationToken);
      return { ...verificationToken };
    },

    async useVerificationToken(params: { identifier: string; token: string }): Promise<VerificationToken | null> {
      const adminDb = await getAdminDb();
      const snapshot = await adminDb.collection('verificationTokens')
        .where('identifier', '==', params.identifier)
        .where('token', '==', params.token)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const tokenDoc = snapshot.docs[0];
      const tokenData = tokenDoc.data();
      await tokenDoc.ref.delete();
      return {
        identifier: tokenData.identifier,
        token: tokenData.token,
        expires: tokenData.expires.toDate()
      };
    },
  };
}

