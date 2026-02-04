/**
 * Database Abstraction Layer - Ring Platform
 *
 * Provides unified interface for Firebase and PostgreSQL operations
 * Enables seamless backend switching and database synchronization
 */

import { Query, DocumentData, WhereFilterOp } from 'firebase-admin/firestore';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Database operation result wrapper
 */
export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: {
    operation: string;
    duration: number;
    backend: string;
    timestamp: Date;
  };
}

/**
 * Query filter for cross-backend compatibility
 */
export interface DatabaseFilter {
  field: string;
  operator: WhereFilterOp | string; // Support both Firebase and SQL operators
  value: any;
}

/**
 * Sort order specification
 */
export interface DatabaseOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface DatabasePagination {
  limit?: number;
  offset?: number;
  startAfter?: any;
  endBefore?: any;
}

/**
 * Query specification
 */
export interface DatabaseQuery {
  collection: string;
  filters?: DatabaseFilter[];
  orderBy?: DatabaseOrderBy[];
  pagination?: DatabasePagination;
  select?: string[]; // Fields to select (for SQL optimization)
}

/**
 * Document data with metadata
 */
export interface DatabaseDocument<T = DocumentData> {
  id: string;
  data: T;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

// ============================================================================
// MAIN DATABASE SERVICE INTERFACE
// ============================================================================

/**
 * Unified database service interface
 * Supports both Firebase Firestore and PostgreSQL operations
 */
export interface IDatabaseService {
  // Connection management
  connect(): Promise<DatabaseResult<void>>;
  disconnect(): Promise<DatabaseResult<void>>;
  healthCheck(): Promise<DatabaseResult<boolean>>;
  getBackendType(): string;

  // CRUD Operations
  create<T = DocumentData>(
    collection: string,
    data: T,
    options?: { id?: string; merge?: boolean }
  ): Promise<DatabaseResult<DatabaseDocument<T>>>;

  read<T = DocumentData>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>>;

  readAll<T = DocumentData>(
    collection: string,
    options?: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy }
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>>;

  update<T = DocumentData>(
    collection: string,
    id: string,
    data: Partial<T>,
    options?: { merge?: boolean }
  ): Promise<DatabaseResult<DatabaseDocument<T>>>;

  delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>>;

  // Query Operations
  query<T = DocumentData>(
    query: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>>;

  findByField<T = DocumentData>(
    collection: string,
    field: string,
    value: any,
    options?: { limit?: number; orderBy?: DatabaseOrderBy }
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>>;

  exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>>;

  count(
    collection: string,
    filters?: DatabaseFilter[]
  ): Promise<DatabaseResult<number>>;

  // Batch Operations
  batchCreate<T = DocumentData>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>>;

  batchUpdate<T = DocumentData>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>>;

  batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>>;

  // Transaction Support
  runTransaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>>;

  // Real-time subscriptions (where supported)
  subscribe<T = DocumentData>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>>;

  // Schema operations
  createCollection(
    collection: string,
    schema?: DatabaseSchema
  ): Promise<DatabaseResult<void>>;

  // Migration support
  migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>>;
}

// ============================================================================
// TRANSACTION INTERFACE
// ============================================================================

/**
 * Database transaction interface for atomic operations
 */
export interface IDatabaseTransaction {
  create<T = DocumentData>(
    collection: string,
    data: T,
    options?: { id?: string }
  ): Promise<DatabaseDocument<T>>;

  read<T = DocumentData>(
    collection: string,
    id: string
  ): Promise<DatabaseDocument<T> | null>;

  update<T = DocumentData>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<DatabaseDocument<T>>;

  delete(collection: string, id: string): Promise<void>;

  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

/**
 * Database schema definition for dynamic table/collection creation
 */
export interface DatabaseSchema {
  fields: DatabaseField[];
  indexes: DatabaseIndex[];
  constraints: DatabaseConstraint[];
}

/**
 * Field definition
 */
export interface DatabaseField {
  name: string;
  type: DatabaseFieldType;
  nullable?: boolean;
  default?: any;
  unique?: boolean;
  references?: {
    collection: string;
    field: string;
  };
}

/**
 * Field type enumeration
 */
export enum DatabaseFieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  JSON = 'json',
  UUID = 'uuid',
  ARRAY = 'array',
  TEXT = 'text',
  BINARY = 'binary'
}

/**
 * Index definition
 */
export interface DatabaseIndex {
  name: string;
  fields: string[];
  unique?: boolean;
  type?: 'btree' | 'gin' | 'gist';
}

/**
 * Constraint definition
 */
export interface DatabaseConstraint {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'check' | 'unique';
  fields: string[];
  expression?: string; // For check constraints
}

// ============================================================================
// BACKEND CONFIGURATION
// ============================================================================

/**
 * Backend configuration
 */
export interface DatabaseBackendConfig {
  type: 'firebase' | 'postgresql' | 'mongodb';
  connection: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    url?: string;
    projectId?: string;
    credentials?: any;
  };
  options: {
    poolSize?: number;
    timeout?: number;
    retries?: number;
    ssl?: boolean;
  };
}

/**
 * Synchronization configuration
 */
export interface DatabaseSyncConfig {
  enabled: boolean;
  backends: string[]; // Backend names to sync
  strategy: 'master-slave' | 'multi-master' | 'eventual-consistency';
  conflictResolution: 'latest-wins' | 'manual' | 'custom';
  syncInterval: number; // milliseconds
  batchSize: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Operation metadata for monitoring and debugging
 */
export interface OperationMetadata {
  operationId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  backend: string;
  collection: string;
  success: boolean;
  error?: string;
  retryCount?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  activeConnections: number;
  totalConnections: number;
  uptime: number;
  backendType: string;
}

/**
 * Backend priority for routing
 */
export enum BackendPriority {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  FALLBACK = 'fallback'
}

/**
 * Sync operation types
 */
export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolutionStrategy {
  LATEST_WINS = 'latest-wins',
  MANUAL = 'manual',
  CUSTOM = 'custom',
  MERGE = 'merge'
}
