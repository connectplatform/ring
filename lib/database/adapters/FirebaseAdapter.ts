/**
 * Firebase Adapter for Database Abstraction Layer
 *
 * Implements IDatabaseService for Firebase Firestore with PostgreSQL-compatible operations
 */

import {
  Firestore,
  DocumentData,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
  WriteBatch,
  Transaction,
  FieldValue,
  Timestamp
} from 'firebase-admin/firestore';
import { DocumentReference } from 'firebase-admin/firestore';
import {
  IDatabaseService,
  DatabaseResult,
  DatabaseFilter,
  DatabaseOrderBy,
  DatabasePagination,
  DatabaseQuery,
  DatabaseDocument,
  IDatabaseTransaction,
  DatabaseSchema,
  DatabaseBackendConfig
} from '../interfaces/IDatabaseService';

// Interface for documents with standard Firebase fields
interface FirebaseDocumentData extends DocumentData {
  createdAt?: FirebaseFirestore.Timestamp | Date;
  updatedAt?: FirebaseFirestore.Timestamp | Date;
  version?: number;
}

// Helper function to safely convert Firebase Timestamp or Date to Date
function toDate(value: FirebaseFirestore.Timestamp | Date | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return value instanceof Date ? value : new Date();
}

export class FirebaseAdapter implements IDatabaseService {
  private firestore: Firestore | null = null;
  private config: DatabaseBackendConfig;

  constructor(config: DatabaseBackendConfig) {
    this.config = config;
  }

  async connect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = Date.now();

      // Firebase connection is handled by the Firebase Admin SDK
      // The actual connection happens when operations are performed
      this.firestore = null; // Will be initialized on first use

      return {
        success: true,
        metadata: {
          operation: 'connect',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'connect',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async disconnect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = Date.now();

      // Firebase doesn't have explicit disconnect
      this.firestore = null;

      return {
        success: true,
        metadata: {
          operation: 'disconnect',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'disconnect',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async healthCheck(): Promise<DatabaseResult<boolean>> {
    try {
      // For Firebase, health check is implicit in operations
      return { success: true, data: true };
    } catch (error) {
      return { success: true, data: false };
    }
  }

  getBackendType(): string {
    return 'firebase';
  }

  private async getFirestore(): Promise<Firestore> {
    if (!this.firestore) {
      // Import Firebase admin and initialize
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: this.config.connection.projectId,
          credential: admin.credential.cert(this.config.connection.credentials)
        });
      }
      this.firestore = admin.firestore();
    }
    return this.firestore;
  }

  async create<T = FirebaseDocumentData>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const now = new Date();
      const documentData: FirebaseDocumentData = {
        ...data,
        createdAt: now,
        updatedAt: now,
        version: 1
      };

      let docRef: DocumentReference;
      if (options.id) {
        docRef = firestore.collection(collection).doc(options.id);
        await docRef.set(documentData, { merge: options.merge });
      } else {
        docRef = await firestore.collection(collection).add(documentData);
      }

      return {
        success: true,
        data: {
          id: docRef.id,
          data: documentData as T,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1
          }
        },
        metadata: {
          operation: 'create',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'create',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async read<T = FirebaseDocumentData>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const docRef = firestore.collection(collection).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return {
          success: true,
          data: null,
          metadata: {
            operation: 'read',
            duration: Date.now() - startTime,
            backend: 'firebase',
            timestamp: new Date()
          }
        };
      }

      const data = docSnap.data() as FirebaseDocumentData;

      return {
        success: true,
        data: {
          id: docSnap.id,
          data: data as T,
          metadata: {
            createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate() || new Date(),
            version: data.version || 1
          }
        },
        metadata: {
          operation: 'read',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'read',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async readAll<T = FirebaseDocumentData>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Add orderBy if specified
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction === 'desc' ? 'desc' : 'asc');
      }

      // Add limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Add offset (startAfter in Firestore)
      if (options.offset && options.offset > 0) {
        // For offset, we need to get the document at that position first
        // This is a simplified implementation - in production you'd want more sophisticated pagination
        query = query.offset(options.offset);
      }

      const querySnapshot = await query.get();
      const documents: DatabaseDocument<T>[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseDocumentData;
        documents.push({
          id: doc.id,
          data: data as T,
          metadata: {
            createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate() || new Date(),
            version: data.version || 1
          }
        });
      });

