import { Firestore } from 'firebase-admin/firestore';
import { Auth } from 'firebase-admin/auth';
import { Database } from 'firebase-admin/database';

/**
 * Build-time Firebase Mock Layer
 * 
 * Provides mock implementations of Firebase services during Next.js static generation
 * to eliminate unnecessary Firebase connections and speed up build process.
 * 
 * This prevents the 22+ redundant Firebase initializations during SSG phase.
 */

/**
 * Detects if we're in Next.js build phase where Firebase connections aren't needed
 */
export function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build' ||
    // Additional build detection
    process.env.NODE_ENV === 'production' && process.argv.includes('build')
  );
}

/**
 * Mock Firestore implementation for build-time
 * Returns minimal interface to prevent crashes during static generation
 */
class MockFirestore {
  collection(path: string) {
    return {
      doc: (id?: string) => ({
        get: async () => ({
          exists: false,
          data: () => null,
          id: id || 'mock-doc-id'
        }),
        set: async () => ({ writeTime: new Date() }),
        update: async () => ({ writeTime: new Date() }),
        delete: async () => ({ writeTime: new Date() }),
        collection: (subPath: string) => this.collection(`${path}/${id}/${subPath}`)
      }),
      get: async () => ({
        empty: true,
        size: 0,
        docs: [],
        forEach: () => {}
      }),
      add: async () => ({
        id: 'mock-doc-id',
        get: async () => ({ exists: false, data: () => null })
      }),
      where: () => this,
      orderBy: () => this,
      limit: () => this,
      offset: () => this
    };
  }

  doc(path: string) {
    return this.collection('').doc(path);
  }

  batch() {
    return {
      set: () => this.batch(),
      update: () => this.batch(),
      delete: () => this.batch(),
      commit: async () => []
    };
  }

  runTransaction(fn: Function) {
    const transaction = {
      get: async () => ({ exists: false, data: () => null }),
      set: () => transaction,
      update: () => transaction,
      delete: () => transaction
    };
    return fn(transaction);
  }
}

/**
 * Mock Auth implementation for build-time
 */
class MockAuth {
  async getUser(uid: string) {
    return {
      uid,
      email: 'mock@example.com',
      displayName: 'Mock User',
      photoURL: null,
      disabled: false,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString()
      },
      customClaims: {}
    };
  }

  async createUser(properties: any) {
    return this.getUser(properties.uid || 'mock-uid');
  }

  async updateUser(uid: string, properties: any) {
    return this.getUser(uid);
  }

  async deleteUser(uid: string) {
    return;
  }

  async listUsers() {
    return {
      users: [],
      pageToken: undefined
    };
  }

  async setCustomUserClaims(uid: string, claims: any) {
    return;
  }

  async verifyIdToken(token: string) {
    return {
      uid: 'mock-uid',
      email: 'mock@example.com',
      aud: 'mock-audience',
      iss: 'mock-issuer',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
  }
}

/**
 * Mock Realtime Database implementation for build-time
 */
class MockDatabase {
  ref(path?: string) {
    return {
      push: async (data: any) => ({
        key: 'mock-key',
        ref: this.ref(path)
      }),
      set: async (data: any) => {},
      update: async (data: any) => {},
      remove: async () => {},
      once: async (eventType: string) => ({
        exists: () => false,
        val: () => null,
        key: 'mock-key',
        numChildren: () => 0,
        forEach: () => false
      }),
      on: () => () => {}, // Returns unsubscribe function
      off: () => {},
      child: (childPath: string) => this.ref(`${path || ''}/${childPath}`),
      parent: path ? this.ref(path.substring(0, path.lastIndexOf('/'))) : null,
      root: this.ref(),
      orderByChild: () => this.ref(path),
      orderByKey: () => this.ref(path),
      orderByValue: () => this.ref(path),
      limitToFirst: () => this.ref(path),
      limitToLast: () => this.ref(path),
      startAt: () => this.ref(path),
      endAt: () => this.ref(path),
      equalTo: () => this.ref(path),
      onDisconnect: () => ({
        set: async () => {},
        update: async () => {},
        remove: async () => {},
        cancel: async () => {}
      })
    };
  }

  goOffline() {}
  goOnline() {}
}

/**
 * Returns mock Firebase services during build time, real services during runtime
 */
export function getMockFirebaseServices() {
  if (!isBuildTime()) {
    throw new Error('Mock Firebase services should only be used during build time');
  }

  return {
    mockDb: new MockFirestore() as unknown as Firestore,
    mockAuth: new MockAuth() as unknown as Auth,
    mockRtdb: new MockDatabase() as unknown as Database
  };
}

/**
 * Build-time logging utility
 */
export function logBuildOptimization(message: string, data?: any) {
  if (process.env.FIREBASE_DEBUG_LOGS === 'true' || process.env.NODE_ENV === 'development') {
    console.log(`[Firebase Build Optimization] ${message}`, data || '');
  }
}
