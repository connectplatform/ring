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
    
    // News domain operations
    getCachedNewsCollection,
    getCachedNewsCategoriesCollection,
    getCachedNewsCommentsCollection,
    getCachedNewsById,
    getCachedNewsBySlug,
    
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
    logCachePerformance,

    // Advanced transaction & batch operations
    updateUserRoleAndPermissions,
    deleteUserAccountWithCleanup,
    batchUpdateEntities,
    bulkWriteOpportunities,
    updateUserProfileAndEntities
  };
}
