import { cache } from 'react';
import { getAdminDb, getAdminAuth } from '../firebase-admin.server';
import type {
  DocumentSnapshot,
  QuerySnapshot,
  DocumentReference,
  CollectionReference,
  Query,
  WriteResult,
  WriteBatch,
  Transaction,
  BulkWriter,
  FieldValue
} from 'firebase-admin/firestore';
import type { StoreProduct } from '@/features/store/types';
import type { CheckoutInfo } from '@/features/store/types';
import type { CartItem } from '@/features/store/types';
import type { OrderItem } from '@/features/store/types';
import type { OrderTotalsByCurrency } from '@/features/store/types';
import type { Order } from '@/features/store/types';

// Store adapter types - defined locally to avoid circular imports

/**
 * Centralized Firebase Service Manager
 *
 * Firestore-native helper layer for **ring-db mode = `firebase-full`**.
 * In firebase-full mode, `BackendSelector` (`lib/database/BackendSelector.ts`)
 * routes ALL collections to `FirebaseAdapter`, so the abstractions in
 * `lib/payments/*`, `features/wallet/*`, and `features/membership/*` resolve to
 * Firestore paths. This module complements that abstraction with
 * **React 19 cache()-friendly, request-deduplicated, typed read helpers**
 * for read-heavy surfaces (server components, route handlers, tunnel
 * listeners, cron jobs).
 *
 * Responsibilities:
 * 1. **Core cached CRUD** — getCachedDocument / getCachedCollection /
 *    getCachedDocumentBatch / getCachedUser / getCachedUsers with React 19
 *    cache() for SSG/SSR deduplication.
 * 2. **Advanced query caching** — collection-level, subcollection-level,
 *    and collection-group queries with pagination and orderBy.
 * 3. **Batch & transaction primitives** — createBatchWriter / runTransaction /
 *    createBulkWriter with consistent error handling.
 * 4. **Real-time listeners** — Firestore onSnapshot helpers for live UI
 *    updates via the tunnel.
 * 5. **SSOT domain helpers** — typed cached reads for the canonical
 *    collections used by the wallet / subscription / payment code:
 *      - `users/{userId}.credit_balance` + `users/{userId}.credit_transactions[]`
 *      - `subscription_ledger`     (single source of truth for all subs)
 *      - `payment_transactions`    (PaymentConductor output)
 *      - `wallet_transactions`     (chain-level debits/credits)
 *      - `desk_orders`             (credit ↔ native-token conversion)
 *      - `orders`                  (membership + store orders)
 * 6. **Atomic write helpers** — Firestore transaction wrappers that read,
 *    mutate, and write in a single ACID step (credit balance, subscription
 *    status transitions, payment status appends).
 * 7. **StoreAdapter / BackendAdapter** — generic CRUD plumbing used by
 *    store checkout and admin tooling.
 * 8. **Performance metrics** — cache hit/miss counters for build / runtime
 *    observability.
 *
 * Notes:
 * - All helpers are server-side only. Importing from a client bundle will
 *   pull in `firebase-admin` and fail the build.
 * - "SSOT" = single source of truth. The collection paths and field shapes
 *   here MUST match `lib/zod/credit-schemas.ts`,
 *   `lib/payments/subscription/subscription-ledger-schema.ts`,
 *   `lib/payments/payment-transaction-service.ts`, and the read paths
 *   implemented in `credit-balance-service.ts`, `subscription-service.ts`,
 *   `subscription-conductor.ts`, and `payment-conductor.ts`.
 * - Ring credit balance is **always fiat USD** on ring-platform.org; the
 *   blockchain token is the native chain token (RING on Solana/EVM).
 *   Do not add credit helpers that denominate in native tokens.
 */

/**
 * Request signature generator for cache key creation
 */
function createRequestSignature(operation: string, collection: string, params: any = {}): string {
  const paramsStr = JSON.stringify(params, Object.keys(params).sort());
  return `${operation}:${collection}:${Buffer.from(paramsStr).toString('base64')}`;
}

/**
 * Performance metrics tracking
 */
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  totalRequests: 0,

  recordCacheHit() {
    this.cacheHits++;
    this.totalRequests++;
  },

  recordCacheMiss() {
    this.cacheMisses++;
    this.totalRequests++;
  },

  getHitRate(): number {
    return this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
  },

  reset() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalRequests = 0;
  }
};

/**
 * CACHED DOCUMENT OPERATIONS
 * Using React 19 cache() for automatic request deduplication
 */

/**
 * Get single document with caching
 * Eliminates duplicate requests for the same document during SSG
 */
export const getCachedDocument = cache(async (collection: string, docId: string): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getDoc', collection, { docId });

  try {
    const db = getAdminDb();
    const docRef = db.collection(collection).doc(docId);
    const doc = await docRef.get();

    metrics.recordCacheMiss(); // First time fetch

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Document: ${collection}/${docId}`);
    }

    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching document ${collection}/${docId}:`, error);
    throw error;
  }
});

/**
 * Get collection with query caching
 * Prevents duplicate collection queries during build process
 */
export const getCachedCollection = cache(async (
  collection: string,
  options: {
    limit?: number;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    where?: { field: string; operator: string; value: any };
  } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getCollection', collection, options);

  try {
    const db = getAdminDb();
    let query: any = db.collection(collection);

    // Apply query constraints
    if (options.where) {
      query = query.where(options.where.field, options.where.operator, options.where.value);
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss(); // First time fetch

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Collection: ${collection}, Results: ${snapshot.size}`);
    }

    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching collection ${collection}:`, error);
    throw error;
  }
});

/**
 * Batch get multiple documents with deduplication
 * Optimizes multiple document requests by batching and caching
 */
export const getCachedDocumentBatch = cache(async (
  requests: Array<{ collection: string; docId: string }>
): Promise<DocumentSnapshot[]> => {
  const signature = createRequestSignature('getBatch', 'multi', requests);

  try {
    const db = getAdminDb();

    // Create document references
    const docRefs = requests.map(({ collection, docId }) =>
      db.collection(collection).doc(docId)
    );

    // Batch get all documents
    const docs = await db.getAll(...docRefs);

    metrics.recordCacheMiss(); // First time batch fetch

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Batch: ${requests.length} documents`);
    }

    return docs;
  } catch (error) {
    console.error('[Firebase Manager] Error in batch get:', error);
    throw error;
  }
});

/**
 * CACHED USER OPERATIONS
 * Optimized user-related Firebase operations with caching
 */

/**
 * Get user by ID with caching
 */
export const getCachedUser = cache(async (uid: string) => {
  const signature = createRequestSignature('getUser', 'auth', { uid });

  try {
    const auth = getAdminAuth();
    const user = await auth.getUser(uid);

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - User: ${uid}`);
    }

    return user;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching user ${uid}:`, error);
    throw error;
  }
});

/**
 * List users with caching
 */
export const getCachedUsers = cache(async (maxResults: number = 1000) => {
  const signature = createRequestSignature('listUsers', 'auth', { maxResults });

  try {
    const auth = getAdminAuth();
    const result = await auth.listUsers(maxResults);

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Users list: ${result.users.length} users`);
    }

    return result;
  } catch (error) {
    console.error('[Firebase Manager] Error listing users:', error);
    throw error;
  }
});

/**
 * ADVANCED COLLECTION OPERATIONS WITH CACHING
 * Enhanced operations for complex querying, real-time listeners, and batch operations
 */

/**
 * Advanced collection query builder with caching
 */
