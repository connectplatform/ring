/**
 * Main Database Service
 *
 * Unified entry point for all database operations in Ring Platform.
 * Provides high-level abstraction over backend selector with configuration management.
 *
 * // TODO: (React 19/Next.js 16) Consider using React Server Actions or Next.js cache for async data/state 
 * sharing in Next.js 16+ apps instead of global fordb instance.
 */

// Core utility imports
import { monotime } from './timer'
import { isBuildTime, shouldSkipDatabaseConnect } from '@/lib/build-cache/phase-detector'
// All types/interfaces for DB contract
import {
  IDatabaseService,
  DatabaseResult,
  DatabaseFilter,
  DatabaseOrderBy,
  DatabasePagination,
  DatabaseQuery,
  DatabaseDocument,
  IDatabaseTransaction,
  DatabaseBackendConfig,
  DatabaseSyncConfig
} from './interfaces/IDatabaseService';
import { BackendSelector, BackendRoute } from './BackendSelector';
import { unwrapDbQueryRow } from './document';

/** Flat domain row representation with guaranteed document id. */
export type DbRow<T> = T & { id: string };

/**
 * Top level DB service configuration object
 *
 * Known missing options:
 *   - logging level
 *   - healthcheck interval
 *   - backup/restore config
 *   - per-backend custom options (not just "options")
 */
export interface DatabaseConfig {
  backends: DatabaseBackendConfig[];
  sync: DatabaseSyncConfig;
  routes?: BackendRoute[];
  defaultBackend?: string;
  enableMetrics?: boolean;
  enableTracing?: boolean;
}

/**
 * Entity Cache for read-after-write consistency (used only for 'entities' collection).
 *   Caches most-recent value for entity reads after entity writes for 30s.
 */
class EntityCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 30000; // 30 seconds

  set(key: string, data: any) {
    // Cache value with timestamp for TTL expiry check
    this.cache.set(key, { data, timestamp: monotime() });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (entry && (monotime() - entry.timestamp) < this.TTL) {
      // If still in TTL, return cached value
      return entry.data;
    }
    // Otherwise, evict
    this.cache.delete(key);
    return null;
  }

  invalidate(key: string) {
    // Remove cache entry
    this.cache.delete(key);
  }

  clear() {
    // Clear all cache entries
    this.cache.clear();
  }

  size() {
    // Current number of entries in cache
    return this.cache.size;
  }
}

/**
 * Main Database Service Class
 * High-level unified interface for all DB operations (CRUD, query, migration, etc.).
 */
export class DatabaseService {
  private selector: BackendSelector; // chooses backend for operations, also runs commands
  private config: DatabaseConfig;
  private connected: boolean = false;
  private static initialized: boolean = false;
  private entityCache = new EntityCache();

  /**
   * Returns whether the global DatabaseService was ever initialized during this process/session.
   */
  public static isInitialized(): boolean {
    return DatabaseService.initialized;
  }
  /**
   * Mark as initialized (or not).
   */
  public static setInitialized(initialized: boolean): void {
    DatabaseService.initialized = initialized;
  }

  /**
   * Construct service with provided configuration (or from global if not provided).
   */
  constructor(config: DatabaseConfig) {
    this.config = config;
    this.selector = new BackendSelector(
      config.backends,
      config.sync,
      config.routes
    );
  }

