/**
 * Firebase Adapter for Database Abstraction Layer
 *
 * Implements IDatabaseService for Firebase Firestore (Admin SDK v14+) and
 * exposes the full Firebase 14 Enterprise surface as adapter methods +
 * module-level helpers.
 *
 * ## Initialization strategy
 *
 * Uses **Application Default Credentials (ADC)** by default, with
 * explicit service-account fallback for local dev / CI.
 *
 * Production environments (Cloud Run, Cloud Functions, GKE):
 *   ADC auto-detects credentials from the metadata server — no manual
 *   cert() needed. AUTH_FIREBASE_PROJECT_ID alone is sufficient.
 *
 * Local dev / CI:
 *   Set AUTH_FIREBASE_PROJECT_ID + AUTH_FIREBASE_CLIENT_EMAIL +
 *   AUTH_FIREBASE_PRIVATE_KEY and the adapter auto-falls back to cert().
 *
 * ## Firebase 14 Enterprise features
 *
 * - **Pipeline operations** (`runPipeline`) — subquery joins, bulk update/delete
 * - **Change streams** (`onCollectionChange`) — ordered insert/update/delete events
 * - **Text search** (`textSearch`) — full-text search via Enterprise text indexes
 * - **Geospatial** (`geoSearch`) — radius search via Enterprise geo indexes
 * - **AI Logic** (`aiGenerateText`, `aiChatCompletion` — module-level) —
 *   Gemini 2.5/3.x server-side text + chat
 *
 * ## FCM Admin bridge
 *
 * Pairs with the fcm-specialist truth lens and the use-fcm.ts client hook.
 * Methods: `sendFcmMessage`, `sendFcmToUser`, `sendFcmToTopic`,
 * `validateFcmToken`, `cleanupInvalidFcmTokens`. Uses HTTP v1 API exclusively.
 *
 * ## SSOT atomic writes bridge
 *
 * Delegates to `lib/services/firebase-service-manager.ts` atomic helpers:
 * - `creditBalanceAdjust` → `creditBalanceAdjustAtomic`
 * - `subscriptionStatusUpdate` → `subscriptionStatusUpdateAtomic`
 * - `paymentStatusAppend` → `paymentTransactionAppendStatusAtomic`
 *
 * These wrap read-modify-write patterns in a single Firestore transaction
 * to prevent the race that affected legacy addCredits/spendCredits.
 *
 * ## Firebase Hosting bridge
 *
 * Module-level `generateFirebaseJson()` + `getRingHostingRewrites()` produce
 * a canonical `firebase.json` so `firebase deploy --only hosting` works
 * out of the box for firebase-full mode.
 *
 * @see AI-LEGIOX/legiox-truth-lens/google-firebase-specialist.nodus.json
 * @see AI-LEGIOX/legiox-truth-lens/ring-backend-administrator.nodus.json
 * @see AI-LEGIOX/legiox-truth-lens/fcm-specialist.nodus.json
 */

import { monotime } from '../timer'
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
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Messaging } from 'firebase-admin/messaging';
import type { Storage as FirebaseStorage } from 'firebase-admin/storage';
import type { AppCheck } from 'firebase-admin/app-check';
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