export const getCachedCollectionAdvanced = cache(async (
  collection: string,
  queryConfig: {
    where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>;
    orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    limit?: number;
    startAfter?: any;
    endBefore?: any;
  } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getCollectionAdvanced', collection, queryConfig);

  try {
    const db = getAdminDb();
    let query: Query = db.collection(collection);

    // Apply where clauses
    if (queryConfig.where) {
      queryConfig.where.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
    }

    // Apply ordering
    if (queryConfig.orderBy) {
      queryConfig.orderBy.forEach(({ field, direction = 'asc' }) => {
        query = query.orderBy(field, direction);
      });
    }

    // Apply pagination
    if (queryConfig.startAfter) {
      query = query.startAfter(queryConfig.startAfter);
    }
    if (queryConfig.endBefore) {
      query = query.endBefore(queryConfig.endBefore);
    }

    // Apply limit
    if (queryConfig.limit) {
      query = query.limit(queryConfig.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Advanced Query: ${collection}, Results: ${snapshot.size}`);
    }

    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error in advanced collection query ${collection}:`, error);
    throw error;
  }
});

/**
 * Get subcollection documents with caching
 * Useful for nested collections like users/{userId}/addresses
 */
export const getCachedSubcollection = cache(async (
  parentCollection: string,
  parentDocId: string,
  subcollection: string,
  options: {
    limit?: number;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    where?: { field: string; operator: FirebaseFirestore.WhereFilterOp; value: any };
    startAfter?: DocumentSnapshot;
  } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getSubcollection', `${parentCollection}/${parentDocId}/${subcollection}`, options);

  try {
    const db = getAdminDb();
    let query: Query = db.collection(parentCollection).doc(parentDocId).collection(subcollection);

    // Apply query constraints
    if (options.where) {
      query = query.where(options.where.field, options.where.operator, options.where.value);
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Subcollection: ${parentCollection}/${parentDocId}/${subcollection}, Results: ${snapshot.size}`);
    }

    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching subcollection ${parentCollection}/${parentDocId}/${subcollection}:`, error);
    throw error;
  }
});

/**
 * Get collection group query with caching
 * Useful for querying across all subcollections of the same type
 */
export const getCachedCollectionGroup = cache(async (
  collectionId: string,
  options: {
    where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>;
    orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    limit?: number;
  } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getCollectionGroup', collectionId, options);

  try {
    const db = getAdminDb();
    let query: Query = db.collectionGroup(collectionId);

    // Apply where clauses
    if (options.where) {
      options.where.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
    }

    if (options.orderBy) {
      options.orderBy.forEach(({ field, direction }) => {
        query = query.orderBy(field, direction || 'asc');
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - Collection Group: ${collectionId}, Results: ${snapshot.size}`);
    }

    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error in collection group query ${collectionId}:`, error);
    throw error;
  }
});

/**
 * BATCH AND TRANSACTION OPERATIONS
 */

/**
 * Create a batch writer for multiple operations
 */
export function createBatchWriter(): WriteBatch {
  const db = getAdminDb();
  return db.batch();
}

/**
 * Execute batch write operations
 */
export async function executeBatch(batch: WriteBatch): Promise<WriteResult[]> {
  try {
    const results = await batch.commit();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Batch executed: ${results.length} operations`);
    }

    return results;
  } catch (error) {
    console.error('[Firebase Manager] Batch execution failed:', error);
    throw error;
  }
}

/**
 * Run a Firestore transaction with optimized error handling
 */
export async function runTransaction<T>(
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
  try {
    const db = getAdminDb();
    const result = await db.runTransaction(updateFunction);

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log('[Firebase Manager] Transaction completed successfully');
    }

    return result;
  } catch (error) {
    console.error('[Firebase Manager] Transaction failed:', error);
    throw error;
  }
}

/**
 * Create a bulk writer for high-volume operations
 */
export function createBulkWriter(): BulkWriter {
  const db = getAdminDb();
  return db.bulkWriter();
}

/**
 * REAL-TIME LISTENERS
 * Note: These don't use cache() as they're for real-time updates
 */

/**
 * Create a real-time listener for a document
 */
export function createDocumentListener(
  collection: string,
  docId: string,
  callback: (snapshot: DocumentSnapshot) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const docRef = db.collection(collection).doc(docId);

    const unsubscribe = docRef.onSnapshot(callback, errorCallback);

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Document listener created: ${collection}/${docId}`);
    }

    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error creating document listener ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Create a real-time listener for a collection query
 */
export function createCollectionListener(
  collection: string,
  queryConfig: {
    where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>;
    orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    limit?: number;
  },
  callback: (snapshot: QuerySnapshot) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    let query: Query = db.collection(collection);

    // Apply query constraints
    if (queryConfig.where) {
      queryConfig.where.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
    }

    if (queryConfig.orderBy) {
      queryConfig.orderBy.forEach(({ field, direction }) => {
        query = query.orderBy(field, direction || 'asc');
      });
    }

    if (queryConfig.limit) {
      query = query.limit(queryConfig.limit);
    }

    const unsubscribe = query.onSnapshot(callback, errorCallback);

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Collection listener created: ${collection}`);
    }

    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error creating collection listener ${collection}:`, error);
    throw error;
  }
}

/**
 * WRITE OPERATIONS (NO CACHING)
 * Write operations bypass cache and invalidate related cached data
 */

/**
 * Create document with cache invalidation
 */
export async function createDocument(collection: string, data: any, docId?: string): Promise<DocumentReference> {
  try {
    const db = getAdminDb();
    const collectionRef = db.collection(collection);

    let docRef: DocumentReference;

    if (docId) {
      docRef = collectionRef.doc(docId);
      await docRef.set(data);
    } else {
      docRef = await collectionRef.add(data);
    }

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Created document: ${collection}/${docRef.id}`);
    }

    return docRef;
  } catch (error) {
    console.error(`[Firebase Manager] Error creating document in ${collection}:`, error);
    throw error;
  }
}

/**
 * Update document with cache invalidation
 */
export async function updateDocument(collection: string, docId: string, data: any): Promise<void> {
  try {
    const db = getAdminDb();
    const docRef = db.collection(collection).doc(docId);
    await docRef.update(data);

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Updated document: ${collection}/${docId}`);
    }
  } catch (error) {
    console.error(`[Firebase Manager] Error updating document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Delete document with cache invalidation
 */
export async function deleteDocument(collection: string, docId: string): Promise<void> {
  try {
    const db = getAdminDb();
    const docRef = db.collection(collection).doc(docId);
    await docRef.delete();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Deleted document: ${collection}/${docId}`);
    }
  } catch (error) {
    console.error(`[Firebase Manager] Error deleting document ${collection}/${docId}:`, error);
    throw error;
  }
}

// ============================================================================
// CREDIT BALANCE DOMAIN (SSOT: users/{userId}.credit_balance + credit_transactions[])
// ----------------------------------------------------------------------------
// Ring credit balance is **always fiat USD** on ring-platform.org. The
// blockchain token (RING) is the native chain token. These helpers are the
// React 19 cache-friendly read side of the credit system; the write side is
// implemented in `features/wallet/services/credit-balance-service.ts` and
// orchestrated through `lib/wallet/reward-credit-service.ts` for airdrops.
// Field shape matches `lib/zod/credit-schemas.ts`.
// ============================================================================

/**
 * Cached credit balance (fiat USD) for a single user.
 * SSOT: `users/{userId}.credit_balance` — the canonical UserCreditBalance
 * document embedded on the user profile.
 */