  /**
   * Initialize database connections. Safe for multiple calls.
   * Skips if shouldSkipDatabaseConnect() is true (e.g., build time).
   */
  async initialize(): Promise<DatabaseResult<void>> {
    if (shouldSkipDatabaseConnect()) {
      // During build time or test, pretend success with zero-duration
      return {
        success: true,
        data: undefined,
        metadata: {
          operation: 'initialize',
          duration: 0,
          backend: 'build-skip',
          timestamp: new Date(0),
        },
      }
    }
    if (this.connected) {
      // Already connected, short-circuit success
      return {
        success: true,
        data: undefined,
        metadata: {
          operation: 'initialize',
          duration: 0,
          backend: 'service',
          timestamp: new Date(),
        },
      }
    }
    try {
      // Connect via selector (which in turn connects to all backends)
      const result = await this.selector.connect();
      if (result.success) {
        this.connected = true;
      }
      return result;
    } catch (error) {
      // On error, return metadata so callers can show diagnostics
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'initialize',
          duration: 0,
          backend: 'service',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Shutdown all backend database connections.
   * No-op safe if never initialized.
   */
  async shutdown(): Promise<DatabaseResult<void>> {
    try {
      const result = await this.selector.disconnect();
      if (result.success) {
        this.connected = false;
      }
      this.selector.destroy(); // Force cleanup/release
      return result;
    } catch (error) {
      // On error shutting down
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'shutdown',
          duration: 0,
          backend: 'service',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Health check for all configured backends.
   * Returns whether all backends are healthy, and their statuses (BackendSelector).
   */
  async healthCheck(): Promise<DatabaseResult<boolean>> {
    if (!this.connected) {
      return {
        success: false,
        error: new Error('Database service not initialized'),
        metadata: {
          operation: 'healthCheck',
          duration: 0,
          backend: 'service',
          timestamp: new Date()
        }
      };
    }

    // Relay selector's multi-backend health
    return await this.selector.healthCheck();
  }

  /**
   * Get backend health status as reported by current selector.
   */
  getBackendHealth() {
    return this.selector.getHealthStatus();
  }

  /**
   * Get routing table, indicating which collections go to which backends.
   */
  getRoutes() {
    return this.selector.getRoutes();
  }

  /**
   * Update backend routing for a specific collection at runtime.
   */
  updateRoute(collection: string, route: Partial<BackendRoute>) {
    this.selector.updateRoute(collection, route);
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new document in collection.
   * If writing 'entities', caches value for future `read` for ~30s.
   */
  async create<T = any>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    if (!this.connected) {
      // Not yet initialized, error
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'create', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const result = await this.selector.create(collection, data, options);

    // Cache newly created entities to prevent read-after-write consistency issues (see get)
    if (collection === 'entities' && result.success && result.data) {
      this.entityCache.set(result.data.id, result.data);
    }

    return result;
  }

  /**
   * Read a document by ID from given collection.
   * Uses cache for 'entities' for ~30s window after writes to workaround eventual consistency.
   */
  async read<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'read', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    // Use cache for entities only
    if (collection === 'entities') {
      const cached = this.entityCache.get(id);
      if (cached) {
        // Already available, skip backend call
        return {
          success: true,
          data: cached,
          error: null
        };
      }
    }

    // Otherwise, fetch from backend
    return await this.selector.read<T>(collection, id);
  }

  /**
   * Read all documents from a collection (limited!).
   * @param options.limit - Max rows (default 1000)
   * @param options.offset - Offset (default 0)
   * @param options.orderBy - Order by one (default none)
   */
  async readAll<T = any>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'readAll', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    // TODO: Use 'find' instead with empty filters for more uniformity
    const query: DatabaseQuery = {
      collection,
      pagination: {
        limit: options.limit || 1000,
        offset: options.offset || 0
      }
    };

    if (options.orderBy) {
      query.orderBy = [options.orderBy];
    }

    return await this.selector.query<T>(query);
  }

  /**
   * Find documents by one field.
   * Missing: Operator (assumes '==')
   */
  async findByField<T = any>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'findByField', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    // TODO: Accept operator option (currently only == supported)
    const query: DatabaseQuery = {
      collection,
      filters: [{
        field,
        operator: '==',
        value
      }],
      pagination: {
        limit: options.limit || 100
      }
    };

    if (options.orderBy) {
      query.orderBy = [options.orderBy];
    }

    return await this.selector.query<T>(query);
  }

  /**
   * Check whether an ID exists for a collection.
   */
  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'exists', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    try {
      // Query the selector for that id
      const result = await this.selector.read(collection, id);
      return {
        success: true,
        data: result.success && result.data !== null,
        metadata: {
          operation: 'exists',
          duration: 0,
          backend: this.getCurrentBackend(),
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
          backend: this.getCurrentBackend(),
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update part (or all) of a document.
   * If 'entities' cache exists, invalidates cache for id after update.
   */
  async update<T = any>(
    collection: string,
    id: string,
    data: Partial<T>,
    options: { merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'update', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const result = await this.selector.update(collection, id, data, options);

    // Invalidate entity cache after update so next read fetches fresh value
    if (collection === 'entities') {
      this.entityCache.invalidate(id);
    }

    return result;
  }

  /**
   * Delete a document by ID.
   * Invalidates for entity cache if in 'entities'.
   */
  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'delete', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const result = await this.selector.delete(collection, id);

    if (collection === 'entities') {
      this.entityCache.invalidate(id);
    }

    return result;
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Query documents (with filters, orderBy, pagination, etc.)
   */
  async query<T = any>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (shouldSkipDatabaseConnect()) {
      // During build/test, simulate empty query
      return {
        success: true,
        data: [],
        metadata: {
          operation: 'query',
          duration: 0,
          backend: 'build-skip',
          timestamp: new Date(0),
        },
      }
    }
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'query', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.query(querySpec);
  }

  /**
   * Count number of documents for given filters (fast if supported).
   */
  async count(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<number>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'count', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.count(collection, filters);
  }

  /**
   * Find documents for a collection matching arbitrary filters.
   * @param options can include orderBy, limit, offset
   */
  async find<T = any>(
    collection: string,
    filters: DatabaseFilter[] = [],
    options: {
      orderBy?: DatabaseOrderBy[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const querySpec: DatabaseQuery = {
      collection,
      filters,
      orderBy: options.orderBy,
      pagination: {
        limit: options.limit,
        offset: options.offset
      }
    };

    return await this.query<T>(querySpec);
  }

  /**
   * Find first document matching filter (or null if none).
   */
  async findOne<T = any>(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    const result = await this.find<T>(collection, filters, { limit: 1 });

    if (!result.success) {
      return result as unknown as DatabaseResult<DatabaseDocument<T> | null>;
    }

    return {
      success: true,
      data: (result.data && result.data.length > 0) ? result.data[0] : null,
      metadata: result.metadata
    };
  }

  /**
   * Find document by ID (identical to read).
   */
  async findById<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    return await this.read<T>(collection, id);
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Create multiple documents at once (batch).
   * @returns Array of new documents.
   */
  async batchCreate<T = any>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'batchCreate', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.batchCreate(collection, documents);
  }

  /**
   * Update multiple documents in a batch.
   */
  async batchUpdate<T = any>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'batchUpdate', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.batchUpdate(collection, updates);
  }

  /**
   * Delete many documents by their IDs.
   */
  async batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'batchDelete', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.batchDelete(collection, ids);
  }

  // ============================================================================
  // TRANSACTION OPERATIONS
  // ============================================================================

  /**
   * Run provided operations in a database transaction.
   * Throws if operation or transaction fails.
   */
  async transaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'transaction', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    const result = await this.selector.runTransaction(operation);
    // Transactions THROW on failure (unlike CRUD result contract): never swallow errors.
    if (!result.success) {
      throw result.error || new Error('Transaction failed');
    }
    return result;
  }

  // ============================================================================
  // REAL-TIME OPERATIONS
  // ============================================================================

  /**
   * Subscribe to real-time changes for a set of filters on a collection.
   * @returns { unsubscribe: () => void } for clean up
   */
  async subscribe<T = any>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'subscribe', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    // NOTE: not all backends support realtime, may error or no-op
    return await this.selector.subscribe(collection, filters, callback);
  }

  // ============================================================================
  // SCHEMA OPERATIONS
  // ============================================================================

  /**
   * Create a new collection / table with optional schema.
   * @param schema - backend-dependent object
   */
  async createCollection(
    collection: string,
    schema?: any
  ): Promise<DatabaseResult<void>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'createCollection', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    // TODO: Validate schema param (missing types!)
    return await this.selector.createCollection(collection, schema);
  }

  // ============================================================================
  // MIGRATION OPERATIONS
  // ============================================================================

  /**
   * Migrate data from one collection/backend to another.
   * Optionally provide a transform (eg. for schema upgrades).
   */
  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'migrateData', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    // Note: Errors per document are collected in result.errors
    return await this.selector.migrateData(fromCollection, toCollection, transform);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current DB connection/service statistics for diagnostics and observability.
   */
  getStats() {
    return {
      connected: this.connected,
      config: this.config,
      backendHealth: this.selector.getHealthStatus(),
      routes: this.selector.getRoutes()
    };
  }

  /**
   * Return true if currently connected/initialized.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get backend type string (for debugging, e.g. 'postgresql', 'firebase').
   */
  getCurrentBackend(): string {
    return this.selector.getBackendType();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a database service with default configuration.
 * Supports partial overrides (used for unit-test, stubbing).
 * // TODO: Add missing support for more DBs (sqlite, memory, mongo, etc.)
 */
export function createDatabaseService(config?: Partial<DatabaseConfig>): DatabaseService {
  // Build default config, mostly using env vars (falling back to hardcoded values)
  const defaultConfig: DatabaseConfig = {
    backends: [
      {
        type: 'postgresql',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'ring_platform',
          username: process.env.DB_USER || 'ring_user',
          password: process.env.DB_PASSWORD || 'ring_dev_password'
        },
        options: {
          poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
          timeout: parseInt(process.env.DB_TIMEOUT || '30000'),
          retries: parseInt(process.env.DB_RETRIES || '3'),
          ssl: process.env.DB_SSL === 'true'
        }
      }
    ],
    sync: {
      enabled: process.env.DB_SYNC_ENABLED === 'true',
      backends: (process.env.DB_SYNC_BACKENDS || 'postgresql').split(','),
      strategy: 'master-slave',
      conflictResolution: 'latest-wins',
      syncInterval: parseInt(process.env.DB_SYNC_INTERVAL || '300000'), // 5 minutes
      batchSize: parseInt(process.env.DB_SYNC_BATCH_SIZE || '100')
    },
    enableMetrics: process.env.DB_METRICS_ENABLED === 'true',
    enableTracing: process.env.DB_TRACING_ENABLED === 'true'
  };

  // Merge incoming partial config for overrides
  const finalConfig = { ...defaultConfig, ...config };
  return new DatabaseService(finalConfig);
}

/**
 * Create a hybrid database service supporting both Firebase and PostgreSQL.
 * Used in environments where data may be replicated.
 * // TODO: Add options for enabling/disabling sync per backend, and credentials rotation.
 */
export function createHybridDatabaseService(): DatabaseService {
  // Extract config from env
  const config: DatabaseConfig = {
    backends: [
      {
        type: 'postgresql',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'ring_platform',
          username: process.env.DB_USER || 'ring_user',
          password: process.env.DB_PASSWORD || 'ring_dev_password'
        },
        options: {
          poolSize: 20,
          timeout: 30000,
          retries: 3
        }
      },
      {
        type: 'firebase',
        connection: {
          projectId: process.env.FIREBASE_PROJECT_ID,
          credentials: {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
          }
        },
        options: {
          timeout: 30000,
          retries: 3
        }
      }
    ],
    sync: {
      enabled: true,
      backends: ['postgresql', 'firebase'],
      strategy: 'master-slave',
      conflictResolution: 'latest-wins',
      syncInterval: 300000, // 5 minutes
      batchSize: 100
    },
    enableMetrics: true,
    enableTracing: true
  };

  return new DatabaseService(config);
}

// ============================================================================
// GLOBAL INSTANCE (managed by globalThis - for hot reload/NEXT.js)
// ============================================================================

/**
 * Store a global DB service (per process; survives Next.js HMR via globalThis).
 * // TODO: Use Next.js app router's request-scoped cache or server context when available
 */
const globalForDb = globalThis as typeof globalThis & {
  __ringDatabaseService?: DatabaseService | null
}

// Load from global if present, else null
let globalDatabaseService: DatabaseService | null =
  globalForDb.__ringDatabaseService ?? null;

/**
 * Store the provided service instance on globalThis and module-local var.
 */
function persistGlobalDatabaseService(service: DatabaseService | null): void {
  globalDatabaseService = service;
  globalForDb.__ringDatabaseService = service;
}

/**
 * Get or (lazily) create a global database service instance.
 * Uses new DB_BACKEND_MODE config system for all Next.js 13+ apps.
 * // STUB: If DB_BACKEND_MODE not present, import fallback config loader and throw.
 */
export function getDatabaseService(): DatabaseService {
  if (!globalDatabaseService) {
    // Use new backend mode configuration system
    const { getBackendModeConfig } = require('./backend-mode-config');
    const modeConfig = getBackendModeConfig();

    const config: DatabaseConfig = {
      backends: modeConfig.backends,
      sync: modeConfig.sync,
      enableMetrics: process.env.DB_METRICS_ENABLED === 'true',
      enableTracing: process.env.DB_TRACING_ENABLED === 'true'
    };

    globalDatabaseService = new DatabaseService(config);
    persistGlobalDatabaseService(globalDatabaseService);
  }

  return globalDatabaseService;
}

// ============================================================================
// COMMAND-BASED ABSTRACTION LAYER (higher-level DB API)
// ============================================================================

/**
 * Enumerates all supported database command API method names.
 * // KNOWN-MISSING: upsert, aggregate, collectionStats, changeStream (future expansion)
 */
export type DatabaseCommandType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'query'
  | 'count'
  | 'find'
  | 'findOne'
  | 'findById'
  | 'batchCreate'
  | 'batchUpdate'
  | 'batchDelete'
  | 'transaction'
  | 'subscribe'
  | 'createCollection'
  | 'migrateData';

/**
 * Parameter contracts for each DatabaseCommandType.
 * // KNOWN-MISSING: upsert, aggregate, advanced subscription, logical deletes/restore
 */
export interface DatabaseCommandParams {
  create: {
    collection: string;
    data: any;
    options?: { id?: string; merge?: boolean };
  };
  read: {
    collection: string;
    id: string;
  };
  update: {
    collection: string;
    id: string;
    data: any;
    options?: { merge?: boolean };
  };
  delete: {
    collection: string;
    id: string;
  };
  query: {
    querySpec: DatabaseQuery;
  };
  count: {
    collection: string;
    filters?: DatabaseFilter[];
  };
  find: {
    collection: string;
    filters?: DatabaseFilter[];
    options?: {
      orderBy?: DatabaseOrderBy[];
      limit?: number;
      offset?: number;
    };
  };
  findOne: {
    collection: string;
    filters?: DatabaseFilter[];
  };
  findById: {
    collection: string;
    id: string;
  };
  batchCreate: {
    collection: string;
    documents: Array<{ id?: string; data: any }>;
  };
  batchUpdate: {
    collection: string;
    updates: Array<{ id: string; data: any }>;
  };
  batchDelete: {
    collection: string;
    ids: string[];
  };
  transaction: {
    operation: (transaction: IDatabaseTransaction) => Promise<any>;
  };
  subscribe: {
    collection: string;
    filters: DatabaseFilter[];
    callback: (documents: DatabaseDocument[]) => void;
  };
  createCollection: {
    collection: string;
    schema?: any;
  };
  migrateData: {
    fromCollection: string;
    toCollection: string;
    transform?: (doc: DatabaseDocument) => DatabaseDocument;
  };
}

/**
 * Result types for each command. (Strongly types results for TS intellisense)
 */
export type DatabaseCommandResult<T extends DatabaseCommandType> =
  T extends 'create' ? DatabaseResult<DatabaseDocument> :
  T extends 'read' ? DatabaseResult<DatabaseDocument | null> :
  T extends 'update' ? DatabaseResult<DatabaseDocument> :
  T extends 'delete' ? DatabaseResult<void> :
  T extends 'query' ? DatabaseResult<DatabaseDocument[]> :
  T extends 'count' ? DatabaseResult<number> :
  T extends 'find' ? DatabaseResult<DatabaseDocument[]> :
  T extends 'findOne' ? DatabaseResult<DatabaseDocument | null> :
  T extends 'findById' ? DatabaseResult<DatabaseDocument | null> :
  T extends 'batchCreate' ? DatabaseResult<DatabaseDocument[]> :
  T extends 'batchUpdate' ? DatabaseResult<DatabaseDocument[]> :
  T extends 'batchDelete' ? DatabaseResult<void> :
  T extends 'transaction' ? DatabaseResult<any> :
  T extends 'subscribe' ? DatabaseResult<{ unsubscribe: () => void }> :
  T extends 'createCollection' ? DatabaseResult<void> :
  T extends 'migrateData' ? DatabaseResult<{ migrated: number; errors: Error[] }> :
  DatabaseResult<any>;

/**
 * Central DB command processor wraps DatabaseService with async, fully typed methods.
 * All parameter and return types enforced by DatabaseCommandParams/DatabaseCommandResult.
 */
export class DatabaseCommand {
  private service: DatabaseService;