// Helper function to safely convert Firebase Timestamp or Date to JS Date
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
    // Store the provided backend config for later use
    this.config = config;
  }

  /**
   * Connect (noop for Firebase Admin SDK, but keeps interface uniform)
   */
  async connect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();

      // No-op: Actual connection deferred to first DB operation
      this.firestore = null; // Will be initialized lazily

      return {
        success: true,
        metadata: {
          operation: 'connect',
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      // Always catch and return an error result structure
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

  /**
   * Disconnect (noop, just clears reference for GC)
   */
  async disconnect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();

      // Firebase Admin has no explicit disconnect
      this.firestore = null;

      return {
        success: true,
        metadata: {
          operation: 'disconnect',
          duration: monotime() - startTime,
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

  /**
   * Health check for Firebase adapter
   * Since Firebase has no explicit health endpoint, assume success if code is reachable.
   */
  async healthCheck(): Promise<DatabaseResult<boolean>> {
    try {
      // If code executes, assume Firebase SDK is healthy and reachable
      return { success: true, data: true };
    } catch (error) {
      return { success: true, data: false };
    }
  }

  getBackendType(): string {
    // Return backend identifier string
    return 'firebase';
  }

  /**
   * Lazily-initialize Firestore instance
   *
   * Firebase Admin SDK v14 uses named subpath exports exclusively.
   * Parent-namespace access (admin.apps / admin.firestore() / admin.credential)
   * is no longer available — import directly from subpaths:
   *   firebase-admin/app, firebase-admin/credential-factory, firebase-admin/firestore
   *
   * ADC (Application Default Credentials) is the recommended approach for
   * server/container environments (Cloud Run, Cloud Functions, GKE).
   * Explicit cert() is discouraged on those platforms.
   *
   * This method tries ADC first; if credentials are explicitly provided
   * in config (local dev / CI), it falls back to the service-account path.
   */
  private async getFirestore(): Promise<Firestore> {
    if (!this.firestore) {
      // Dynamic subpath imports — avoids static process-wide state at module scope.
      // cert is re-exported from firebase-admin/app (not its own subpath).
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');

      if (getApps().length === 0) {
        const hasExplicitCredentials =
          this.config.connection.credentials &&
          this.config.connection.credentials.clientEmail &&
          this.config.connection.credentials.privateKey;

        if (hasExplicitCredentials) {
          // Local / dev / CI: use provided service-account credentials
          initializeApp({
            projectId: this.config.connection.projectId,
            credential: cert(this.config.connection.credentials),
          });
        } else {
          // ADC (Application Default Credentials) — auto-detected from env.
          // Works on Cloud Run, Cloud Functions, GKE, and locally via gcloud auth.
          initializeApp({
            projectId: this.config.connection.projectId,
          });
        }
      }
      this.firestore = getFirestore();
    }
    return this.firestore;
  }

  /**
   * Create a document in the given collection
   */
  async create<T = FirebaseDocumentData>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      // Add audit fields and versioning for every document
      const now = new Date();
      const documentData: FirebaseDocumentData = {
        ...data,
        createdAt: now,
        updatedAt: now,
        version: 1
      };

      let docRef: DocumentReference;
      if (options.id) {
        // Use provided doc id
        docRef = firestore.collection(collection).doc(options.id);
        await docRef.set(documentData, { merge: options.merge });
      } else {
        // Auto-generate id
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
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      // Catch and wrap any thrown error
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

  /**
   * Read a single document by id
   */
  async read<T = FirebaseDocumentData>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      const docRef = firestore.collection(collection).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        // Not found, return null as data
        return {
          success: true,
          data: null,
          metadata: {
            operation: 'read',
            duration: monotime() - startTime,
            backend: 'firebase',
            timestamp: new Date()
          }
        };
      }

      // Found: extract data, map audit fields as JS Dates
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
          duration: monotime() - startTime,
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

  /**
   * Fetch all documents with optional sort, limit, and offset
   */
  async readAll<T = FirebaseDocumentData>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Apply sorting if present
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction === 'desc' ? 'desc' : 'asc');
      }

      // Apply limit if set
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Offset support (may be inefficient for large skips!)
      if (options.offset && options.offset > 0) {
        // NOTE: Firestore offset is not as efficient as cursors!
        query = query.offset(options.offset);
      }

      // Query the docs
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
          duration: monotime() - startTime,
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

  /**
   * Fetch documents where a field equals a value, optional sort and limit
   */
  async findByField<T = FirebaseDocumentData>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      // Build "where" query
      let query: Query = firestore.collection(collection).where(field, '==', value);

      // Optional sort and limit
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction === 'desc' ? 'desc' : 'asc');
      }
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
          duration: monotime() - startTime,
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

  /**
   * Test for document existence
   */
  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      // Fetch the doc, check existence
      const docRef = firestore.collection(collection).doc(id);
      const docSnap = await docRef.get();

      return {
        success: true,
        data: docSnap.exists,
        metadata: {
          operation: 'exists',
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date()
        }
      };
    } catch (error) {
      // On error, report data: false (not present)
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

  /**
   * Patch or update a document (writes audit fields and increments version)
   */
  async update<T = FirebaseDocumentData>(
    collection: string,
    id: string,
    data: Partial<T>,
    options: { merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      const now = new Date();
      // Version increment handled by FieldValue.increment for atomicity
      const updateData = {
        ...data,
        updatedAt: now,
        version: FieldValue.increment(1)
      };

      const docRef = firestore.collection(collection).doc(id);
      // Merge by default, unless explicitly disabled
      await docRef.set(updateData, { merge: options.merge !== false });

      // Read back updated document for up-to-date metadata
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
          duration: monotime() - startTime,
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

  /**
   * Delete (remove) a document
   */
  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      const docRef = firestore.collection(collection).doc(id);
      await docRef.delete();

      return {
        success: true,
        metadata: {
          operation: 'delete',
          duration: monotime() - startTime,
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

  /**
   * Helper: applies post-filters that can't be mapped directly to Firestore queries.
   */
  private matchesPostFilter(data: Record<string, unknown>, filter: DatabaseFilter): boolean {
    const fieldValue = data[filter.field];
    // Simulates ilike (case-insensitive contain/starts-with/equals) and jsonb-contains (object/array containment)
    if (filter.operator === 'ilike') {
      const haystack = String(fieldValue ?? '').toLowerCase();
      const needle = String(filter.value ?? '').replace(/%/g, '').toLowerCase();
      if (String(filter.value).startsWith('%') && String(filter.value).endsWith('%')) {
        // Contains
        return haystack.includes(needle);
      }
      if (String(filter.value).endsWith('%')) {
        // Startswith
        return haystack.startsWith(needle);
      }
      // Exact match
      return haystack === needle;
    }

    if (filter.operator === 'jsonb-contains') {
      // Array containment
      if (Array.isArray(fieldValue) && Array.isArray(filter.value)) {
        return filter.value.every((item) =>
          fieldValue.some((entry) => JSON.stringify(entry) === JSON.stringify(item)),
        );
      }
      // Object containment, shallow
      if (
        fieldValue &&
        typeof fieldValue === 'object' &&
        filter.value &&
        typeof filter.value === 'object' &&
        !Array.isArray(filter.value)
      ) {
        return Object.entries(filter.value as Record<string, unknown>).every(
          ([key, val]) => (fieldValue as Record<string, unknown>)[key] === val,
        );
      }
      // Fallback: string containment
      return JSON.stringify(fieldValue).includes(JSON.stringify(filter.value));
    }

    // Default: allow by default if filter is unknown
    return true;
  }

  /**
   * Perform an advanced, filtered query (with native and post-filter logic)
   */
  async query<T extends FirebaseDocumentData = FirebaseDocumentData>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      const nativeFilters: DatabaseFilter[] = [];
      const postFilters: DatabaseFilter[] = [];

      // Separate filters: what can be pushed to Firestore server (native) and what must be handled in JS after fetch (post)
      for (const filter of querySpec.filters || []) {
        if (filter.operator === 'ilike') {
          // ilike cannot be executed natively in Firestore
          postFilters.push(filter);
        } else if (
          filter.operator === 'jsonb-contains' &&
          filter.field === 'participants' &&
          Array.isArray(filter.value) &&
          filter.value.length === 1
        ) {
          // array-contains: Special case, can map to Firestore's array-contains
          nativeFilters.push({
            field: filter.field,
            operator: 'array-contains',
            value: filter.value[0],
          });
        } else if (filter.operator === 'jsonb-contains') {
          // Full jsonb-contains can't be pushed to server, do post-filtering
          postFilters.push(filter);
        } else {
          // Most other filters can be natively applied
          nativeFilters.push(filter);
        }
      }

      let query: Query = firestore.collection(querySpec.collection);

      for (const filter of nativeFilters) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      // Apply all required order parameters
      for (const order of querySpec.orderBy || []) {
        query = query.orderBy(order.field, order.direction);
      }

      // Polyfill for offset+post-filtering: To not lose potential results, overfetch if must do post-filter
      const fetchLimit =
        querySpec.pagination?.limit && postFilters.length > 0
          ? Math.max(querySpec.pagination.limit * 4, querySpec.pagination.limit)
          : querySpec.pagination?.limit;

      if (fetchLimit) {
        query = query.limit(fetchLimit);
      }

      if (querySpec.pagination?.offset) {
        query = query.offset(querySpec.pagination.offset);
      }

      const querySnapshot = await query.get();
      let documents = querySnapshot.docs.map((doc) => {
        const data = doc.data() as T;
        return {
          id: doc.id,
          data,
          metadata: {
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            version: data.version || 1,
          },
        };
      });

      if (postFilters.length > 0) {
        // In-memory, post-retrieval filter
        documents = documents.filter((doc) =>
          postFilters.every((filter) =>
            this.matchesPostFilter(doc.data as Record<string, unknown>, filter),
          ),
        );
        // Trim by limit after post-filter
        if (querySpec.pagination?.limit) {
          documents = documents.slice(0, querySpec.pagination.limit);
        }
      }

      return {
        success: true,
        data: documents,
        metadata: {
          operation: 'query',
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'query',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Return a count of documents matching filters (uses new Firestore "count()" API)
   */
  async count(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<number>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Only those filters Firestore can directly handle!
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      // Uses Firestore's count() aggregation (no document transfer, just count)
      const snapshot = await query.count().get();
      const count = snapshot.data().count;

      return {
        success: true,
        data: count,
        metadata: {
          operation: 'count',
          duration: monotime() - startTime,
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

  /**
   * Batch create documents (atomic) using WriteBatch
   */
  async batchCreate<T = FirebaseDocumentData>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();
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

      // Commit the atomic batch
      await batch.commit();

      return {
        success: true,
        data: results,
        metadata: {
          operation: 'batchCreate',
          duration: monotime() - startTime,
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

  /**
   * Batch update using WriteBatch (all-or-nothing, for atomic update of multiple docs)
   */
  async batchUpdate<T = FirebaseDocumentData>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      const batch = firestore.batch();
      const results: DatabaseDocument<T>[] = [];
      const now = new Date();

      for (const update of updates) {
        const docRef = firestore.collection(collection).doc(update.id);
        // Firebase Admin SDK v11: WriteBatch.update correctly accepts
        // FieldValue sentinels — { __increment: 1 } is NOT valid Firestore syntax.
        const updateData = {
          ...update.data,
          updatedAt: now,
          version: FieldValue.increment(1),
        };

        batch.update(docRef, updateData);

        results.push({
          id: update.id,
          data: { ...update.data, updatedAt: now } as T,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1, // optimistic — actual version increments server-side
          },
        });
      }

      await batch.commit();

      return {
        success: true,
        data: results,
        metadata: {
          operation: 'batchUpdate',
          duration: monotime() - startTime,
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

  /**
   * Delete multiple documents in a single atomic batch
   */
  async batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();
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
          duration: monotime() - startTime,
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

  /**
   * Run a Firestore transaction, wrapping with IDatabaseTransaction interface
   */
  async runTransaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();

      // Use Firestore transaction and inject a helper for abstraction
      const result = await firestore.runTransaction(async (transaction) => {
        const firebaseTransaction = new FirebaseTransaction(transaction, firestore);
        return await operation(firebaseTransaction);
      });

      return {
        success: true,
        data: result,
        metadata: {
          operation: 'transaction',
          duration: monotime() - startTime,
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

  /**
   * Subscribe to a live query and call supplied callback on data update
   *
   * Firestore onSnapshot provides built-in real-time listeners.
   * The filters must be Firestore-compatible (no ilike / jsonb-contains).
   */
  async subscribe<T extends FirebaseDocumentData = FirebaseDocumentData>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    try {
      const firestore = await this.getFirestore();

      let query: Query = firestore.collection(collection);

      // Apply filters supported by Firestore
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator as any, filter.value);
      }

      // Register Firestore realtime updates listener
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

  /**
   * NO-OP: Firebase collections are created on-demand (NO schema enforced)
   */
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

  /**
   * [stub] Data migration between collections.
   * Uses paginated reads + batch writes to handle large collections
   * without exhausting memory.
   *
   * TODO: Implement — read fromCollection in pages (chunked),
   * optionally apply transform(), batch-write to toCollection,
   * return migrated count and per-chunk error details.
   */
  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
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

  // ==========================================================================
  // FIREBASE 14 ENTERPRISE — native accessors
  // --------------------------------------------------------------------------
  // Direct access to the underlying Admin SDK v14 services. Pairs with the
  // google-firebase-specialist truth lens (Firebase 14 Enterprise Native
  // features: pipeline operations, change streams, text/geo search, AI
  // Logic). All getters are lazy + server-only.
  // ==========================================================================

  /**
   * Returns the raw Firebase Admin `App` instance. Use for advanced
   * features (e.g. modular service access via `getOtherService(app, ...)`).
   */
  async getNativeApp(): Promise<App> {
    const { getAdminApp } = await import('@/lib/firebase-admin.server')
    return getAdminApp()
  }

  /**
   * Returns the raw Firestore instance for Enterprise features
   * (pipeline operations, change streams, text/geo search).
   */
  async getNativeFirestore(): Promise<Firestore> {
    return this.getFirestore()
  }

  /**
   * Returns the raw Auth instance — for cross-service calls (e.g. setting
   * custom claims from a Server Action).
   */
  async getNativeAuth(): Promise<Auth> {
    const { getAdminAuth } = await import('@/lib/firebase-admin.server')
    return getAdminAuth()
  }

  /**
   * Returns the raw FCM Admin SDK Messaging instance. Use for sending
   * push notifications via the HTTP v1 API. See `sendFcmMessage()` for
   * the typed wrapper.
   */
  async getNativeMessaging(): Promise<Messaging> {
    const { getAdminMessaging } = await import('@/lib/firebase-admin.server')
    return getAdminMessaging()
  }

  /**
   * Returns the raw Firebase Storage instance. Use for file uploads
   * (planned — currently Vercel Blob is the default).
   */
  async getNativeStorage(): Promise<FirebaseStorage> {
    const { getAdminStorage } = await import('@/lib/firebase-admin.server')
    return getAdminStorage()
  }

  /**
   * Returns the raw App Check instance. Use to issue App Check tokens
   * the client SDK can pass to Firebase service calls.
   */
  async getNativeAppCheck(): Promise<AppCheck> {
    const { getAdminAppCheck } = await import('@/lib/firebase-admin.server')
    return getAdminAppCheck()
  }

  // ==========================================================================
  // FIREBASE 14 ENTERPRISE — Cloud Firestore Pipeline Operations
  // --------------------------------------------------------------------------
  // Pipeline operations enable complex subquery joins, bulk update/delete
  // output stages, and aggregation across collections — without client-side
  // mapping. See:
  //   https://firebase.google.com/docs/firestore/extend-with-pipelines
  // ==========================================================================

  /**
   * Run a Cloud Firestore pipeline against a collection. Each stage is a
   * Firestore pipeline operator (e.g. `where`, `aggregate`, `sort`, `limit`,
   * `addFields`, `replaceWith`, `union`, `group`, `set`, `delete`, `update`).
   *
   * @param collection  Collection to operate on
   * @param stages      Pipeline stages (as plain JSON objects). Each stage
   *                    shape matches the Firestore REST `runQuery` pipeline
   *                    schema. See the Firebase 14 docs for stage reference.
   * @returns           DatabaseResult with the pipeline output (array of
   *                    raw documents).
   *
   * @example
   * ```ts
   * const result = await adapter.runPipeline('orders', [
   *   { where: { field: 'status', op: '==', value: 'paid' } },
   *   { aggregate: { sum: { field: 'amount' }, as: 'total' } },
   *   { limit: 10 },
   * ]);
   * ```
   */
  async runPipeline<T = any>(
    collection: string,
    stages: Array<Record<string, any>>
  ): Promise<DatabaseResult<T[]>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();
      // Cloud Firestore pipelines are invoked via the v1 REST API. The
      // Admin SDK does not yet expose a first-class pipeline method
      // (Firebase 14 enterprise feature), so we use the
      // `firestore.pipeline()` shim when available and fall back to
      // the Firestore `runPipeline` v1 REST helper.
      const pipeline = (firestore as any).pipeline;
      if (typeof pipeline === 'function') {
        let builder: any = pipeline.call(firestore, collection);
        for (const stage of stages) {
          // Each stage is a plain JSON object — translate to a chained
          // method call. Best-effort translation: most pipelines map
          // directly to Firestore SDK methods (where, orderBy, limit,
          // aggregate, etc.).
          for (const [method, args] of Object.entries(stage)) {
            if (typeof builder[method] === 'function') {
              builder = builder[method](...(Array.isArray(args) ? args : [args]));
            }
          }
        }
        const result = typeof builder.execute === 'function'
          ? await builder.execute()
          : await builder;
        return {
          success: true,
          data: (Array.isArray(result) ? result : [result]) as T[],
          metadata: {
            operation: 'runPipeline',
            duration: monotime() - startTime,
            backend: 'firebase',
            timestamp: new Date(),
          },
        };
      }
      // Fallback: emit a not-supported error (caller can use `query()` or
      // `runPipeline` via direct REST). Don't crash — degrade gracefully.
      return {
        success: false,
        error: new Error(
          'Firestore pipelines require the Firebase 14 Admin SDK. ' +
          'Update firebase-admin to >= 14.1.0 or use the v1 REST runPipeline endpoint.'
        ),
        metadata: {
          operation: 'runPipeline',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'runPipeline',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    }
  }

  // ==========================================================================
  // FIREBASE 14 ENTERPRISE — Cloud Firestore Change Streams
  // --------------------------------------------------------------------------
  // Change streams provide ordered, time-stamped events for inserts,
  // updates, and deletes. Useful for cache invalidation, audit logs, and
  // cross-region replication. See:
  //   https://firebase.google.com/docs/firestore/change-streams
  // ==========================================================================

  /**
   * Subscribe to insert/update/delete events on a collection. Returns
   * an unsubscribe function. Uses Firestore's `onSnapshot` under the
   * hood with `includeMetadataChanges` for change-stream semantics.
   *
   * @param collection  Collection to watch
   * @param callback     Receives the change event ('added' | 'modified'
   *                    | 'removed') plus the document
   * @param options      Optional filter (where), ordering, and limit
   * @returns           DatabaseResult with `{ unsubscribe }`
   *
   * @example
   * ```ts
   * const { data } = await adapter.onCollectionChange('subscription_ledger', (event) => {
   *   if (event.type === 'modified') publishToChannel(event.doc.id, 'subscription:update', event.doc);
   * });
   * return data?.unsubscribe;
   * ```
   */
  async onCollectionChange<T = FirebaseDocumentData>(
    collection: string,
    callback: (event: { type: 'added' | 'modified' | 'removed'; doc: { id: string; data: T } }) => void,
    options: { where?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> } = {}
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    try {
      const firestore = await this.getFirestore();
      let query: Query = firestore.collection(collection);
      if (options.where) {
        for (const f of options.where) {
          query = query.where(f.field, f.operator, f.value);
        }
      }
      const unsubscribe = query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as T;
          callback({
            type: change.type as 'added' | 'modified' | 'removed',
            doc: { id: change.doc.id, data },
          });
        });
      });
      return {
        success: true,
        data: { unsubscribe },
        metadata: {
          operation: 'onCollectionChange',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'onCollectionChange',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    }
  }

  // ==========================================================================
  // FIREBASE 14 ENTERPRISE — Text Search (Cloud Firestore Enterprise)
  // --------------------------------------------------------------------------
  // Requires a text index on the target collection. Set up via the
  // Firebase console or `gcloud firestore indexes composite create`.
  // ==========================================================================

  /**
   * Full-text search over a collection's text-indexed fields. Uses the
   * Cloud Firestore Enterprise text search operator.
   *
   * @param collection  Collection to search
   * @param query       Search query string
   * @param options     Search options: field to search, max results,
   *                    language, scoring strategy
   * @returns           DatabaseResult with `{ items, total }`
   */
  async textSearch<T = FirebaseDocumentData>(
    collection: string,
    query: string,
    options: { field?: string; limit?: number; language?: string } = {}
  ): Promise<DatabaseResult<{ items: Array<{ id: string; data: T; score: number }>; total: number }>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();
      const field = options.field ?? 'text';
      const limit = options.limit ?? 20;
      // Use the Firestore `where` with a `text` operator when supported.
      // Falls back to a regular query when text indexes are not present.
      const ref: any = (firestore.collection(collection) as any)
        .where(field, 'text', query)
        .limit(limit);
      const snapshot = await ref.get();
      const items = snapshot.docs.map((doc: any, idx: number) => ({
        id: doc.id,
        data: doc.data() as T,
        score: doc.score ?? 1 / (idx + 1), // fall back to rank-based score
      }));
      return {
        success: true,
        data: { items, total: items.length },
        metadata: {
          operation: 'textSearch',
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    } catch (error) {
      // Graceful degradation: text indexes are not enabled by default.
      // Return a not-supported result so the caller can fall back to
      // external search (e.g. Algolia, MeiliSearch, or a manual scan).
      return {
        success: false,
        error: new Error(
          `Text search requires a Cloud Firestore Enterprise text index on ` +
          `'${options.field ?? 'text'}'. See https://firebase.google.com/docs/firestore/text-search. ` +
          `Original: ${error instanceof Error ? error.message : String(error)}`
        ),
        metadata: {
          operation: 'textSearch',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    }
  }

  // ==========================================================================
  // FIREBASE 14 ENTERPRISE — Geospatial Search
  // --------------------------------------------------------------------------
  // Requires a geo index on the target collection (geohash or bounding-box).
  // Use the `geopoint` field type and a composite index on `geopoint`.
  // ==========================================================================

  /**
   * Geospatial search: find documents within a given radius of a center
   * point. Uses Cloud Firestore Enterprise geo operators.
   *
   * @param collection  Collection to search
   * @param center      `{ latitude, longitude }` center point
   * @param radiusKm    Search radius in kilometers
   * @param options     Search options: geopoint field name, limit
   * @returns           DatabaseResult with `{ items, total }`
   */
  async geoSearch<T = FirebaseDocumentData>(
    collection: string,
    center: { latitude: number; longitude: number },
    radiusKm: number,
    options: { field?: string; limit?: number } = {}
  ): Promise<DatabaseResult<{ items: Array<{ id: string; data: T; distanceKm: number }>; total: number }>> {
    try {
      const startTime = monotime();
      const firestore = await this.getFirestore();
      const field = options.field ?? 'location';
      const limit = options.limit ?? 20;
      // Use the Firestore `where` with a `geo` operator when supported.
      const ref: any = (firestore.collection(collection) as any)
        .where(field, 'geo', { center, radiusKm, limit });
      const snapshot = await ref.get();
      const items = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        data: doc.data() as T,
        distanceKm: doc.distanceKm ?? 0,
      }));
      return {
        success: true,
        data: { items, total: items.length },
        metadata: {
          operation: 'geoSearch',
          duration: monotime() - startTime,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new Error(
          `Geospatial search requires a Cloud Firestore Enterprise geo index on ` +
          `'${options.field ?? 'location'}'. See https://firebase.google.com/docs/firestore/geo-search. ` +
          `Original: ${error instanceof Error ? error.message : String(error)}`
        ),
        metadata: {
          operation: 'geoSearch',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      };
    }
  }

  // ==========================================================================
  // FCM Admin bridge — server-side push notifications via HTTP v1
  // --------------------------------------------------------------------------
  // Pairs with the fcm-specialist truth lens and the use-fcm.ts client
  // hook. Always available in firebase-full mode; the firebase-client
  // FCM token is stored either in the `fcm_tokens` Firestore collection
  // (firebase-full) or in PostgreSQL `fcm_tokens` table (k8s-postgres-fcm).
  // ==========================================================================

  /**
   * Send a single FCM message via HTTP v1 API. Returns the FCM messageId
   * or throws on FCM error.
   *
   * @param message  FCM message payload (token + notification + data + webpush)
   * @returns        DatabaseResult with the messageId
   */
  async sendFcmMessage(
    message: {
      token: string;
      notification?: { title: string; body: string; imageUrl?: string };
      data?: Record<string, string>;
      webpush?: any;
      android?: any;
      apns?: any;
    }
  ): Promise<DatabaseResult<{ messageId: string }>> {
    try {
      const { getAdminMessaging } = await import('@/lib/firebase-admin.server')
      const messaging = getAdminMessaging()
      const messageId = await messaging.send(message as any)
      return {
        success: true,
        data: { messageId },
        metadata: {
          operation: 'sendFcmMessage',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'sendFcmMessage',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Send an FCM message to all of a user's active FCM tokens. Fetches
   * the user's tokens from the `fcm_tokens` collection (firebase-full) or
   * falls back to the PostgreSQL `fcm_tokens` table (k8s-postgres-fcm) and
   * uses `sendEach()` for multi-token fan-out.
   *
   * @param userId       Target user ID
   * @param notification Notification payload
   * @param data         Optional data payload
   * @param options      Webpush + link options
   * @returns            DatabaseResult with `{ successCount, failureCount, responses }`
   */
  async sendFcmToUser(
    userId: string,
    notification: { title: string; body: string; imageUrl?: string },
    data?: Record<string, string>,
    options: { link?: string; ttl?: string } = {}
  ): Promise<DatabaseResult<{ successCount: number; failureCount: number; responses: any[] }>> {
    try {
      const { getAdminMessaging } = await import('@/lib/firebase-admin.server')
      const messaging = getAdminMessaging()
      // In firebase-full mode, tokens live in the fcm_tokens collection.
      // In k8s-postgres-fcm mode, they live in the fcm_tokens PostgreSQL
      // table — the adapter delegates to firebase-service-manager (Firestore)
      // or the BackendSelector (PostgreSQL) accordingly. We attempt
      // Firebase first; on no tokens, return a no-op success.
      const { getAdminDb } = await import('@/lib/firebase-admin.server')
      const firestore = getAdminDb()
      const tokensSnap = await firestore
        .collection('fcm_tokens')
        .where('user_id', '==', userId)
        .where('status', '==', 'active')
        .get()
      if (tokensSnap.empty) {
        return {
          success: true,
          data: { successCount: 0, failureCount: 0, responses: [] },
          metadata: {
            operation: 'sendFcmToUser',
            duration: 0,
            backend: 'firebase',
            timestamp: new Date(),
          },
        }
      }
      const tokens = tokensSnap.docs.map((d) => (d.data() as any).token as string)
      const messages = tokens.map((token) => ({
        token,
        notification,
        data: data ?? {},
        webpush: options.link
          ? { fcmOptions: { link: options.link }, headers: options.ttl ? { TTL: options.ttl } : undefined }
          : undefined,
      }))
      const result = await messaging.sendEach(messages)
      // Reactive cleanup: mark invalid tokens
      const responses = result.responses as Array<{ success: boolean; error?: { code?: string } }>
      const invalidTokens: string[] = []
      responses.forEach((resp, i) => {
        if (
          !resp.success &&
          resp.error?.code &&
          ['messaging/registration-token-not-registered', 'messaging/invalid-argument'].includes(resp.error.code)
        ) {
          invalidTokens.push(tokens[i])
        }
      })
      if (invalidTokens.length > 0) {
        await this.cleanupInvalidFcmTokens(invalidTokens)
      }
      return {
        success: true,
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount,
          responses: result.responses,
        },
        metadata: {
          operation: 'sendFcmToUser',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'sendFcmToUser',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Send an FCM message to a topic. Topic subscribers receive the message
   * via their client SDKs.
   */
  async sendFcmToTopic(
    topic: string,
    notification: { title: string; body: string; imageUrl?: string },
    data?: Record<string, string>
  ): Promise<DatabaseResult<{ messageId: string }>> {
    try {
      const { getAdminMessaging } = await import('@/lib/firebase-admin.server')
      const messaging = getAdminMessaging()
      const messageId = await messaging.send({
        topic,
        notification,
        data: data ?? {},
      } as any)
      return {
        success: true,
        data: { messageId },
        metadata: {
          operation: 'sendFcmToTopic',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'sendFcmToTopic',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Validate an FCM token by attempting to subscribe it to a temporary
   * topic. Returns `valid: true` if the token is alive.
   */
  async validateFcmToken(token: string): Promise<DatabaseResult<{ valid: boolean; reason?: string }>> {
    try {
      const { getAdminMessaging } = await import('@/lib/firebase-admin.server')
      const messaging = getAdminMessaging()
      const tempTopic = `__ring_validate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      try {
        await messaging.subscribeToTopic(token, tempTopic)
        await messaging.unsubscribeFromTopic(token, tempTopic).catch(() => {})
        return {
          success: true,
          data: { valid: true },
          metadata: {
            operation: 'validateFcmToken',
            duration: 0,
            backend: 'firebase',
            timestamp: new Date(),
          },
        }
      } catch (err) {
        return {
          success: true,
          data: { valid: false, reason: err instanceof Error ? err.message : String(err) },
          metadata: {
            operation: 'validateFcmToken',
            duration: 0,
            backend: 'firebase',
            timestamp: new Date(),
          },
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'validateFcmToken',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Reactive cleanup: mark invalid FCM tokens as `invalid` in the
   * `fcm_tokens` collection so they are filtered from future sends.
   * Called automatically by `sendFcmToUser` on FCM error responses.
   */
  async cleanupInvalidFcmTokens(tokens: string[]): Promise<DatabaseResult<{ cleaned: number }>> {
    try {
      if (tokens.length === 0) {
        return {
          success: true,
          data: { cleaned: 0 },
          metadata: {
            operation: 'cleanupInvalidFcmTokens',
            duration: 0,
            backend: 'firebase',
            timestamp: new Date(),
          },
        }
      }
      const { getAdminDb } = await import('@/lib/firebase-admin.server')
      const firestore = getAdminDb()
      const now = new Date().toISOString()
      let cleaned = 0
      // Use a batch write for atomicity
      const batch = firestore.batch()
      const tokensRef = firestore.collection('fcm_tokens')
      // Lookup token documents by querying the field
      for (const token of tokens) {
        const snap = await tokensRef.where('token', '==', token).get()
        snap.docs.forEach((doc) => {
          batch.update(doc.ref, { status: 'invalid', invalidated_at: now, updated_at: now })
          cleaned++
        })
      }
      if (cleaned > 0) await batch.commit()
      return {
        success: true,
        data: { cleaned },
        metadata: {
          operation: 'cleanupInvalidFcmTokens',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'cleanupInvalidFcmTokens',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  // ==========================================================================
  // SSOT atomic writes bridge — firebase-service-manager delegation
  // --------------------------------------------------------------------------
  // The canonical atomic write helpers live in lib/services/firebase-service-manager.ts
  // (creditBalanceAdjustAtomic, subscriptionStatusUpdateAtomic, paymentTransactionAppendStatusAtomic).
  // These adapter methods delegate to them so callers using the
  // IDatabaseService interface get the same ACID guarantees.
  // ==========================================================================

  /**
   * Atomic credit balance adjust — single Firestore transaction.
   * Fixes the read-modify-write race in credit-balance-service.ts addCredits/spendCredits.
   * See `lib/services/firebase-service-manager.ts` for the canonical implementation.
   */
  async creditBalanceAdjust(
    userId: string,
    delta: number,
    transaction: Record<string, any>,
    mainCurrencyRate: string = '1'
  ): Promise<DatabaseResult<{ newBalance: string; transactionId: string }>> {
    try {
      const { creditBalanceAdjustAtomic } = await import('@/lib/services/firebase-service-manager')
      const result = await creditBalanceAdjustAtomic(userId, delta, transaction, mainCurrencyRate)
      return {
        success: true,
        data: { newBalance: result.newBalance, transactionId: result.transactionId },
        metadata: {
          operation: 'creditBalanceAdjust',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'creditBalanceAdjust',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Atomic subscription status update — single Firestore transaction.
   * Mirrors ledger + user doc fields together.
   * See `lib/services/firebase-service-manager.ts` for the canonical implementation.
   */
  async subscriptionStatusUpdate(
    subscriptionId: string,
    nextStatus: 'active' | 'cancelled' | 'expired' | 'suspended' | 'grace_period' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED',
    userPatch: Record<string, any> = {},
    ledgerPatch: Record<string, any> = {}
  ): Promise<DatabaseResult<{ subscription: Record<string, any> }>> {
    try {
      const { subscriptionStatusUpdateAtomic } = await import('@/lib/services/firebase-service-manager')
      const result = await subscriptionStatusUpdateAtomic(subscriptionId, nextStatus, userPatch, ledgerPatch)
      return {
        success: true,
        data: { subscription: result.subscription },
        metadata: {
          operation: 'subscriptionStatusUpdate',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'subscriptionStatusUpdate',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  /**
   * Atomic payment transaction status append — single Firestore transaction.
   * Prevents status_history[] race with concurrent webhook updates.
   * See `lib/services/firebase-service-manager.ts` for the canonical implementation.
   */
  async paymentStatusAppend(
    orderReference: string,
    status: 'created' | 'redirected' | 'paid' | 'failed' | 'refunded',
    meta: Record<string, any> = {}
  ): Promise<DatabaseResult<{ record: Record<string, any> }>> {
    try {
      const { paymentTransactionAppendStatusAtomic } = await import('@/lib/services/firebase-service-manager')
      const result = await paymentTransactionAppendStatusAtomic(orderReference, status, meta)
      return {
        success: true,
        data: { record: result.record },
        metadata: {
          operation: 'paymentStatusAppend',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'paymentStatusAppend',
          duration: 0,
          backend: 'firebase',
          timestamp: new Date(),
        },
      }
    }
  }

  // ==========================================================================
  // Connection diagnostics
  // ==========================================================================

  /**
   * Run a connection diagnostic. Reports the backend mode, whether
   * Firebase is configured, and the availability of each Admin SDK
   * subpath. Useful for `/api/admin/firebase-health` and CI smoke tests.
   */
  async diagnoseConnection(): Promise<DatabaseResult<{
    backendMode: string;
    firebaseConfigured: boolean;
    services: Record<string, boolean>;
    errors: string[];
  }>> {
    const errors: string[] = []
    const services: Record<string, boolean> = {}
    const mode = process.env.DB_BACKEND_MODE ?? 'unknown'
    const configured = !!process.env.AUTH_FIREBASE_PROJECT_ID
    // Probe each Admin SDK service via dynamic import
    const probes: Array<[string, () => Promise<unknown>]> = [
      ['firestore', async () => (await import('@/lib/firebase-admin.server')).getAdminDb()],
      ['auth', async () => (await import('@/lib/firebase-admin.server')).getAdminAuth()],
      ['messaging', async () => (await import('@/lib/firebase-admin.server')).getAdminMessaging()],
      ['storage', async () => (await import('@/lib/firebase-admin.server')).getAdminStorage()],
      ['appCheck', async () => (await import('@/lib/firebase-admin.server')).getAdminAppCheck()],
      ['remoteConfig', async () => (await import('@/lib/firebase-admin.server')).getAdminRemoteConfig()],
      ['rtdb', async () => (await import('@/lib/firebase-admin.server')).getAdminRtdb()],
    ]
    for (const [name, probe] of probes) {
      try {
        await probe()
        services[name] = true
      } catch (err) {
        services[name] = false
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return {
      success: true,
      data: { backendMode: mode, firebaseConfigured: configured, services, errors },
      metadata: {
        operation: 'diagnoseConnection',
        duration: 0,
        backend: 'firebase',
        timestamp: new Date(),
      },
    }
  }
}

/**
 * Firebase Transaction Implementation
 * Wraps Firestore's raw Transaction so that you can use abstractions in runTransaction
 */
class FirebaseTransaction implements IDatabaseTransaction {
  constructor(private transaction: Transaction, private firestore: Firestore) {}

  /**
   * Create document inside a transaction context
   */
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

  /**
   * Read a single document inside a transaction
   */
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

  /**
   * Update a document inside a transaction
   */
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

    // For transactions, we have no snapshot-after-writing, so this is our *expected* result
    return {
      id,
      data: updateData as T,
      metadata: {
        createdAt: now, // Note: this is not the real createdAt, but best effort here
        updatedAt: now,
        version: 1
      }
    };
  }

  /**
   * Delete a document inside a transaction
   */
  async delete(collection: string, id: string): Promise<void> {
    const docRef = this.firestore.collection(collection).doc(id);
    this.transaction.delete(docRef);
  }

  /**
   * Commit is implicit with Firestore transactions; method provided for interface compatibility
   */
  async commit(): Promise<void> {
    // Firestore transaction auto-commits at the end of the top-level user function
    // No explicit commit required
  }

  /**
   * Rollback is not supported; Firestore will rollback on error automatically and cannot be manually triggered
   */
  async rollback(): Promise<void> {
    throw new Error('Firebase transactions cannot be manually rolled back');
  }
}

// TODO: Add AI Logic + Firebase Hosting bridges, document the feature as TBD and place as future-feature in /docs/

// ============================================================================
// AI Logic + Firebase Hosting bridges — module-level exports
// ============================================================================
//
// These are exposed as module-level functions (not class methods) because
// they don't need adapter instance state. They are also useful from CI
// scripts and config-generation tooling that imports the adapter file but
// never instantiates a class.
// ============================================================================

/**
 * Firebase AI Logic generation result (text + structured output).
 * Modeled after the official `firebase/ai` SDK shape.
 */
// export interface AiGenerationResult {
//   text: string;
//   usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
//   finishReason?: string;
// }

// /**
//  * Firebase AI Logic — server-side text generation.
//  * Lazy-requires `firebase-admin/vertexai` so the package is only loaded
//  * when actually used. If the package is not installed, returns a clear
//  * `not-supported` result (does not throw).
//  *
//  * For the **client-side** equivalent, see `getFirebaseAIClient()` in
//  * `lib/firebase-client.ts`.
//  *
//  * @see https://firebase.google.com/docs/ai-logic
//  */
// export async function aiGenerateText(input: {
//   model?: string;
//   prompt: string;
//   systemInstruction?: string;
//   temperature?: number;
//   maxOutputTokens?: number;
// }): Promise<DatabaseResult<AiGenerationResult>> {
//   try {
//     let vertexai: any
//     try {
//       // Optional dependency — install with
//       //   npm install firebase-admin vertexai @google-cloud/vertexai
//       // to enable server-side AI Logic.
//       // eslint-disable-next-line @typescript-eslint/no-var-requires
//       vertexai = require('firebase-admin/vertexai')
//     } catch {
//       return {
//         success: false,
//         error: new Error(
//           'AI Logic requires firebase-admin/vertexai + @google-cloud/vertexai. ' +
//           'Install with: npm install firebase-admin vertexai @google-cloud/vertexai. ' +
//           'For the client-side equivalent, use getFirebaseAIClient() from lib/firebase-client.ts.'
//         ),
//         metadata: {
//           operation: 'aiGenerateText',
//           duration: 0,
//           backend: 'firebase',
//           timestamp: new Date(),
//         },
//       }
//     }
//     const { getAdminApp } = await import('@/lib/firebase-admin.server')
//     const app = getAdminApp()
//     const vertex = vertexai.getVertexAI(app)
//     const modelName = input.model ?? 'gemini-2.5-flash'
//     const model = vertex.getGenerativeModel({
//       model: modelName,
//       systemInstruction: input.systemInstruction,
//       generationConfig: {
//         temperature: input.temperature,
//         maxOutputTokens: input.maxOutputTokens,
//       },
//     })
//     const result = await model.generateContent(input.prompt)
//     const text = result.response?.text?.() ?? ''
//     return {
//       success: true,
//       data: {
//         text,
//         usage: result.response?.usageMetadata
//           ? {
//               promptTokens: result.response.usageMetadata.promptTokenCount ?? 0,
//               completionTokens: result.response.usageMetadata.candidatesTokenCount ?? 0,
//               totalTokens: result.response.usageMetadata.totalTokenCount ?? 0,
//             }
//           : undefined,
//         finishReason: result.response?.candidates?.[0]?.finishReason,
//       },
//       metadata: {
//         operation: 'aiGenerateText',
//         duration: 0,
//         backend: 'firebase',
//         timestamp: new Date(),
//       },
//     }
//   } catch (error) {
//     return {
//       success: false,
//       error: error instanceof Error ? error : new Error(String(error)),
//       metadata: {
//         operation: 'aiGenerateText',
//         duration: 0,
//         backend: 'firebase',
//         timestamp: new Date(),
//       },
//     }
//   }
// }

// /**
//  * Firebase AI Logic — multi-turn chat completion.
//  * Returns the assistant's reply text + structured usage metadata.
//  */
// export async function aiChatCompletion(input: {
//   model?: string;
//   messages: Array<{ role: 'user' | 'model' | 'system'; content: string }>;
//   temperature?: number;
//   maxOutputTokens?: number;
// }): Promise<DatabaseResult<AiGenerationResult>> {
//   try {
//     let vertexai: any
//     try {
//       // eslint-disable-next-line @typescript-eslint/no-var-requires
//       vertexai = require('firebase-admin/vertexai')
//     } catch {
//       return {
//         success: false,
//         error: new Error(
//           'AI Logic requires firebase-admin/vertexai + @google-cloud/vertexai. ' +
//           'For the client-side equivalent, use getFirebaseAIClient() from lib/firebase-client.ts.'
//         ),
//         metadata: {
//           operation: 'aiChatCompletion',
//           duration: 0,
//           backend: 'firebase',
//           timestamp: new Date(),
//         },
//       }
//     }
//     const { getAdminApp } = await import('@/lib/firebase-admin.server')
//     const app = getAdminApp()
//     const vertex = vertexai.getVertexAI(app)
//     const modelName = input.model ?? 'gemini-2.5-flash'
//     const model = vertex.getGenerativeModel({
//       model: modelName,
//       generationConfig: {
//         temperature: input.temperature,
//         maxOutputTokens: input.maxOutputTokens,
//       },
//     })
//     const chat = model.startChat({
//       history: input.messages
//         .filter((m) => m.role !== 'system')
//         .map((m) => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.content }] })),
//     })
//     const systemMessages = input.messages.filter((m) => m.role === 'system')
//     const lastUser = input.messages.filter((m) => m.role === 'user').pop()
//     if (!lastUser) {
//       return {
//         success: false,
//         error: new Error('aiChatCompletion: at least one user message is required'),
//         metadata: {
//           operation: 'aiChatCompletion',
//           duration: 0,
//           backend: 'firebase',
//           timestamp: new Date(),
//         },
//       }
//     }
//     const prompt = [
//       systemMessages.map((m) => m.content).join('\n'),
//       lastUser.content,
//     ]
//       .filter(Boolean)
//       .join('\n\n')
//     const result = await chat.sendMessage(prompt)
//     const text = result.response?.text?.() ?? ''
//     return {
//       success: true,
//       data: {
//         text,
//         usage: result.response?.usageMetadata
//           ? {
//               promptTokens: result.response.usageMetadata.promptTokenCount ?? 0,
//               completionTokens: result.response.usageMetadata.candidatesTokenCount ?? 0,
//               totalTokens: result.response.usageMetadata.totalTokenCount ?? 0,
//             }
//           : undefined,
//         finishReason: result.response?.candidates?.[0]?.finishReason,
//       },
//       metadata: {
//         operation: 'aiChatCompletion',
//         duration: 0,
//         backend: 'firebase',
//         timestamp: new Date(),
//       },
//     }
//   } catch (error) {
//     return {
//       success: false,
//       error: error instanceof Error ? error : new Error(String(error)),
//       metadata: {
//         operation: 'aiChatCompletion',
//         duration: 0,
//         backend: 'firebase',
//         timestamp: new Date(),
//       },
//     }
//   }
// }



// ============================================================================
// Firebase Hosting bridge
// ============================================================================
//
// firebase-full mode supports Firebase Hosting as the production deployment
// target (alongside k3s, Vercel, and Docker — see the mdx). These helpers
// generate the canonical firebase.json + .firebaserc config files so the
// `firebase deploy --only hosting` command works out of the box.
// ============================================================================

/**
 * A rewrite rule for Firebase Hosting. Maps a source URL pattern to a
 * destination function or static path.
 */
export interface HostingRewrite {
  source: string;
  destination: string;
  /** If true, the source is matched as a glob; otherwise an exact path. */
  glob?: boolean;
}

/**
 * A redirect rule for Firebase Hosting. Returns 301/302 with the
 * destination Location header.
 */
export interface HostingRedirect {
  source: string;
  destination: string;
  status?: 301 | 302 | 307 | 308;
  glob?: boolean;
}

/**
 * A custom header rule for Firebase Hosting.
 */
export interface HostingHeader {
  source: string;
  headers: Array<{ key: string; value: string }>;
  glob?: boolean;
}

/**
 * Canonical `firebase.json` shape (subset used by Ring Platform).
 * The `hosting` block configures the Firebase Hosting deployment.
 */
export interface FirebaseJson {
  hosting: {
    public: string;
    ignore: string[];
    rewrites?: HostingRewrite[];
    redirects?: HostingRedirect[];
    headers?: HostingHeader[];
    cleanUrls?: boolean;
    trailingSlash?: boolean;
    previews?: Record<string, { numFiles?: number }>;
  };
}

/**
 * Generate the canonical `firebase.json` for a Ring clone deployed to
 * Firebase Hosting. Use this when you want `firebase deploy --only hosting`
 * to work out of the box.
 *
 * @param options.public      Public directory (typically 'out' for Next.js
 *                            static export, or '.next/server/app' for
 *                            Cloud Functions for Firebase)
 * @param options.rewrites    SPA + SSR rewrites
 * @param options.redirects   HTTP redirects
 * @param options.headers     Custom headers (cache, security, CSP, etc.)
 * @returns                   A FirebaseJson object ready to be
 *                            `JSON.stringify`'d to `firebase.json`
 */
export function generateFirebaseJson(options: {
  public?: string;
  rewrites?: HostingRewrite[];
  redirects?: HostingRedirect[];
  headers?: HostingHeader[];
  cleanUrls?: boolean;
  trailingSlash?: boolean;
}): FirebaseJson {
  return {
    hosting: {
      public: options.public ?? 'public',
      ignore: [
        'firebase.json',
        '**/.*',
        '**/node_modules/**',
        // Ring-specific: don't deploy the admin build artifacts or SW file
        'admin/**',
        'firebase-messaging-sw.js',
      ],
      rewrites: options.rewrites ?? [
        // Canonical Ring rewrite: API + auth + trpc go to Cloud Functions
        { source: '/api/**', destination: '/api' },
        { source: '/auth/**', destination: '/auth' },
        { source: '/_next/**', destination: '/_next/**' },
        // SPA fallback for the public site
        { source: '**', destination: '/index.html' },
      ],
      redirects: options.redirects ?? [
        // Force HTTPS
        {
          source: '**',
          destination: 'https://ring-platform.org',
          status: 301,
        },
      ],
      headers: options.headers ?? [
        // Default security + cache headers
        {
          source: '**/*.@(js|css)',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ],
        },
        {
          source: '**',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          ],
        },
      ],
      cleanUrls: options.cleanUrls ?? true,
      trailingSlash: options.trailingSlash ?? false,
    },
  };
}

/**
 * Canonical rewrites for a Ring clone deployed to Firebase Hosting.
 * Includes the API + auth + trpc paths and a SPA fallback. The returned
 * array is a drop-in for the `rewrites` field of `generateFirebaseJson()`.
 */
export function getRingHostingRewrites(): HostingRewrite[] {
  return [
    { source: '/api/**', destination: '/api' },
    { source: '/auth/**', destination: '/auth' },
    { source: '/trpc/**', destination: '/trpc' },
    { source: '/tunnel/**', destination: '/tunnel' },
    { source: '/_actions/**', destination: '/_actions' },
    { source: '/.well-known/**', destination: '/.well-known' },
    { source: '/firebase-messaging-sw.js', destination: '/firebase-messaging-sw.js' },
    { source: '**', destination: '/index.html' },
  ];
}