export const getCachedUserCreditBalance = cache(async (userId: string): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getUserCreditBalance', 'users', { userId });
  try {
    const db = getAdminDb();
    const doc = await db.collection('users').doc(userId).get();
    metrics.recordCacheMiss();
    if (!doc.exists) return null;
    const data = doc.data() as any;
    if (!data || !data.credit_balance) return null;
    // Wrap as a fake DocumentSnapshot-like object so callers that want the
    // typed payload can use getCachedUserCreditBalanceTyped().
    return doc;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching credit balance for user ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached credit transaction history for a user. SSOT is the embedded array
 * `users/{userId}.credit_transactions[]`. Pagination is performed in-memory
 * over the array (legacy pattern preserved by `credit-balance-service.ts`).
 *
 * @param userId   Authenticated user ID
 * @param options  Optional filtering: type (e.g. 'membership_fee'), start/end (ms), limit
 */
export const getCachedCreditTransactions = cache(async (
  userId: string,
  options: {
    limit?: number;
    type?: string;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<Array<Record<string, any>>> => {
  const signature = createRequestSignature('getCreditTransactions', `users/${userId}/credit_transactions`, options);
  try {
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();
    metrics.recordCacheMiss();
    if (!userDoc.exists) return [];
    const userData = userDoc.data() as any;
    const all: Array<Record<string, any>> = Array.isArray(userData?.credit_transactions)
      ? userData.credit_transactions
      : [];

    let filtered = all;
    if (options.type) {
      filtered = filtered.filter((t) => t?.type === options.type);
    }
    if (options.startDate) {
      const start = options.startDate;
      filtered = filtered.filter((t) => Number(t?.timestamp ?? 0) >= start);
    }
    if (options.endDate) {
      const end = options.endDate;
      filtered = filtered.filter((t) => Number(t?.timestamp ?? 0) <= end);
    }
    // Newest first
    filtered.sort((a, b) => Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0));
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching credit transactions for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached typed variant of the credit balance — returns the typed
 * `UserCreditBalance` payload (see `lib/zod/credit-schemas.ts`).
 */
export async function getCachedUserCreditBalanceTyped<T = Record<string, any>>(
  userId: string
): Promise<T | null> {
  const doc = await getCachedUserCreditBalance(userId);
  if (!doc || !doc.exists) return null;
  const data = doc.data() as any;
  return (data?.credit_balance as T) ?? null;
}

/**
 * Atomic credit balance adjust — Firestore transaction that reads the user
 * document, computes the new balance, and writes back the user document with
 * the new `credit_balance` + appended `credit_transactions[]` entry.
 *
 * This is the SSOT-aligned low-level primitive; higher-level services
 * (`creditBalanceService.addCredits` / `spendCredits`) wrap it with the
 * `CreditTransaction` schema and the Tunnel publish.
 *
 * @param userId        Target user ID
 * @param delta         Signed numeric delta (positive = add, negative = spend)
 * @param transaction   Credit transaction record to append
 * @param usdRate       Fiat USD rate at the time of the operation
 * @returns             `{ success, newBalance, transactionId }` or throws
 */
export async function creditBalanceAdjustAtomic(
  userId: string,
  delta: number,
  transaction: Record<string, any>,
  usdRate: string = '1'
): Promise<{ success: true; newBalance: string; transactionId: string }> {
  if (!userId) throw new Error('creditBalanceAdjustAtomic: userId is required');
  if (!Number.isFinite(delta)) throw new Error('creditBalanceAdjustAtomic: delta must be finite');
  if (!transaction || !transaction.id) {
    throw new Error('creditBalanceAdjustAtomic: transaction.id is required');
  }

  const db = getAdminDb();
  const userRef = db.collection('users').doc(userId);
  const tsNow = Date.now();
  const newTransactionId = String(transaction.id);

  const result = await db.runTransaction(async (txn) => {
    const snap = await txn.get(userRef);
    if (!snap.exists) {
      throw new Error(`creditBalanceAdjustAtomic: user ${userId} not found`);
    }
    const data = snap.data() as any;
    const currentBalance = (data?.credit_balance?.amount as string) ?? '0';
    const currentUsdEquiv = (data?.credit_balance?.usd_equivalent as string) ?? '0';
    const currentFiatCurrency =
      (data?.credit_balance?.fiat_currency as string) ?? process.env.PAYMENT_FIAT_CURRENCY ?? 'USD';

    const currentAmount = parseFloat(currentBalance);
    const newAmount = (currentAmount + delta).toString();
    if (parseFloat(newAmount) < 0) {
      throw new Error(
        `creditBalanceAdjustAtomic: insufficient balance (have ${currentBalance}, need ${Math.abs(delta)})`
      );
    }

    const usdDelta = (Math.abs(delta) * parseFloat(usdRate)).toString();
    const signedUsdDelta = delta < 0 ? `-${usdDelta}` : usdDelta;
    const newUsdEquiv = (
      parseFloat(currentUsdEquiv) + (delta < 0 ? -parseFloat(usdDelta) : parseFloat(usdDelta))
    ).toString();

    const updatedCreditBalance = {
      amount: newAmount,
      usd_equivalent: newUsdEquiv,
      fiat_currency: currentFiatCurrency,
      last_updated: tsNow,
      last_transaction_id: newTransactionId,
      subscription_active: data?.credit_balance?.subscription_active ?? false,
      subscription_contract_address: data?.credit_balance?.subscription_contract_address,
      subscription_next_payment: data?.credit_balance?.subscription_next_payment,
    };

    const newTransactionRecord = {
      ...transaction,
      id: newTransactionId,
      user_id: userId,
      amount: String(delta),
      usd_rate: usdRate,
      usd_equivalent: signedUsdDelta,
      balance_after: newAmount,
      timestamp: transaction.timestamp ?? tsNow,
    };

    const existingTransactions = Array.isArray(data?.credit_transactions)
      ? data.credit_transactions
      : [];
    const updatedTransactions = [...existingTransactions, newTransactionRecord];

    txn.update(userRef, {
      credit_balance: updatedCreditBalance,
      credit_transactions: updatedTransactions,
      updated_at: new Date(),
    });

    return { newAmount, transactionId: newTransactionId };
  });

  if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
    console.log(
      `[Firebase Manager] creditBalanceAdjustAtomic user=${userId} delta=${delta} newBalance=${result.newAmount}`
    );
  }

  return { success: true, newBalance: result.newAmount, transactionId: result.transactionId };
}

/**
 * Real-time listener for the credit balance embedded on the user document.
 * Pairs with the Tunnel publisher in `creditBalanceService` to push live
 * `credit:balance` events to the client (see
 * `lib/tunnel/publisher.ts`).
 */
export function createCreditBalanceListener(
  userId: string,
  callback: (balance: Record<string, any> | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db.collection('users').doc(userId).onSnapshot(
      (snap) => {
        if (!snap.exists) {
          callback(null);
          return;
        }
        const data = snap.data() as any;
        callback((data?.credit_balance as Record<string, any>) ?? null);
      },
      errorCallback
    );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Credit balance listener attached for user ${userId}`);
    }
    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error attaching credit balance listener for ${userId}:`, error);
    throw error;
  }
}

// ============================================================================
// SUBSCRIPTION DOMAIN (SSOT: subscription_ledger collection)
// ----------------------------------------------------------------------------
// The canonical subscription source of truth is the `subscription_ledger`
// collection. Row shape is defined by
// `lib/payments/subscription/subscription-ledger-schema.ts` and the
// `SubscriptionConductor` (lib/payments/subscription/subscription-conductor.ts)
// is the only writer. Status transitions are atomic and propagate
// `upgradeUserRole` / `downgradeUserRole` side-effects.
// ============================================================================

/**
 * Cached latest subscription row for a user (any status). The
 * `SubscriptionConductor.getSubscription` helper uses the same pattern.
 */
export const getCachedLatestSubscription = cache(async (
  userId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getLatestSubscription', 'subscription_ledger', { userId });
  try {
    const db = getAdminDb();
    const query = await db
      .collection('subscription_ledger')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    metrics.recordCacheMiss();
    if (query.empty) return null;
    return query.docs[0];
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching latest subscription for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached active subscription row for a user, if any. The
 * `SubscriptionConductor` SSOT pattern uses status='active' (lowercase); the
 * older `SubscriptionStatus` Zod schema uses 'ACTIVE' (uppercase). This helper
 * covers both for forward compatibility.
 */
export const getCachedActiveSubscription = cache(async (
  userId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getActiveSubscription', 'subscription_ledger', { userId });
  try {
    const db = getAdminDb();
    // Try lowercase first (SubscriptionConductor convention)
    let query = await db
      .collection('subscription_ledger')
      .where('user_id', '==', userId)
      .where('status', '==', 'active')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    if (!query.empty) {
      metrics.recordCacheMiss();
      return query.docs[0];
    }
    // Fallback: uppercase status (legacy subscription-service.ts)
    query = await db
      .collection('subscription_ledger')
      .where('user_id', '==', userId)
      .where('status', '==', 'ACTIVE')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    metrics.recordCacheMiss();
    if (query.empty) return null;
    return query.docs[0];
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching active subscription for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached batch query — find all active subscriptions whose
 * `next_payment_due` is at or before the supplied timestamp. Designed for
 * the monthly-renewal cron job (see `lib/payments/subscription/subscription-conductor.ts`).
 */
export const getCachedSubscriptionsDue = cache(async (
  options: { dueBy?: number; limit?: number } = {}
): Promise<QuerySnapshot> => {
  const dueBy = options.dueBy ?? Date.now();
  const limit = options.limit ?? 200;
  const signature = createRequestSignature('getSubscriptionsDue', 'subscription_ledger', { dueBy, limit });
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection('subscription_ledger')
      .where('status', '==', 'active')
      .where('next_payment_due', '<=', dueBy)
      .orderBy('next_payment_due', 'asc')
      .limit(limit)
      .get();
    metrics.recordCacheMiss();
    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching due subscriptions:', error);
    throw error;
  }
});

/**
 * Cached single subscription by ID.
 */
export const getCachedSubscription = cache(async (
  subscriptionId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getSubscription', 'subscription_ledger', { subscriptionId });
  try {
    const db = getAdminDb();
    const doc = await db.collection('subscription_ledger').doc(subscriptionId).get();
    metrics.recordCacheMiss();
    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching subscription ${subscriptionId}:`, error);
    throw error;
  }
});

/**
 * Cached paginated list of a user's subscriptions, newest first.
 */
export const getCachedUserSubscriptions = cache(async (
  userId: string,
  options: { limit?: number; provider?: string; status?: string } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getUserSubscriptions', 'subscription_ledger', { userId, ...options });
  try {
    const db = getAdminDb();
    const filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [
      { field: 'user_id', operator: '==', value: userId },
    ];
    if (options.provider) {
      filters.push({ field: 'provider', operator: '==', value: options.provider });
    }
    if (options.status) {
      filters.push({ field: 'status', operator: '==', value: options.status });
    }
    const snapshot = await getCachedCollectionAdvanced('subscription_ledger', {
      where: filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: options.limit ?? 20,
    });
    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error listing subscriptions for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached typed variant — returns the latest subscription row as a typed
 * `SubscriptionLedgerRow` payload (see
 * `lib/payments/subscription/subscription-ledger-schema.ts`).
 */
export async function getCachedLatestSubscriptionTyped<T = Record<string, any>>(
  userId: string
): Promise<(T & { id: string }) | null> {
  const doc = await getCachedLatestSubscription(userId);
  if (!doc) return null;
  return { id: doc.id, ...(doc.data() as T) };
}

/**
 * Cached typed variant — returns the active subscription row as a typed
 * `SubscriptionLedgerRow` payload.
 */
export async function getCachedActiveSubscriptionTyped<T = Record<string, any>>(
  userId: string
): Promise<(T & { id: string }) | null> {
  const doc = await getCachedActiveSubscription(userId);
  if (!doc) return null;
  return { id: doc.id, ...(doc.data() as T) };
}

/**
 * Cached admin stats — aggregate counts by status / provider / method.
 * Single-collection read with limit 1000; for larger datasets, prefer a
 * counter-based background rollup.
 */
export const getCachedSubscriptionStats = cache(async (): Promise<{
  total_active: number;
  total_grace_period: number;
  total_expired: number;
  total_cancelled: number;
  total_suspended: number;
  due_for_payment: number;
  by_provider: Record<string, number>;
  by_method: Record<string, number>;
}> => {
  const signature = createRequestSignature('getSubscriptionStats', 'subscription_ledger', {});
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('subscription_ledger').limit(1000).get();
    metrics.recordCacheMiss();
    const now = Date.now();
    const stats = {
      total_active: 0,
      total_grace_period: 0,
      total_expired: 0,
      total_cancelled: 0,
      total_suspended: 0,
      due_for_payment: 0,
      by_provider: {
        stripe: 0,
        wayforpay: 0,
        credit_balance: 0,
        native_token: 0,
        nft_gate: 0,
        paypal: 0,
      } as Record<string, number>,
      by_method: {} as Record<string, number>,
    };
    snapshot.forEach((doc) => {
      const row = doc.data() as any;
      const status = (row?.status as string) ?? '';
      switch (status) {
        case 'active':
        case 'ACTIVE':
          stats.total_active++;
          break;
        case 'grace_period':
          stats.total_grace_period++;
          break;
        case 'expired':
        case 'EXPIRED':
          stats.total_expired++;
          break;
        case 'cancelled':
        case 'CANCELLED':
          stats.total_cancelled++;
          break;
        case 'suspended':
          stats.total_suspended++;
          break;
      }
      if ((status === 'active' || status === 'ACTIVE') && Number(row?.next_payment_due ?? 0) <= now) {
        stats.due_for_payment++;
      }
      if (row?.provider && row.provider in stats.by_provider) {
        stats.by_provider[row.provider]++;
      }
      const method = row?.method as string | undefined;
      if (method) {
        stats.by_method[method] = (stats.by_method[method] ?? 0) + 1;
      }
    });
    return stats;
  } catch (error) {
    console.error('[Firebase Manager] Error computing subscription stats:', error);
    throw error;
  }
});

/**
 * Atomic subscription status transition — Firestore transaction that updates
 * the ledger row and mirrors the canonical fields onto the user document
 * (subscription_active, next_payment, membership.tier). Mirrors the
 * `SubscriptionConductor` side-effects.
 *
 * @param subscriptionId   subscription_ledger doc id
 * @param nextStatus       New status: 'active' | 'cancelled' | 'expired' | 'suspended' | 'grace_period'
 * @param userPatch        Partial user-document fields to update
 *                         (e.g. { membership: { tier: 'MEMBER' } })
 * @param ledgerPatch      Extra fields to set on the subscription_ledger row
 *                         (e.g. { cancelled_at: now, auto_renew: false })
 */
export async function subscriptionStatusUpdateAtomic(
  subscriptionId: string,
  nextStatus: 'active' | 'cancelled' | 'expired' | 'suspended' | 'grace_period' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED',
  userPatch: Record<string, any> = {},
  ledgerPatch: Record<string, any> = {}
): Promise<{ success: true; subscription: Record<string, any> }> {
  if (!subscriptionId) throw new Error('subscriptionStatusUpdateAtomic: subscriptionId is required');
  if (!nextStatus) throw new Error('subscriptionStatusUpdateAtomic: nextStatus is required');

  const db = getAdminDb();
  const ledgerRef = db.collection('subscription_ledger').doc(subscriptionId);
  const tsNow = Date.now();

  const result = await db.runTransaction(async (txn) => {
    const ledgerSnap = await txn.get(ledgerRef);
    if (!ledgerSnap.exists) {
      throw new Error(`subscriptionStatusUpdateAtomic: subscription ${subscriptionId} not found`);
    }
    const ledgerData = ledgerSnap.data() as any;
    const userId = ledgerData?.user_id as string;
    if (!userId) {
      throw new Error(`subscriptionStatusUpdateAtomic: subscription ${subscriptionId} has no user_id`);
    }
    const userRef = db.collection('users').doc(userId);

    const updatedLedger = {
      ...ledgerData,
      status: nextStatus,
      updated_at: tsNow,
      ...ledgerPatch,
    };
    txn.update(ledgerRef, updatedLedger);

    if (Object.keys(userPatch).length > 0) {
      txn.update(userRef, { ...userPatch, updated_at: new Date() });
    }

    return { subscription: { id: subscriptionId, ...updatedLedger, user_id: userId } };
  });

  if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
    console.log(
      `[Firebase Manager] subscriptionStatusUpdateAtomic ${subscriptionId} → ${nextStatus}`
    );
  }

  return { success: true, subscription: result.subscription };
}

/**
 * Real-time listener for a user's subscription ledger rows. Use to drive
 * the UI when the SubscriptionConductor renews / cancels a subscription.
 */
export function createSubscriptionListener(
  userId: string,
  callback: (rows: Array<{ id: string; data: Record<string, any> }>) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db
      .collection('subscription_ledger')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(10)
      .onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
          callback(rows);
        },
        errorCallback
      );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Subscription listener attached for user ${userId}`);
    }
    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error attaching subscription listener for ${userId}:`, error);
    throw error;
  }
}

// ============================================================================
// PAYMENT CONDUCTOR BRIDGE (SSOT: payment_transactions collection)
// ----------------------------------------------------------------------------
// `lib/payments/conductor/payment-conductor.ts` orchestrates checkouts across
// `internal-credit`, `wayforpay`, and `stripe`. The persistent record lives
// in the `payment_transactions` collection (see
// `lib/payments/payment-transaction-service.ts`). These helpers give the
// Firestore-native cache path for status polling and reconciliation.
// ============================================================================

/**
 * Cached payment transaction lookup by `order_reference` (the canonical
 * cross-processor key — WayForPay `orderReference`, Stripe `client_reference_id`).
 */
export const getCachedPaymentTransaction = cache(async (
  orderReference: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getPaymentTransaction', 'payment_transactions', { orderReference });
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection('payment_transactions')
      .where('order_reference', '==', orderReference)
      .limit(1)
      .get();
    metrics.recordCacheMiss();
    if (snapshot.empty) return null;
    return snapshot.docs[0];
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching payment transaction ${orderReference}:`, error);
    throw error;
  }
});

/**
 * Cached payment transaction lookup by document id.
 */
export const getCachedPaymentTransactionById = cache(async (
  id: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getPaymentTransactionById', 'payment_transactions', { id });
  try {
    const db = getAdminDb();
    const doc = await db.collection('payment_transactions').doc(id).get();
    metrics.recordCacheMiss();
    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching payment transaction by id ${id}:`, error);
    throw error;
  }
});

/**
 * Cached paginated payment transactions for a user, newest first.
 */
export const getCachedUserPaymentTransactions = cache(async (
  userId: string,
  options: { limit?: number; status?: string; purpose?: string } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getUserPaymentTransactions', 'payment_transactions', { userId, ...options });
  try {
    const db = getAdminDb();
    const filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [
      { field: 'user_id', operator: '==', value: userId },
    ];
    if (options.status) filters.push({ field: 'status', operator: '==', value: options.status });
    if (options.purpose) filters.push({ field: 'purpose', operator: '==', value: options.purpose });
    const snapshot = await getCachedCollectionAdvanced('payment_transactions', {
      where: filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: options.limit ?? 25,
    });
    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error listing payment transactions for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached batch — pending payment transactions (status='created') eligible
 * for the reconciliation cron job. Cap at 200 to stay within batch limits.
 */
export const getCachedPendingPaymentTransactions = cache(async (
  options: { limit?: number; olderThanMs?: number } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getPendingPaymentTransactions', 'payment_transactions', options);
  try {
    const db = getAdminDb();
    const olderThan = options.olderThanMs ?? 5 * 60 * 1000; // default 5 min
    const cutoff = new Date(Date.now() - olderThan).toISOString();
    const snapshot = await db
      .collection('payment_transactions')
      .where('status', '==', 'created')
      .where('created_at', '<=', cutoff)
      .orderBy('created_at', 'asc')
      .limit(options.limit ?? 200)
      .get();
    metrics.recordCacheMiss();
    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching pending payment transactions:', error);
    throw error;
  }
});

/**
 * Cached typed variant — returns a `PaymentTransactionRecord` (see
 * `lib/payments/payment-transaction-service.ts`).
 */
export async function getCachedPaymentTransactionTyped<T = Record<string, any>>(
  orderReference: string
): Promise<(T & { id: string }) | null> {
  const doc = await getCachedPaymentTransaction(orderReference);
  if (!doc) return null;
  return { id: doc.id, ...(doc.data() as T) };
}

/**
 * Atomic payment-transaction status append. Mirrors
 * `paymentTransactionService.appendStatus` but as a Firestore transaction
 * so that the status_history array write cannot race with another update.
 *
 * @param orderReference  The canonical order reference
 * @param status          New status: 'created' | 'redirected' | 'paid' | 'failed' | 'refunded'
 * @param meta            Optional metadata merged into the history entry
 *                        (e.g. { processor_payload: { ... } })
 */
export async function paymentTransactionAppendStatusAtomic(
  orderReference: string,
  status: 'created' | 'redirected' | 'paid' | 'failed' | 'refunded',
  meta: Record<string, any> = {}
): Promise<{ success: true; record: Record<string, any> }> {
  if (!orderReference) throw new Error('paymentTransactionAppendStatusAtomic: orderReference is required');
  if (!status) throw new Error('paymentTransactionAppendStatusAtomic: status is required');

  const db = getAdminDb();
  const tsNow = new Date().toISOString();

  const result = await db.runTransaction(async (txn) => {
    const existing = await db
      .collection('payment_transactions')
      .where('order_reference', '==', orderReference)
      .limit(1)
      .get();
    if (existing.empty) {
      throw new Error(
        `paymentTransactionAppendStatusAtomic: no payment_transactions row for order_reference ${orderReference}`
      );
    }
    const ref = existing.docs[0].ref;
    const data = existing.docs[0].data() as any;
    const history = Array.isArray(data?.status_history) ? data.status_history : [];
    const newHistory = [...history, { status, at: tsNow, ...(meta ?? {}) }];
    const patch: Record<string, any> = {
      status,
      status_history: newHistory,
      updated_at: tsNow,
    };
    if (status === 'paid') patch.paid_at = tsNow;
    if (meta?.processor_payload) patch.processor_payload = meta.processor_payload;
    txn.update(ref, patch);
    return { record: { id: existing.docs[0].id, ...data, ...patch } };
  });

  if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
    console.log(
      `[Firebase Manager] paymentTransactionAppendStatusAtomic ${orderReference} → ${status}`
    );
  }

  return { success: true, record: result.record };
}

/**
 * Real-time listener for a single payment transaction by order_reference.
 * Pairs with `PaymentConductor.handleWebhook` so the UI can update without
 * polling after a WayForPay / Stripe redirect.
 */
export function createPaymentTransactionListener(
  orderReference: string,
  callback: (record: { id: string; data: Record<string, any> } | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db
      .collection('payment_transactions')
      .where('order_reference', '==', orderReference)
      .limit(1)
      .onSnapshot(
        (snap) => {
          if (snap.empty) {
            callback(null);
            return;
          }
          const d = snap.docs[0];
          callback({ id: d.id, data: d.data() as Record<string, any> });
        },
        errorCallback
      );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(
        `[Firebase Manager] Payment transaction listener attached for order_reference ${orderReference}`
      );
    }
    return unsubscribe;
  } catch (error) {
    console.error(
      `[Firebase Manager] Error attaching payment transaction listener for ${orderReference}:`,
      error
    );
    throw error;
  }
}

// ============================================================================
// WALLET TRANSACTIONS (SSOT: wallet_transactions collection)
// ----------------------------------------------------------------------------
// Per-user history of on-chain debits / credits and admin-triggered
// adjustments. Used by the unified `/api/wallet/activity` feed and the
// Wallet UI. Pairs with `features/wallet/services/credit-balance-service.ts`
// (fiat credits) and `features/wallet/chains/native-token-transfer-service.ts`
// (on-chain RING transfers).
// ============================================================================

/**
 * Cached paginated wallet transactions for a user, newest first.
 */
export const getCachedWalletTransactions = cache(async (
  userId: string,
  options: { limit?: number; type?: string; startDate?: number; endDate?: number } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getWalletTransactions', 'wallet_transactions', { userId, ...options });
  try {
    const db = getAdminDb();
    const filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [
      { field: 'user_id', operator: '==', value: userId },
    ];
    if (options.type) filters.push({ field: 'type', operator: '==', value: options.type });
    if (options.startDate) {
      filters.push({ field: 'timestamp', operator: '>=', value: options.startDate });
    }
    if (options.endDate) {
      filters.push({ field: 'timestamp', operator: '<=', value: options.endDate });
    }
    const snapshot = await getCachedCollectionAdvanced('wallet_transactions', {
      where: filters,
      orderBy: [{ field: 'timestamp', direction: 'desc' }],
      limit: options.limit ?? 25,
    });
    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error listing wallet transactions for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached single wallet transaction by id.
 */
export const getCachedWalletTransaction = cache(async (
  transactionId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getWalletTransaction', 'wallet_transactions', { transactionId });
  try {
    const db = getAdminDb();
    const doc = await db.collection('wallet_transactions').doc(transactionId).get();
    metrics.recordCacheMiss();
    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching wallet transaction ${transactionId}:`, error);
    throw error;
  }
});

/**
 * Real-time listener for a user's wallet transactions. Pair with
 * `/api/wallet/activity` to deliver a live activity feed.
 */
export function createWalletTransactionListener(
  userId: string,
  callback: (rows: Array<{ id: string; data: Record<string, any> }>) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db
      .collection('wallet_transactions')
      .where('user_id', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(25)
      .onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
          callback(rows);
        },
        errorCallback
      );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Wallet transaction listener attached for user ${userId}`);
    }
    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error attaching wallet transaction listener for ${userId}:`, error);
    throw error;
  }
}

// ============================================================================
// DESK ORDERS (SSOT: desk_orders collection)
// ----------------------------------------------------------------------------
// Desk orders represent the credit ↔ native-token conversion flow executed
// at the oracle rate. The flow is:
//   1. `/api/wallet/desk/quote`  → HMAC-signed `desk_orders` row (status=pending)
//   2. `/api/wallet/desk/execute` → settle against treasury (status=settled | failed)
// Pairs with `lib/payments/credit-currency.ts` (rate math) and
// `lib/payments/credit-currency-client.ts` (client fetch).
// ============================================================================

/**
 * Cached single desk order by id.
 */
export const getCachedDeskOrder = cache(async (
  deskOrderId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getDeskOrder', 'desk_orders', { deskOrderId });
  try {
    const db = getAdminDb();
    const doc = await db.collection('desk_orders').doc(deskOrderId).get();
    metrics.recordCacheMiss();
    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching desk order ${deskOrderId}:`, error);
    throw error;
  }
});

/**
 * Cached paginated desk orders for a user, newest first.
 */
export const getCachedUserDeskOrders = cache(async (
  userId: string,
  options: { limit?: number; status?: string; side?: 'buy' | 'sell' } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getUserDeskOrders', 'desk_orders', { userId, ...options });
  try {
    const db = getAdminDb();
    const filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [
      { field: 'user_id', operator: '==', value: userId },
    ];
    if (options.status) filters.push({ field: 'status', operator: '==', value: options.status });
    if (options.side) filters.push({ field: 'side', operator: '==', value: options.side });
    const snapshot = await getCachedCollectionAdvanced('desk_orders', {
      where: filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: options.limit ?? 20,
    });
    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error listing desk orders for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached batch — pending desk orders older than `olderThanMs` (default 60s)
 * for the executor cron job. Caps at 100 to stay within batch limits.
 */
export const getCachedPendingDeskOrders = cache(async (
  options: { limit?: number; olderThanMs?: number } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getPendingDeskOrders', 'desk_orders', options);
  try {
    const db = getAdminDb();
    const olderThan = options.olderThanMs ?? 60 * 1000;
    const cutoff = new Date(Date.now() - olderThan).toISOString();
    const snapshot = await db
      .collection('desk_orders')
      .where('status', '==', 'pending')
      .where('created_at', '<=', cutoff)
      .orderBy('created_at', 'asc')
      .limit(options.limit ?? 100)
      .get();
    metrics.recordCacheMiss();
    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching pending desk orders:', error);
    throw error;
  }
});

/**
 * Real-time listener for a single desk order by id. Used by the desk modal
 * to reflect the settlement outcome without polling.
 */
export function createDeskOrderListener(
  deskOrderId: string,
  callback: (record: { id: string; data: Record<string, any> } | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db.collection('desk_orders').doc(deskOrderId).onSnapshot(
      (snap) => {
        if (!snap.exists) {
          callback(null);
          return;
        }
        callback({ id: snap.id, data: snap.data() as Record<string, any> });
      },
      errorCallback
    );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Desk order listener attached for ${deskOrderId}`);
    }
    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error attaching desk order listener for ${deskOrderId}:`, error);
    throw error;
  }
}

// ============================================================================
// ORDER HISTORY (SSOT: orders collection — membership + store)
// ----------------------------------------------------------------------------
// The `orders` collection is the canonical record for both membership
// (subscription-driven) and store (product-driven) checkouts. The
// `FirebaseStoreAdapter.checkout` and the membership conductor both write
// to this collection.
// ============================================================================

/**
 * Cached user orders with optional status filter.
 */
export const getCachedUserOrders = cache(async (
  userId: string,
  options: { status?: string; limit?: number } = {}
): Promise<QuerySnapshot> => {
  const signature = createRequestSignature('getUserOrders', 'orders', { userId, ...options });
  try {
    const db = getAdminDb();
    const filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [
      { field: 'userId', operator: '==', value: userId },
    ];
    if (options.status) filters.push({ field: 'status', operator: '==', value: options.status });
    const snapshot = await getCachedCollectionAdvanced('orders', {
      where: filters,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: options.limit ?? 20,
    });
    return snapshot;
  } catch (error) {
    console.error(`[Firebase Manager] Error listing orders for ${userId}:`, error);
    throw error;
  }
});

/**
 * Cached single order by id.
 */
export const getCachedUserOrder = cache(async (
  orderId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getUserOrder', 'orders', { orderId });
  try {
    const db = getAdminDb();
    const doc = await db.collection('orders').doc(orderId).get();
    metrics.recordCacheMiss();
    return doc.exists ? doc : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching order ${orderId}:`, error);
    throw error;
  }
});