  constructor(service?: DatabaseService) {
    this.service = service || getDatabaseService();
  }

  /**
   * Execute a database command per DatabaseCommandType enum.
   * @param command Name of db command
   * @param params Parameters for command type
   * Handles all CRUD, batch, meta, and advanced DB commands.
   */
  async execute<T extends DatabaseCommandType>(
    command: T,
    params: DatabaseCommandParams[T]
  ): Promise<DatabaseCommandResult<T>> {
    // Transaction command: propagate errors-only, don't catch, since all callers expect rollback errors to throw.
    if (command === 'transaction') {
      const data = await this.transaction(
        (params as DatabaseCommandParams['transaction']).operation
      );
      return {
        success: true,
        data,
        metadata: {
          operation: 'transaction',
          duration: 0,
          backend: this.service.getCurrentBackend(),
          timestamp: new Date(),
        },
      } as DatabaseCommandResult<T>;
    }

    // Wrap in try...catch for all CRUD/etc methods (always return {success:false} not throw)
    try {
      switch (command) {
        case 'create':
          return await this.service.create(
            (params as DatabaseCommandParams['create']).collection,
            (params as DatabaseCommandParams['create']).data,
            (params as DatabaseCommandParams['create']).options
          ) as DatabaseCommandResult<T>;
        case 'read':
          return await this.service.read(
            (params as DatabaseCommandParams['read']).collection,
            (params as DatabaseCommandParams['read']).id
          ) as DatabaseCommandResult<T>;
        case 'update':
          return await this.service.update(
            (params as DatabaseCommandParams['update']).collection,
            (params as DatabaseCommandParams['update']).id,
            (params as DatabaseCommandParams['update']).data,
            (params as DatabaseCommandParams['update']).options
          ) as DatabaseCommandResult<T>;
        case 'delete':
          return await this.service.delete(
            (params as DatabaseCommandParams['delete']).collection,
            (params as DatabaseCommandParams['delete']).id
          ) as DatabaseCommandResult<T>;
        case 'query':
          return await this.service.query(
            (params as DatabaseCommandParams['query']).querySpec
          ) as DatabaseCommandResult<T>;
        case 'count':
          return await this.service.count(
            (params as DatabaseCommandParams['count']).collection,
            (params as DatabaseCommandParams['count']).filters
          ) as DatabaseCommandResult<T>;
        case 'find':
          return await this.service.find(
            (params as DatabaseCommandParams['find']).collection,
            (params as DatabaseCommandParams['find']).filters,
            (params as DatabaseCommandParams['find']).options
          ) as DatabaseCommandResult<T>;
        case 'findOne':
          return await this.service.findOne(
            (params as DatabaseCommandParams['findOne']).collection,
            (params as DatabaseCommandParams['findOne']).filters
          ) as DatabaseCommandResult<T>;
        case 'findById':
          return await this.service.findById(
            (params as DatabaseCommandParams['findById']).collection,
            (params as DatabaseCommandParams['findById']).id
          ) as DatabaseCommandResult<T>;
        case 'batchCreate':
          return await this.service.batchCreate(
            (params as DatabaseCommandParams['batchCreate']).collection,
            (params as DatabaseCommandParams['batchCreate']).documents
          ) as DatabaseCommandResult<T>;
        case 'batchUpdate':
          return await this.service.batchUpdate(
            (params as DatabaseCommandParams['batchUpdate']).collection,
            (params as DatabaseCommandParams['batchUpdate']).updates
          ) as DatabaseCommandResult<T>;
        case 'batchDelete':
          return await this.service.batchDelete(
            (params as DatabaseCommandParams['batchDelete']).collection,
            (params as DatabaseCommandParams['batchDelete']).ids
          ) as DatabaseCommandResult<T>;
        case 'subscribe':
          return await this.service.subscribe(
            (params as DatabaseCommandParams['subscribe']).collection,
            (params as DatabaseCommandParams['subscribe']).filters,
            (params as DatabaseCommandParams['subscribe']).callback
          ) as DatabaseCommandResult<T>;
        case 'createCollection':
          return await this.service.createCollection(
            (params as DatabaseCommandParams['createCollection']).collection,
            (params as DatabaseCommandParams['createCollection']).schema
          ) as DatabaseCommandResult<T>;
        case 'migrateData':
          return await this.service.migrateData(
            (params as DatabaseCommandParams['migrateData']).fromCollection,
            (params as DatabaseCommandParams['migrateData']).toCollection,
            (params as DatabaseCommandParams['migrateData']).transform
          ) as DatabaseCommandResult<T>;
        default: {
          // STUB: Future command type implementation
          throw new Error(`Unknown database command: ${command}`);
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: command as string,
          duration: 0,
          backend: this.service.getCurrentBackend(),
          timestamp: new Date()
        }
      } as DatabaseCommandResult<T>;
    }
  }

