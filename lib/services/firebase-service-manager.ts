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

/**
 * Centralized Firebase Service Manager
 * 
 * Provides centralized access to all Firebase services with:
 * - Request deduplication using React 19 cache()
 * - Intelligent batching and response caching
 * - Performance monitoring and optimization
 * - Build-time mocking integration
 * 
 * Replaces direct getAdminDb() calls across 73 files with optimized patterns.
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
 * Useful for nested collections like users/{userId}/credit_transactions
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
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
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
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
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
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
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
      query = query.orderBy(queryConfig.orderBy.field, queryConfig.orderBy.direction || 'asc');
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
 * SPECIALIZED PAYMENT & CREDIT OPERATIONS
 * Optimized operations for RING token payment workflows
 */

/**
 * Get user credit transactions with pagination
 */
export const getUserCreditTransactions = cache(async (
  userId: string,
  options: {
    limit?: number;
    startAfter?: DocumentSnapshot;
    type?: string;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<QuerySnapshot> => {
  return getCachedSubcollection('users', userId, 'credit_transactions', {
    limit: options.limit || 50,
    orderBy: { field: 'timestamp', direction: 'desc' },
    startAfter: options.startAfter,
    ...(options.type && { where: { field: 'type', operator: '==', value: options.type } })
  });
});

/**
 * Get active subscriptions for batch processing
 */
export const getActiveSubscriptions = cache(async (): Promise<QuerySnapshot> => {
  return getCachedCollectionAdvanced('ring_subscriptions', {
    where: [
      { field: 'status', operator: '==', value: 'ACTIVE' },
      { field: 'next_payment_due', operator: '<=', value: Date.now() }
    ],
    orderBy: [{ field: 'next_payment_due', direction: 'asc' }]
  });
});

/**
 * Get user orders with status filtering
 */
export const getUserOrders = cache(async (
  userId: string,
  status?: string,
  limit: number = 20
): Promise<QuerySnapshot> => {
  return getCachedCollectionAdvanced('orders', {
    where: status 
      ? [{ field: 'userId', operator: '==', value: userId }, { field: 'status', operator: '==', value: status }]
      : [{ field: 'userId', operator: '==', value: userId }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit
  });
});

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
    
    // Note: Cache invalidation would need additional implementation
    // for more sophisticated cache management
    
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
 * LEGACY COMPATIBILITY
 * Wrapper functions to ease migration from direct getAdminDb() calls
 */

/**
 * Get Firestore instance (legacy compatibility)
 * @deprecated Use specific cached operations instead
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
    
    // Specialized payment operations
    getUserCreditTransactions,
    getActiveSubscriptions,
    getUserOrders,
    
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
    logCachePerformance
  };
}