/**
 * Cached lookup — order by payment transaction id (cross-references
 * `payment_transactions.id`). Useful for the order detail page after a
 * successful WayForPay/Stripe redirect.
 */
export const getCachedOrderByPaymentTransaction = cache(async (
  paymentTransactionId: string
): Promise<DocumentSnapshot | null> => {
  const signature = createRequestSignature('getOrderByPaymentTransaction', 'orders', { paymentTransactionId });
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection('orders')
      .where('paymentTransactionId', '==', paymentTransactionId)
      .limit(1)
      .get();
    metrics.recordCacheMiss();
    if (snapshot.empty) return null;
    return snapshot.docs[0];
  } catch (error) {
    console.error(
      `[Firebase Manager] Error fetching order by payment transaction ${paymentTransactionId}:`,
      error
    );
    throw error;
  }
});

/**
 * Real-time listener for a single order by id. Pairs with
 * `PaymentConductor.handleWebhook` to update the order status after a
 * successful payment.
 */
export function createOrderListener(
  orderId: string,
  callback: (record: { id: string; data: Record<string, any> } | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  try {
    const db = getAdminDb();
    const unsubscribe = db.collection('orders').doc(orderId).onSnapshot(
      (snap) => {
        if (!snap.exists) {
          callback(null);
          return;
        }
        callback({ id: snap.id, data: snap.data() as Record<string, any> });
      },
      errorCallback
    );
    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Order listener attached for ${orderId}`);
    }
    return unsubscribe;
  } catch (error) {
    console.error(`[Firebase Manager] Error attaching order listener for ${orderId}:`, error);
    throw error;
  }
}

/**
 * NEWS DOMAIN OPERATIONS
 * Optimized news, categories, and comments operations with caching
 */

/**
 * Get news collection with caching and converter
 */
export const getCachedNewsCollection = cache(async (
  options: {
    limit?: number;
    orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>;
    startAfter?: any;
  } = {}
) => {
  const signature = createRequestSignature('getNewsCollection', 'news', options);

  try {
    const db = getAdminDb();
    let query: any = db.collection('news');

    // Apply where clauses
    if (options.where) {
      options.where.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
    }

    // Apply ordering
    if (options.orderBy) {
      options.orderBy.forEach(({ field, direction = 'asc' }) => {
        query = query.orderBy(field, direction);
      });
    } else {
      query = query.orderBy('publishedAt', 'desc'); // Default sort
    }

    // Apply pagination
    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - News Collection: ${snapshot.size} articles`);
    }

    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching news collection:', error);
    throw error;
  }
});