  /**
   * Ensure DB is initialized (single-flight, safe for parallel calls).
   * // TODO: Use Next.js 16 new server-side singleton or request context API
   */
  private async ensureInitialized(): Promise<DatabaseResult<void>> {
    const init = await initializeDatabase();
    if (!init.success) {
      return {
        success: false,
        error: init.error ?? new Error('Database initialization failed'),
        metadata: {
          operation: 'initialize',
          duration: 0,
          backend: init.metadata?.backend ?? 'uninitialized',
          timestamp: init.metadata?.timestamp ?? new Date(),
        },
      };
    }
    return { success: true, data: undefined, metadata: init.metadata };
  }

  /**
   * Convert a result to query rows array.
   * Supports both {data:[]} and [] forms.
   */
  private normalizeQueryRows(raw: unknown): unknown[] {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (
      raw &&
      typeof raw === 'object' &&
      'data' in raw &&
      Array.isArray((raw as { data: unknown }).data)
    ) {
      return (raw as { data: unknown[] }).data;
    }
    return [];
  }

  /**
   * Convert a backend database document row to a domain row (typed + id).
   */
  private toDbRow<T extends object>(row: unknown): DbRow<T> {
    return unwrapDbQueryRow<T>(row as Record<string, unknown>);
  }

  /**
   * Read one doc by id, ensuring initialization. Returns as DbRow w/ id.
   */
  async readDoc<T extends object = Record<string, unknown>>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DbRow<T> | null>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('read', { collection, id });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    if (!r.data) {
      return { success: true, data: null, metadata: r.metadata };
    }
    return {
      success: true,
      data: this.toDbRow<T>(r.data),
      metadata: r.metadata,
    };
  }

