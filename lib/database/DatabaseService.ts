/**
 * Main Database Service
 *
 * Unified entry point for all database operations in Ring Platform
 * Provides high-level abstraction over backend selector with configuration management
 */

import { monotime } from './timer'
import { isBuildTime } from '@/lib/build-cache/phase-detector'
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

export interface DatabaseConfig {
  backends: DatabaseBackendConfig[];
  sync: DatabaseSyncConfig;
  routes?: BackendRoute[];
  defaultBackend?: string;
  enableMetrics?: boolean;
  enableTracing?: boolean;
}

/**
 * Entity Cache for read-after-write consistency
 */
class EntityCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 30000; // 30 seconds

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: monotime() });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (entry && (monotime() - entry.timestamp) < this.TTL) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * Main Database Service Class
 * Provides unified interface for all database operations
 */
export class DatabaseService {
  private selector: BackendSelector;
  private config: DatabaseConfig;
  private connected: boolean = false;
  private static initialized: boolean = false;
  private entityCache = new EntityCache();

  public static isInitialized(): boolean {
    return DatabaseService.initialized;
  }

  public static setInitialized(initialized: boolean): void {
    DatabaseService.initialized = initialized;
  }


  constructor(config: DatabaseConfig) {
    this.config = config;
    this.selector = new BackendSelector(
      config.backends,
      config.sync,
      config.routes
    );
  }

  /**
   * Initialize database connections
   */
  async initialize(): Promise<DatabaseResult<void>> {
    try {
      const result = await this.selector.connect();
      if (result.success) {
        this.connected = true;
      }
      return result;
    } catch (error) {
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
   * Shutdown database connections
   */
  async shutdown(): Promise<DatabaseResult<void>> {
    try {
      const result = await this.selector.disconnect();
      if (result.success) {
        this.connected = false;
      }
      this.selector.destroy();
      return result;
    } catch (error) {
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
   * Health check for all backends
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

    return await this.selector.healthCheck();
  }

  /**
   * Get backend health status
   */
  getBackendHealth() {
    return this.selector.getHealthStatus();
  }

  /**
   * Get routing configuration
   */
  getRoutes() {
    return this.selector.getRoutes();
  }

  /**
   * Update routing for a collection
   */
  updateRoute(collection: string, route: Partial<BackendRoute>) {
    this.selector.updateRoute(collection, route);
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new document
   */
  async create<T = any>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'create', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const result = await this.selector.create(collection, data, options);

    // Cache newly created entities to prevent read-after-write consistency issues
    if (collection === 'entities' && result.success && result.data) {
      this.entityCache.set(result.data.id, result.data);
    }

    return result;
  }

  /**
   * Read a document by ID
   */
  async read<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'read', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    // Use cache for entities to prevent read-after-write consistency issues
    if (collection === 'entities') {
      const cached = this.entityCache.get(id);
      if (cached) {
        return {
          success: true,
          data: cached,
          error: null
        };
      }
    }

    return await this.selector.read<T>(collection, id);
  }

  async readAll<T = any>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'readAll', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const query: DatabaseQuery = {
      collection,
      pagination: {
        limit: options.limit || 1000, // Reasonable default limit
        offset: options.offset || 0
      }
    };

    if (options.orderBy) {
      query.orderBy = [options.orderBy];
    }

    return await this.selector.query<T>(query);
  }

  async findByField<T = any>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'findByField', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

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

  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'exists', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    try {
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
   * Update a document
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

    // Invalidate cache for updated entities
    if (collection === 'entities') {
      this.entityCache.invalidate(id);
    }

    return result;
  }

  /**
   * Delete a document
   */
  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'delete', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }

    const result = await this.selector.delete(collection, id);

    // Invalidate cache for deleted entities
    if (collection === 'entities') {
      this.entityCache.invalidate(id);
    }