/**
 * Get news categories collection with caching
 */
export const getCachedNewsCategoriesCollection = cache(async (
  options: {
    limit?: number;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    where?: { field: string; operator: FirebaseFirestore.WhereFilterOp; value: any };
  } = {}
) => {
  const signature = createRequestSignature('getNewsCategoriesCollection', 'newsCategories', options);

  try {
    const db = getAdminDb();
    let query: any = db.collection('newsCategories');

    // Apply where clauses
    if (options.where) {
      query = query.where(options.where.field, options.where.operator, options.where.value);
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    } else {
      query = query.orderBy('name', 'asc'); // Default alphabetical sort
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - News Categories: ${snapshot.size} categories`);
    }

    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching news categories:', error);
    throw error;
  }
});

/**
 * Get news comments collection with caching
 */
export const getCachedNewsCommentsCollection = cache(async (
  newsId?: string,
  options: {
    limit?: number;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>;
  } = {}
) => {
  const signature = createRequestSignature('getNewsCommentsCollection', 'newsComments', { newsId, ...options });

  try {
    const db = getAdminDb();
    let query: any = db.collection('newsComments');

    // Filter by news article if provided
    if (newsId) {
      query = query.where('newsId', '==', newsId);
    }

    // Apply additional where clauses
    if (options.where) {
      options.where.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'desc');
    } else {
      query = query.orderBy('createdAt', 'desc'); // Default newest first
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - News Comments: ${snapshot.size} comments`);
    }

    return snapshot;
  } catch (error) {
    console.error('[Firebase Manager] Error fetching news comments:', error);
    throw error;
  }
});

