/**
 * Firebase Service Helpers
 * 
 * Helper functions to work with Firebase service manager and extract typed data
 */

import { 
  getCachedDocument as _getCachedDocument,
  getCachedCollectionAdvanced as _getCachedCollectionAdvanced,
  createDocument as _createDocument,
  updateDocument as _updateDocument,
  runTransaction as _runTransaction
} from './firebase-service-manager'
import type { DocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore'

/**
 * Get a document and extract its data with type safety
 */
export async function getCachedDocument<T>(
  collection: string, 
  docId: string
): Promise<T | null> {
  const doc = await _getCachedDocument(collection, docId)
  if (!doc || !doc.exists) {
    return null
  }
  return { id: doc.id, ...doc.data() } as T
}

/**
 * Get collection with advanced query and extract data
 */
export async function getCachedCollectionAdvanced<T>(
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
  
  const snapshot = await _getCachedCollectionAdvanced(collection, convertedConfig)
  
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
 * Create document with proper data handling
 */
export async function createDocument(
  collection: string,
  docId: string,
  data: any
): Promise<void> {
  // Remove the id field if it exists in data to avoid conflicts
  const { id, ...cleanData } = data
  await _createDocument(collection, docId, cleanData)
}

/**
 * Update document with proper data handling
 */
export async function updateDocument(
  collection: string,
  docId: string,
  data: any,
  transaction?: any
): Promise<void> {
  // Remove the id field if it exists in data to avoid conflicts
  const { id, ...cleanData } = data
  
  if (transaction) {
    // For transactions, we need to handle differently
    // This is a simplified version - in practice you'd need proper transaction handling
    await _updateDocument(collection, docId, cleanData)
  } else {
    await _updateDocument(collection, docId, cleanData)
  }
}

/**
 * Run transaction with proper handling
 */
export async function runTransaction<T>(
  updateFunction: (transaction: any) => Promise<T>
): Promise<T> {
  return await _runTransaction(updateFunction)
}

// Re-export other functions that don't need modification
export { 
  createDocument as createDocumentRaw,
  updateDocument as updateDocumentRaw,
  runTransaction as runTransactionRaw
} from './firebase-service-manager'
