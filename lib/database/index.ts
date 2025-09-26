/**
 * Database Abstraction Layer - Main Export
 *
 * Unified database abstraction for Ring Platform supporting PostgreSQL and Firebase
 */

// Core interfaces
export * from './interfaces/IDatabaseService';

// Adapters
export { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter';
export { FirebaseAdapter } from './adapters/FirebaseAdapter';

// Core services
export { BackendSelector } from './BackendSelector';
export { DatabaseService } from './DatabaseService';
export {
  createDatabaseService,
  createHybridDatabaseService,
  getDatabaseService,
  initializeDatabase,
  shutdownDatabase
} from './DatabaseService';

// Synchronization
export { BackendSyncService } from './sync/BackendSyncService';
export {
  createBackendSyncService,
  getBackendSyncService,
  initializeBackendSync,
  shutdownBackendSync
} from './sync/BackendSyncService';

// Types and enums
export {
  DatabaseFieldType,
  BackendPriority,
  SyncOperation,
  ConflictResolutionStrategy
} from './interfaces/IDatabaseService';
export {
  SyncOperation as SyncOperationEnum,
  ConflictResolutionStrategy as ConflictResolutionStrategyEnum
} from './sync/BackendSyncService';

// Utility functions
export function createDefaultDatabaseConfig() {
  return {
    backends: [
      {
        type: 'postgresql' as const,
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'ring_platform',
          username: process.env.DB_USER || 'ring_user',
          password: process.env.DB_PASSWORD || 'ring_password_2024'
        },
        options: {
          poolSize: 20,
          timeout: 30000,
          retries: 3
        }
      }
    ],
    sync: {
      enabled: process.env.DB_SYNC_ENABLED === 'true',
      backends: ['postgresql'],
      strategy: 'master-slave' as const,
      conflictResolution: 'latest-wins' as const,
      syncInterval: 300000,
      batchSize: 100
    }
  };
}

/**
 * Quick setup for development
 */
export async function setupDatabaseForDevelopment() {
  const { createDatabaseService, initializeDatabase } = await import('./DatabaseService');

  const service = createDatabaseService();
  const result = await initializeDatabase();

  if (result.success) {
    console.log('✅ Database initialized successfully');
  } else {
    console.error('❌ Database initialization failed:', result.error);
  }

  return service;
}

/**
 * Quick setup for production with sync
 */
export async function setupDatabaseForProduction() {
  const { createHybridDatabaseService, initializeDatabase } = await import('./DatabaseService');

  const service = createHybridDatabaseService();
  const result = await initializeDatabase();

  if (result.success) {
    console.log('✅ Hybrid database (PostgreSQL + Firebase) initialized successfully');

    // Initialize sync service
    const { initializeBackendSync } = await import('./sync/BackendSyncService');
    const syncService = initializeBackendSync(service);
    console.log('✅ Backend synchronization service initialized');
  } else {
    console.error('❌ Database initialization failed:', result.error);
  }

  return service;
}