/**
 * Get single news article by ID with caching
 */
export const getCachedNewsById = cache(async (newsId: string) => {
  return getCachedDocument('news', newsId);
});

/**
 * Get single news article by slug with caching
 */
export const getCachedNewsBySlug = cache(async (slug: string) => {
  const signature = createRequestSignature('getNewsBySlug', 'news', { slug });

  try {
    const db = getAdminDb();
    const query = db.collection('news').where('slug', '==', slug).limit(1);
    const snapshot = await query.get();

    metrics.recordCacheMiss();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Cache MISS - News by slug: ${slug}`);
    }

    return snapshot.docs.length > 0 ? snapshot.docs[0] : null;
  } catch (error) {
    console.error(`[Firebase Manager] Error fetching news by slug ${slug}:`, error);
    throw error;
  }
});

/**
 * PERFORMANCE UTILITIES
 */

/**
 * Get cache performance metrics
 */
export function getCacheMetrics() {
  return {
    hitRate: metrics.getHitRate(),
    totalRequests: metrics.totalRequests,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses
  };
}

/**
 * Reset performance metrics
 */
export function resetCacheMetrics() {
  metrics.reset();
}

/**
 * Log cache performance summary
 */
export function logCachePerformance() {
  const hitRate = metrics.getHitRate();
  console.log(`
[Firebase Service Manager Performance Summary]
Total Requests: ${metrics.totalRequests}
Cache Hits: ${metrics.cacheHits}
Cache Misses: ${metrics.cacheMisses}
Hit Rate: ${hitRate.toFixed(2)}%
  `.trim());
}

/**
 * ADVANCED TRANSACTION & BATCH OPERATIONS
 * Extracted from firebase-service-optimized.ts and firebase-service.ts
 * for real-world use cases requiring atomic operations
 */

/**
 * Update user role and permissions - Atomic operation
 *
 * Updates user role and related permissions in a single transaction.
 * This is a real-world use case where user changes affect multiple collections.
 *
 * @param userId - User ID to update
 * @param newRole - New role to assign
 * @param permissions - Updated permissions object
 * @throws Error if role update fails
 *
 * @example
 * ```typescript
 * await updateUserRoleAndPermissions('user123', 'admin', {
 *   canPostconfidentialOpportunities: true,
 *   canViewconfidentialOpportunities: true
 * });
 * ```
 */
export async function updateUserRoleAndPermissions(
  userId: string,
  newRole: string,
  permissions: {
    canPostconfidentialOpportunities?: boolean;
    canViewconfidentialOpportunities?: boolean;
  }
): Promise<void> {
  const adminDb = getAdminDb();

  await adminDb.runTransaction(async (transaction) => {
    // Update user profile with new role and permissions
    const userRef = adminDb.collection('userProfiles').doc(userId);
    transaction.update(userRef, {
      role: newRole,
      ...permissions,
      updatedAt: new Date()
    });

    // Update any entities owned by this user to reflect new permissions
    const entitiesSnapshot = await adminDb
      .collection('entities')
      .where('userId', '==', userId)
      .get();

    entitiesSnapshot.docs.forEach(doc => {
      transaction.update(doc.ref, {
        ownerRole: newRole,
        updatedAt: new Date()
      });
    });
  });
}

/**
 * Delete user account with complete cleanup - Atomic operation
 *
 * Performs complete user account deletion including all related data.
 * This is a real-world use case where multiple collections need atomic updates.
 *
 * @param userId - User ID to delete
 * @throws Error if account deletion fails
 *
 * @example
 * ```typescript
 * await deleteUserAccountWithCleanup('user123');
 * ```
 */
export async function deleteUserAccountWithCleanup(userId: string): Promise<void> {
  const adminDb = getAdminDb();
  const adminAuth = getAdminAuth();

  await adminDb.runTransaction(async (transaction) => {
    // Delete user profile
    const userRef = adminDb.collection('userProfiles').doc(userId);
    transaction.delete(userRef);

    // Delete user's entities
    const entitiesSnapshot = await adminDb
      .collection('entities')
      .where('userId', '==', userId)
      .get();

    entitiesSnapshot.docs.forEach(doc => {
      transaction.delete(doc.ref);
    });

    // Delete user's opportunities
    const opportunitiesSnapshot = await adminDb
      .collection('opportunities')
      .where('userId', '==', userId)
      .get();

    opportunitiesSnapshot.docs.forEach(doc => {
      transaction.delete(doc.ref);
    });
  });

  // Finally delete auth account (outside transaction as it's not Firestore)
  try {
    await adminAuth.deleteUser(userId);
  } catch (error) {
    console.error('Error deleting Firebase Auth user:', error);
    throw error;
  }
}

/**
 * Batch update entities - Optimized with efficient data organization
 *
 * Updates multiple entities in a single batch operation for improved performance.
 * Uses Map for efficient data organization.
 *
 * @param updates - Array of entity updates with ID and data
 * @throws Error if batch update fails
 *
 * @example
 * ```typescript
 * await batchUpdateEntities([
 *   { id: 'entity1', data: { name: 'Updated Name' } },
 *   { id: 'entity2', data: { status: 'active' } }
 * ]);
 * ```
 */
export async function batchUpdateEntities(updates: Array<{ id: string, data: any }>): Promise<void> {
  if (!updates.length) return;

  try {
    const adminDb = getAdminDb();
    const batch = adminDb.batch();

    // Use Map for efficient data organization
    const updateMap = new Map(updates.map(({ id, data }) => [id, data]));

    for (const [id, data] of updateMap) {
      const docRef = adminDb.collection('entities').doc(id);
      batch.update(docRef, data);
    }

    await batch.commit();

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Batch updated ${updates.length} entities`);
    }
  } catch (error) {
    console.error('[Firebase Manager] Batch entity update failed:', error);
    throw error;
  }
}