  /**
   * Find one doc by id, using findById.
   */
  async findDocById<T extends object = Record<string, unknown>>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DbRow<T> | null>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('findById', { collection, id });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    if (!r.data) {
      return { success: true, data: null, metadata: r.metadata };
    }
    return {
      success: true,
      data: this.toDbRow<T>(r.data),
      metadata: r.metadata,
    };
  }

  /**
   * Query docs by querySpec, returning DbRow[].
   */
  async queryDocs<T extends object = Record<string, unknown>>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DbRow<T>[]>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('query', { querySpec });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    const rows = this.normalizeQueryRows(r.data);
    return {
      success: true,
      data: rows.map((row) => this.toDbRow<T>(row)),
      metadata: r.metadata,
    };
  }

  /**
   * Find one document by filters. Returns typed domain row or null.
   */
  async findOneDoc<T extends object = Record<string, unknown>>(
    collection: string,
    filters?: DatabaseFilter[]
  ): Promise<DatabaseResult<DbRow<T> | null>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('findOne', { collection, filters });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    if (!r.data) {
      return { success: true, data: null, metadata: r.metadata };
    }
    return {
      success: true,
      data: this.toDbRow<T>(r.data),
      metadata: r.metadata,
    };
  }

  /**
   * Find all docs (array) by filters/options. Returns array of typed domain rows.
   */
  async findDocs<T extends object = Record<string, unknown>>(
    collection: string,
    filters?: DatabaseFilter[],
    options?: {
      orderBy?: DatabaseOrderBy[];
      limit?: number;
      offset?: number;
    }
  ): Promise<DatabaseResult<DbRow<T>[]>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('find', { collection, filters, options });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    const rows = this.normalizeQueryRows(r.data);
    return {
      success: true,
      data: rows.map((row) => this.toDbRow<T>(row)),
      metadata: r.metadata,
    };
  }

  /**
   * Create one doc (id optional), returns resulting typed doc.
   */
  async createDoc<T extends object = Record<string, unknown>>(
    collection: string,
    data: T,
    options?: { id?: string; merge?: boolean }
  ): Promise<DatabaseResult<DbRow<T>>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('create', { collection, data, options });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    if (!r.data) {
      return {
        success: false,
        error: new Error('create returned no document'),
        metadata: r.metadata,
      };
    }
    return {
      success: true,
      data: this.toDbRow<T>(r.data),
      metadata: r.metadata,
    };
  }

  /**
   * Update one doc by id. Throws if not found. Returns resulting doc (typed).
   */
  async updateDoc<T extends object = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T> | Record<string, unknown>,
    options?: { merge?: boolean }
  ): Promise<DatabaseResult<DbRow<T>>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    const r = await this.execute('update', { collection, id, data, options });
    if (!r.success) {
      return { success: false, error: r.error, metadata: r.metadata };
    }
    if (!r.data) {
      return {
        success: false,
        error: new Error('update returned no document'),
        metadata: r.metadata,
      };
    }
    return {
      success: true,
      data: this.toDbRow<T>(r.data),
      metadata: r.metadata,
    };
  }

  /**
   * Delete one doc by id. (Returns result)
   */
  async deleteDoc(collection: string, id: string): Promise<DatabaseResult<void>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    return this.execute('delete', { collection, id });
  }

  /**
   * Count docs by collection and filters.
   */
  async countDocs(
    collection: string,
    filters?: DatabaseFilter[]
  ): Promise<DatabaseResult<number>> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      return { success: false, error: gate.error, metadata: gate.metadata };
    }
    return this.execute('count', { collection, filters });
  }

  /**
   * Run operations in a database transaction.
   * Ensures initialization, throws on failure (contract relied on by upstream).
   */
  async transaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<T> {
    const gate = await this.ensureInitialized();
    if (!gate.success) {
      throw gate.error ?? new Error('Database initialization failed');
    }
    const result = await this.service.transaction(operation);
    return result.data as T;
  }
}