      return {
        success: true,
        data: documents,
        metadata: {
          operation: 'readAll',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'readAll',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async findByField<T = FirebaseDocumentData>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection).where(field, '==', value);

      // Add orderBy if specified
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction === 'desc' ? 'desc' : 'asc');
      }

      // Add limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const querySnapshot = await query.get();
      const documents: DatabaseDocument<T>[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseDocumentData;
        documents.push({
          id: doc.id,
          data: data as T,
          metadata: {
            createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate() || new Date(),
            version: data.version || 1
          }
        });
      });

      return {
        success: true,
        data: documents,
        metadata: {
          operation: 'findByField',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'findByField',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const docRef = firestore.collection(collection).doc(id);
      const docSnap = await docRef.get();

      return {
        success: true,
        data: docSnap.exists,
        metadata: {
          operation: 'exists',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'exists',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async update<T = FirebaseDocumentData>(
    collection: string,
    id: string,
    data: Partial<T>,
    options: { merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const now = new Date();
      const updateData = {
        ...data,
        updatedAt: now,
        version: FieldValue.increment(1)
      };

      const docRef = firestore.collection(collection).doc(id);
      await docRef.set(updateData, { merge: options.merge !== false });

      // Read back the updated document
      const docSnap = await docRef.get();
      const updatedData = docSnap.data() as FirebaseDocumentData;

      return {
        success: true,
        data: {
          id: docSnap.id,
          data: updatedData as T,
          metadata: {
            createdAt: updatedData.createdAt instanceof Date ? updatedData.createdAt : updatedData.createdAt?.toDate() || new Date(),
            updatedAt: updatedData.updatedAt instanceof Date ? updatedData.updatedAt : updatedData.updatedAt?.toDate() || new Date(),
            version: updatedData.version || 1
          }
        },
        metadata: {
          operation: 'update',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'update',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const docRef = firestore.collection(collection).doc(id);
      await docRef.delete();

      return {
        success: true,
        metadata: {
          operation: 'delete',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'delete',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async query<T extends FirebaseDocumentData = FirebaseDocumentData>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(querySpec.collection);

      // Apply filters
      for (const filter of (querySpec.filters || [])) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      // Apply ordering
      for (const order of (querySpec.orderBy || [])) {
        query = query.orderBy(order.field, order.direction);
      }

      // Apply pagination
      if (querySpec.pagination?.limit) {
        query = query.limit(querySpec.pagination.limit);
      }

      if (querySpec.pagination?.offset) {
        query = query.offset(querySpec.pagination.offset);
      }

      const querySnapshot = await query.get();
      const documents = querySnapshot.docs.map(doc => {
        const data = doc.data() as T;
        return {
          id: doc.id,
          data,
          metadata: {
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            version: data.version || 1
          }
        };
      });

      return {
        success: true,
        data: documents,
        metadata: {
          operation: 'query',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'query',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async count(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<number>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Apply filters
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      const snapshot = await query.count().get();
      const count = snapshot.data().count;

      return {
        success: true,
        data: count,
        metadata: {
          operation: 'count',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'count',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async batchCreate<T = FirebaseDocumentData>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const batch = firestore.batch();
      const results: DatabaseDocument<T>[] = [];
      const now = new Date();

      for (const doc of documents) {
        const documentData = {
          ...doc.data,
          createdAt: now,
          updatedAt: now,
          version: 1
        };

        let docRef;
        if (doc.id) {
          docRef = firestore.collection(collection).doc(doc.id);
        } else {
          docRef = firestore.collection(collection).doc();
        }

        batch.set(docRef, documentData);

        results.push({
          id: docRef.id,
          data: documentData,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1
          }
        });
      }

      await batch.commit();

      return {
        success: true,
        data: results,
        metadata: {
          operation: 'batchCreate',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'batchCreate',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async batchUpdate<T = FirebaseDocumentData>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const batch = firestore.batch();
      const results: DatabaseDocument<T>[] = [];
      const now = new Date();

      for (const update of updates) {
        const docRef = firestore.collection(collection).doc(update.id);
        const updateData = {
          ...update.data,
          updatedAt: now,
          version: { __increment: 1 }
        };

        batch.update(docRef, updateData);

        results.push({
          id: update.id,
          data: updateData as T,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1
          }
        });
      }

      await batch.commit();

      return {
        success: true,
        data: results,
        metadata: {
          operation: 'batchUpdate',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'batchUpdate',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const batch = firestore.batch();

      for (const id of ids) {
        const docRef = firestore.collection(collection).doc(id);
        batch.delete(docRef);
      }

      await batch.commit();

      return {
        success: true,
        metadata: {
          operation: 'batchDelete',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'batchDelete',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async runTransaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    try {
      const startTime = Date.now();
      const firestore = await this.getFirestore();

      const result = await firestore.runTransaction(async (transaction) => {
        const firebaseTransaction = new FirebaseTransaction(transaction, firestore);
        return await operation(firebaseTransaction);
      });

      return {
        success: true,
        data: result,
        metadata: {
          operation: 'transaction',
          duration: Date.now() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'transaction',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async subscribe<T extends FirebaseDocumentData = FirebaseDocumentData>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    try {
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Apply filters
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      const unsubscribe = query.onSnapshot((snapshot) => {
        const documents = snapshot.docs.map(doc => {
          const data = doc.data() as T;
          return {
            id: doc.id,
            data,
            metadata: {
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
              version: data.version || 1
            }
          };
        });
        callback(documents);
      });

      return {
        success: true,
        data: { unsubscribe },
        metadata: {
          operation: 'subscribe',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'subscribe',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    }
  }

  async createCollection(
    collection: string,
    schema?: DatabaseSchema
  ): Promise<DatabaseResult<void>> {
    // Firebase collections are created implicitly
    return {
      success: true,
      metadata: {
        operation: 'createCollection',
        duration: 0,
        backend: 'firebase',
        timestamp: new Date()
      }
    };
  }

  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
    // Implementation for data migration between Firebase collections
    return {
      success: false,
      error: new Error('Data migration not implemented yet'),
      metadata: {
        operation: 'migrateData',
        duration: 0,
        backend: 'firebase',
        timestamp: new Date()
      }
    };
  }
}

/**
 * Firebase Transaction Implementation
 */
class FirebaseTransaction implements IDatabaseTransaction {
  constructor(private transaction: Transaction, private firestore: Firestore) {}

  async create<T = FirebaseDocumentData>(
    collection: string,
    data: T,
    options: { id?: string } = {}
  ): Promise<DatabaseDocument<T>> {
    const now = new Date();
    const documentData: FirebaseDocumentData = {
      ...data,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    let docRef: DocumentReference;
    if (options.id) {
      docRef = this.firestore.collection(collection).doc(options.id);
    } else {
      docRef = this.firestore.collection(collection).doc();
    }

    this.transaction.set(docRef, documentData);

    return {
      id: docRef.id,
      data: documentData as T,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1
      }
    };
  }

  async read<T = FirebaseDocumentData>(
    collection: string,
    id: string
  ): Promise<DatabaseDocument<T> | null> {
    const docRef = this.firestore.collection(collection).doc(id);
    const docSnap = await this.transaction.get(docRef);

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data() as FirebaseDocumentData;
    return {
      id: docSnap.id,
      data: data as T,
      metadata: {
        createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate() || new Date(),
        version: data.version || 1
      }
    };
  }

  async update<T = FirebaseDocumentData>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<DatabaseDocument<T>> {
    const now = new Date();
    const docRef = this.firestore.collection(collection).doc(id);
    const updateData = {
      ...data,
      updatedAt: now,
      version: FieldValue.increment(1)
    };

    this.transaction.update(docRef, updateData);

    // For transactions, we need to return the expected result
    return {
      id,
      data: updateData as T,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1
      }
    };
  }

  async delete(collection: string, id: string): Promise<void> {
    const docRef = this.firestore.collection(collection).doc(id);
    this.transaction.delete(docRef);
  }

  async commit(): Promise<void> {
    // Firebase transactions commit automatically
  }

  async rollback(): Promise<void> {
    throw new Error('Firebase transactions cannot be manually rolled back');
  }
}