    return result;
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Query documents with filters, sorting, and pagination
   */
  async query<T = any>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'query', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.query(querySpec);
  }

  /**
   * Count documents matching filters
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
   * Find documents by simple filters
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
   * Find first document matching filters
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
   * Find document by ID (convenience method)
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
   * Create multiple documents in batch
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
   * Update multiple documents in batch
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
   * Delete multiple documents in batch
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
   * Execute operations in a transaction
   */
  async transaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'transaction', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.runTransaction(operation);
  }

  // ============================================================================
  // REAL-TIME OPERATIONS
  // ============================================================================

  /**
   * Subscribe to real-time changes
   */
  async subscribe<T = any>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'subscribe', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.subscribe(collection, filters, callback);
  }

  // ============================================================================
  // SCHEMA OPERATIONS
  // ============================================================================

  /**
   * Create a new collection/table
   */
  async createCollection(
    collection: string,
    schema?: any
  ): Promise<DatabaseResult<void>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'createCollection', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.createCollection(collection, schema);
  }

  // ============================================================================
  // MIGRATION OPERATIONS
  // ============================================================================

  /**
   * Migrate data between collections or backends
   */
  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
    if (!this.connected) {
      return { success: false, error: new Error('Database service not initialized'), metadata: { operation: 'migrateData', duration: 0, backend: 'unconnected', timestamp: new Date(0) } };
    }
    return await this.selector.migrateData(fromCollection, toCollection, transform);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get service statistics
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
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current backend type (for debugging)
   */
  getCurrentBackend(): string {
    return this.selector.getBackendType();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a database service with default configuration
 */
export function createDatabaseService(config?: Partial<DatabaseConfig>): DatabaseService {
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

  const finalConfig = { ...defaultConfig, ...config };
  return new DatabaseService(finalConfig);
}

/**
 * Create a database service with Firebase and PostgreSQL
 */
export function createHybridDatabaseService(): DatabaseService {
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
// GLOBAL INSTANCE
// ============================================================================

/**
 * Global database service instance
 */
let globalDatabaseService: DatabaseService | null = null;

/**
 * Get or create global database service instance
 * Uses DB_BACKEND_MODE configuration (k8s-postgres-fcm, firebase-full, supabase-fcm)
 * No backward compatibility - DB_BACKEND_MODE is REQUIRED
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
  }

  return globalDatabaseService;
}

// ============================================================================
// COMMAND-BASED ABSTRACTION LAYER
// ============================================================================

/**
 * Database Command Types
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
 * Database Command Parameters
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
 * Database Command Result Types
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
 * Centralized Database Command Interface
 */
export class DatabaseCommand {
  private service: DatabaseService;

  constructor(service?: DatabaseService) {
    this.service = service || getDatabaseService();
  }

  /**
   * Execute a database command
   */
  async execute<T extends DatabaseCommandType>(
    command: T,
    params: DatabaseCommandParams[T]
  ): Promise<DatabaseCommandResult<T>> {
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

        case 'transaction':
          return await this.service.transaction(
            (params as DatabaseCommandParams['transaction']).operation
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

        default:
          throw new Error(`Unknown database command: ${command}`);
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
}

// ============================================================================
// GLOBAL DB COMMAND INSTANCE
// ============================================================================

/**
 * Global database command instance
 */
let globalDbCommand: DatabaseCommand | null = null;

/**
 * Get global database command instance
 */
export function db(): DatabaseCommand {
  if (!globalDbCommand) {
    globalDbCommand = new DatabaseCommand();
  }
  return globalDbCommand;
}

/**
 * Initialize database command system
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
 * Initialize global database service
 */
export async function initializeDatabase(): Promise<DatabaseResult<void>> {
  if (isBuildTime()) {
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

  // Skip initialization if already done
  if (DatabaseService.isInitialized() && service.isConnected()) {
    return { success: true, data: undefined };
  }

  const result = await service.initialize();
  if (result.success) {
    DatabaseService.setInitialized(true);
  }

  return result;
}

/**
 * Shutdown global database service
 */
export async function shutdownDatabase(): Promise<DatabaseResult<void>> {
  if (globalDatabaseService) {
    const result = await globalDatabaseService.shutdown();
    globalDatabaseService = null;
    return result;
  }

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