// ============================================================================
// GLOBAL DB COMMAND INSTANCE (stateful singleton, module local)
// ============================================================================

/**
 * Global database command instance (singleton per process).
 * // TODO: Next 16 — replace with server context/request scoping if possible
 */
let globalDbCommand: DatabaseCommand | null = null;

/**
 * Get global database command instance.
 * . Payload `*Doc` methods are for domain code. Use transaction() for atomic writes, etc.
 */
export function db(): DatabaseCommand {
  if (!globalDbCommand) {
    globalDbCommand = new DatabaseCommand();
  }
  return globalDbCommand;
}

/**
 * Initialize global database command system (creates new db() if success).
 * Returns underlying DatabaseService.initialize() result.
 */
export async function initializeDbCommand(): Promise<DatabaseResult<void>> {
  const service = getDatabaseService();
  const result = await service.initialize();

  if (result.success) {
    globalDbCommand = new DatabaseCommand(service);
  }

  return result;
}

/**
 * Initialize global DB (only one in flight at a time).
 * Uses single-flight pattern to avoid parallel/duplicate connects.
 * // TODO: Replace global singleton for test with DI/context for better isolation.
 */
let initializeDatabaseInFlight: Promise<DatabaseResult<void>> | null = null;

export async function initializeDatabase(): Promise<DatabaseResult<void>> {
  if (shouldSkipDatabaseConnect()) {
    return {
      success: true,
      data: undefined,
      metadata: {
        operation: 'initialize',
        duration: 0,
        backend: 'build-skip',
        timestamp: new Date(0)
      }
    };
  }

  const service = getDatabaseService();

  if (DatabaseService.isInitialized() && service.isConnected()) {
    return { success: true, data: undefined };
  }

  if (initializeDatabaseInFlight) {
    // Wait for in-flight
    return initializeDatabaseInFlight;
  }

  initializeDatabaseInFlight = (async () => {
    try {
      if (DatabaseService.isInitialized() && service.isConnected()) {
        return { success: true, data: undefined };
      }
      const result = await service.initialize();
      if (result.success) {
        DatabaseService.setInitialized(true);
      }
      return result;
    } finally {
      initializeDatabaseInFlight = null;
    }
  })();

  return initializeDatabaseInFlight;
}

/**
 * Shutdown and cleanup global database service instance.
 * (Clears both local and globalThis singleton.)
 */
export async function shutdownDatabase(): Promise<DatabaseResult<void>> {
  if (globalDatabaseService) {
    const result = await globalDatabaseService.shutdown();
    persistGlobalDatabaseService(null);
    DatabaseService.setInitialized(false);
    return result;
  }

  // Not initialized, immediate success
  return {
    success: true,
    metadata: {
      operation: 'shutdown',
      duration: 0,
      backend: 'global',
      timestamp: new Date()
    }
  };
}