/**
 * Bulk write opportunities - Optimized for performance
 *
 * Writes multiple opportunities in batches to handle Firestore's 500-item limit.
 * Processes large datasets efficiently with automatic batching.
 *
 * @param opportunities - Array of opportunities to write
 * @throws Error if bulk write fails
 *
 * @example
 * ```typescript
 * await bulkWriteOpportunities([
 *   { title: 'Opportunity 1', description: '...' },
 *   { title: 'Opportunity 2', description: '...' }
 * ]);
 * ```
 */
export async function bulkWriteOpportunities(opportunities: Array<any>): Promise<void> {
  if (!opportunities.length) return;

  const BATCH_SIZE = 500; // Firestore batch limit
  const adminDb = getAdminDb();

  try {
    // Process in batches for large datasets
    for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const batchOpportunities = opportunities.slice(i, i + BATCH_SIZE);

      for (const opportunity of batchOpportunities) {
        const docRef = adminDb.collection('opportunities').doc();
        batch.set(docRef, opportunity);
      }

      await batch.commit();
    }

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Bulk wrote ${opportunities.length} opportunities in ${Math.ceil(opportunities.length / BATCH_SIZE)} batches`);
    }
  } catch (error) {
    console.error('[Firebase Manager] Bulk opportunity write failed:', error);
    throw error;
  }
}

/**
 * Update user profile and related entities in a transaction
 *
 * Updates user profile data and related entities atomically.
 * This ensures data consistency when user changes affect multiple documents.
 *
 * @param userId - The ID of the user whose profile to update
 * @param profileData - The user profile data to update
 * @param entityUpdates - An array of entity updates
 * @throws Error if transaction fails
 *
 * @example
 * ```typescript
 * await updateUserProfileAndEntities('user123',
 *   { name: 'New Name' },
 *   [{ id: 'entity1', data: { ownerName: 'New Name' } }]
 * );
 * ```
 */
export async function updateUserProfileAndEntities(
  userId: string,
  profileData: any,
  entityUpdates: Array<{ id: string, data: any }>
): Promise<void> {
  try {
    const adminDb = getAdminDb();

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('userProfiles').doc(userId);

      // Update user profile
      transaction.update(userRef, {
        ...profileData,
        lastLogin: new Date(),
      });

      // Update related entities
      entityUpdates.forEach(({ id, data }) => {
        const entityRef = adminDb.collection('entities').doc(id);
        transaction.update(entityRef, data);
      });
    });

    if (process.env.NODE_ENV === 'development' && process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log(`[Firebase Manager] Successfully updated profile and ${entityUpdates.length} entities for user ${userId}`);
    }
  } catch (error) {
    console.error('[Firebase Manager] Error updating user profile and entities:', error);
    throw error;
  }
}

/**
 * TYPE-SAFE WRAPPER FUNCTIONS
 * Enhanced functions with better type safety and data extraction
 */

/**
 * Get a document and extract its data with type safety
 * Enhanced version that returns typed data directly
 */
export async function getCachedDocumentTyped<T>(
  collection: string,
  docId: string
): Promise<T | null> {
  const doc = await getCachedDocument(collection, docId)
  if (!doc || !doc.exists) {
    return null
  }
  return { id: doc.id, ...doc.data() } as T
}

/**
 * Get collection with advanced query and extract typed data
 * Enhanced version with better pagination and type safety
 */
export async function getCachedCollectionTyped<T>(
  collection: string,
  queryConfig: {
    filters?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>
    orderBy?: { field: string; direction?: 'asc' | 'desc' }
    limit?: number
    startAfter?: any
    endBefore?: any
  } = {}
): Promise<{ items: T[], lastVisible: string | null, totalCount?: number }> {
  // Convert our interface to the expected format
  const convertedConfig = {
    where: queryConfig.filters,
    orderBy: queryConfig.orderBy ? [queryConfig.orderBy] : undefined,
    limit: queryConfig.limit,
    startAfter: queryConfig.startAfter,
    endBefore: queryConfig.endBefore
  }

  const snapshot = await getCachedCollectionAdvanced(collection, convertedConfig)

  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[]

  const lastVisible = snapshot.docs.length > 0
    ? snapshot.docs[snapshot.docs.length - 1].id
    : null

  return {
    items,
    lastVisible,
    totalCount: items.length
  }
}

/**
 * Create document with proper data handling and ID cleanup
 */
export async function createDocumentTyped(
  collection: string,
  docId: string,
  data: any
): Promise<void> {
  // Remove the id field if it exists in data to avoid conflicts
  const { id, ...cleanData } = data
  await createDocument(collection, cleanData, docId)
}

/**
 * Update document with proper data handling and ID cleanup
 */
export async function updateDocumentTyped(
  collection: string,
  docId: string,
  data: any
): Promise<void> {
  // Remove the id field if it exists in data to avoid conflicts
  const { id, ...cleanData } = data
  await updateDocument(collection, docId, cleanData)
}

/**
 * BACKEND ADAPTER INTERFACE AND IMPLEMENTATION
 * Generic backend operations with query filtering
 */

export interface QueryFilters {
  where?: Array<{ field: string; op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains' | 'array-contains-any'; value: any }>;
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
  startAfterId?: string;
}

export interface BackendAdapter {
  create<T>(collection: string, data: T): Promise<{ id: string; data: T }>
  read<T>(collection: string, id: string): Promise<T | null>
  update<T>(collection: string, id: string, data: Partial<T>): Promise<void>
  delete(collection: string, id: string): Promise<void>
  query<T>(collection: string, filters: QueryFilters): Promise<Array<{ id: string; data: T }>>
}

/**
 * Firebase Backend Adapter Implementation
 * Generic CRUD operations using firebase-service-manager
 */
export class FirebaseBackendAdapter implements BackendAdapter {
  async create<T>(collection: string, data: T): Promise<{ id: string; data: T }> {
    const docRef = await createDocument(collection, data as any)
    const doc = await getCachedDocument(collection, docRef.id)
    return {
      id: docRef.id,
      data: { id: docRef.id, ...(doc?.data() as any) } as T
    }
  }

  async read<T>(collection: string, id: string): Promise<T | null> {
    return await getCachedDocumentTyped<T>(collection, id)
  }

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<void> {
    await updateDocumentTyped(collection, id, data)
  }

  async delete(collection: string, id: string): Promise<void> {
    await deleteDocument(collection, id)
  }

  async query<T>(collection: string, filters: QueryFilters): Promise<Array<{ id: string; data: T }>> {
    const queryConfig = {
      filters: filters.where?.map(w => ({
        field: w.field,
        operator: w.op as FirebaseFirestore.WhereFilterOp,
        value: w.value
      })),
      orderBy: filters.orderBy?.[0],
      limit: filters.limit
    }

    // Handle startAfterId if provided
    let startAfter: any = undefined
    if (filters.startAfterId) {
      const startDoc = await getCachedDocument(collection, filters.startAfterId)
      if (startDoc?.exists) {
        startAfter = startDoc
      }
    }

    const result = await getCachedCollectionTyped<T>(collection, {
      ...queryConfig,
      startAfter
    })

    return result.items.map(item => ({
      id: (item as any).id,
      data: item
    }))
  }
}



export interface StoreAdapter {
  listProducts(): Promise<StoreProduct[]>
  checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }>
}

/**
 * Firebase Store Adapter Implementation
 * Store-specific operations using firebase-service-manager
 */
export class FirebaseStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    try {
      const snapshot = await getCachedCollection('products', {
        orderBy: { field: 'name', direction: 'asc' }
      })

      const items: StoreProduct[] = []
      snapshot.forEach(doc => {
        const data = doc.data() as any
        items.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          price: String(data.price),
          currency: data.currency,
          inStock: Boolean(data.inStock),
        })
      })

      return items
    } catch (error) {
      console.error('[FirebaseStoreAdapter] Error listing products:', error)
      throw new Error('Failed to retrieve products')
    }
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    try {
      const orderItems: OrderItem[] = items.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        currency: item.product.currency,
        quantity: item.quantity,
      }))

      const totals: OrderTotalsByCurrency = orderItems.reduce((acc, item) => {
        const currency = item.currency
        const price = parseFloat(item.price) * item.quantity
        acc[currency] = (acc[currency] || 0) + price
        return acc
      }, {} as OrderTotalsByCurrency)

      const now = new Date().toISOString()
      const order: Omit<Order, 'id'> = {
        items: orderItems,
        totals,
        checkoutInfo: info,
        status: 'new',
        createdAt: now,
      }

      const docRef = await createDocument('orders', order)
      return { orderId: docRef.id }
    } catch (error) {
      console.error('[FirebaseStoreAdapter] Error during checkout:', error)
      throw new Error('Failed to process checkout')
    }
  }

  async createProduct(productData: Partial<StoreProduct> & { vendorId: string }): Promise<StoreProduct> {
    try {
      // Extract and provide defaults for all properties
      const {
        name = 'Unnamed Product',
        description = '',
        price = '0',
        currency = 'USD',
        category,
        tags = [],
        slug,
        longDescription,
        images,
        vendorName,
        stock,
        sku,
        featured,
        rating,
        reviewCount,
        billingPeriod,
        specifications,
        digitalProduct,
        instantDelivery,
        shipping,
        productListedAt = ['1'],
        ownerEntityId,
        storeId = '1',
        status = 'active',
        vendorId
      } = productData as any // Cast to any to bypass TypeScript issues

      const product = {
        name,
        description,
        price,
        currency,
        category,
        tags,
        slug,
        longDescription,
        images,
        vendorName,
        stock,
        sku,
        featured,
        rating,
        reviewCount,
        billingPeriod,
        specifications,
        digitalProduct,
        instantDelivery,
        shipping,
        productListedAt,
        productOwner: vendorId,
        ownerEntityId,
        storeId,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const docRef = await createDocument('products', product)

      return {
        id: docRef.id,
        name,
        description,
        price,
        currency: currency as any,
        inStock: productData.inStock !== false,
        category,
        tags,
        slug,
        longDescription,
        images,
        vendorName,
        stock,
        sku,
        featured,
        rating,
        reviewCount,
        billingPeriod,
        specifications,
        digitalProduct,
        instantDelivery,
        shipping,
        productListedAt,
        productOwner: vendorId,
        ownerEntityId,
        storeId,
        status: status as any
      }
    } catch (error) {
      console.error('[FirebaseStoreAdapter] Error creating product:', error)
      throw new Error('Failed to create product')
    }
  }
}

/**
 * LEGACY COMPATIBILITY
 * Wrapper functions to ease migration from direct getAdminDb() calls
 *
 * @deprecated Prefer the specific cached functions or the typed SSOT
 * helpers. This wrapper is retained for callers that import the whole
 * service manager bag.
 */

/**
 * Get Firestore instance for direct database operations
 *
 * Use this for:
 * - Subcollections (users/{id}/addresses, users/{id}/preferences)
 * - Complex queries requiring direct database access
 * - Batch operations and transactions
 *
 * For top-level collections, prefer specific cached operations like:
 * getCachedDocument(), updateDocument(), createDocument()
 */
export function getFirebaseServiceManager() {
  return {
    // Core Firebase instances
    db: getAdminDb(),
    auth: getAdminAuth(),

    // Basic cached operations
    getCachedDocument,
    getCachedCollection,
    getCachedDocumentBatch,
    getCachedUser,
    getCachedUsers,

    // Advanced collection operations
    getCachedCollectionAdvanced,
    getCachedSubcollection,
    getCachedCollectionGroup,

    // News domain operations
    getCachedNewsCollection,
    getCachedNewsCategoriesCollection,
    getCachedNewsCommentsCollection,
    getCachedNewsById,
    getCachedNewsBySlug,

    // Legacy payment operations (kept for backward compatibility — new code
    // should prefer the SSOT helpers below).
    getUserCreditTransactions: getCachedCreditTransactions,
    getActiveSubscriptions: getCachedSubscriptionsDue,
    getUserOrders: getCachedUserOrders,

    // ----- SSOT helpers (added in ring-db firebase-full mode upgrade) -----

    // Credit balance domain (users/{userId}.credit_balance + .credit_transactions[])
    getCachedUserCreditBalance,
    getCachedCreditTransactions,
    getCachedUserCreditBalanceTyped,
    creditBalanceAdjustAtomic,
    createCreditBalanceListener,

    // Subscription domain (subscription_ledger)
    getCachedLatestSubscription,
    getCachedActiveSubscription,
    getCachedSubscriptionsDue,
    getCachedSubscription,
    getCachedUserSubscriptions,
    getCachedLatestSubscriptionTyped,
    getCachedActiveSubscriptionTyped,
    getCachedSubscriptionStats,
    subscriptionStatusUpdateAtomic,
    createSubscriptionListener,

    // Payment conductor bridge (payment_transactions)
    getCachedPaymentTransaction,
    getCachedPaymentTransactionById,
    getCachedUserPaymentTransactions,
    getCachedPendingPaymentTransactions,
    getCachedPaymentTransactionTyped,
    paymentTransactionAppendStatusAtomic,
    createPaymentTransactionListener,

    // Wallet transactions (wallet_transactions)
    getCachedWalletTransactions,
    getCachedWalletTransaction,
    createWalletTransactionListener,

    // Desk orders (desk_orders)
    getCachedDeskOrder,
    getCachedUserDeskOrders,
    getCachedPendingDeskOrders,
    createDeskOrderListener,

    // Order history (orders)
    getCachedUserOrders,
    getCachedUserOrder,
    getCachedOrderByPaymentTransaction,
    createOrderListener,

    // Write operations
    createDocument,
    updateDocument,
    deleteDocument,

    // Batch and transaction operations
    createBatchWriter,
    executeBatch,
    runTransaction,
    createBulkWriter,

    // Real-time listeners
    createDocumentListener,
    createCollectionListener,

    // Performance utilities
    getCacheMetrics,
    resetCacheMetrics,
    logCachePerformance,

    // Advanced transaction & batch operations
    updateUserRoleAndPermissions,
    deleteUserAccountWithCleanup,
    batchUpdateEntities,
    bulkWriteOpportunities,
    updateUserProfileAndEntities
  };
}
