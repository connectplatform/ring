/**
 * Backend Synchronization Service
 *
 * Handles real-time synchronization between multiple database backends
 * Uses change data capture and conflict resolution strategies
 */

import { EventEmitter } from 'events';
import {
  IDatabaseService,
  DatabaseResult,
  DatabaseDocument,
  DatabaseFilter,
  DatabaseSyncConfig
} from '../interfaces/IDatabaseService';
import { DatabaseService } from '../DatabaseService';

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}

export enum ConflictResolutionStrategy {
  LATEST_WINS = 'latest_wins',
  MANUAL = 'manual',
  CUSTOM = 'custom',
  MERGE = 'merge'
}

export interface SyncEvent {
  id: string;
  collection: string;
  operation: SyncOperation;
  documentId: string;
  data: any;
  sourceBackend: string;
  timestamp: Date;
  version: number;
  checksum: string;
}

export interface SyncConflict {
  collection: string;
  documentId: string;
  sourceData: DatabaseDocument;
  targetData: DatabaseDocument;
  sourceBackend: string;
  targetBackend: string;
  timestamp: Date;
  resolution?: ConflictResolutionStrategy;
}

export interface SyncMetrics {
  totalEvents: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSyncTimestamp: Date;
}

/**
 * Backend Synchronization Service
 */
export class BackendSyncService extends EventEmitter {
  private databaseService: DatabaseService;
  private syncConfig: DatabaseSyncConfig;
  private syncQueue: SyncEvent[] = [];
  private activeSyncs: Map<string, Promise<void>> = new Map();
  private metrics: SyncMetrics;
  private syncInterval: NodeJS.Timeout | null = null;
  private conflictResolver: (conflict: SyncConflict) => Promise<DatabaseDocument>;

  constructor(
    databaseService: DatabaseService,
    syncConfig: DatabaseSyncConfig,
    conflictResolver?: (conflict: SyncConflict) => Promise<DatabaseDocument>
  ) {
    super();
    this.databaseService = databaseService;
    this.syncConfig = syncConfig;
    this.conflictResolver = conflictResolver || this.defaultConflictResolver.bind(this);

    this.metrics = {
      totalEvents: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      averageSyncTime: 0,
      lastSyncTimestamp: new Date()
    };

    this.initializeSync();
  }

  private initializeSync(): void {
    // Start periodic sync
    if (this.syncConfig.syncInterval > 0) {
      this.syncInterval = setInterval(() => {
        this.performBatchSync();
      }, this.syncConfig.syncInterval);
    }

    // Listen for database changes
    this.setupChangeListeners();

    // Start processing sync queue
    this.processSyncQueue();
  }

  private setupChangeListeners(): void {
    // This would be implemented differently for each backend
    // For PostgreSQL: LISTEN/NOTIFY
    // For Firebase: onSnapshot

    // For now, we'll rely on the application to call sync methods
    // when operations are performed
  }

  /**
   * Queue a sync event for processing
   */
  async queueSyncEvent(
    collection: string,
    operation: SyncOperation,
    documentId: string,
    data: any,
    sourceBackend: string,
    version: number = 1
  ): Promise<void> {
    const event: SyncEvent = {
      id: this.generateEventId(),
      collection,
      operation,
      documentId,
      data,
      sourceBackend,
      timestamp: new Date(),
      version,
      checksum: this.calculateChecksum(data)
    };

    this.syncQueue.push(event);
    this.metrics.totalEvents++;

    this.emit('syncEventQueued', event);

    // Process immediately for critical operations
    if (this.isCriticalOperation(operation)) {
      await this.processSyncEvent(event);
    }
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    while (true) {
      if (this.syncQueue.length > 0) {
        const event = this.syncQueue.shift();
        if (event) {
          try {
            await this.processSyncEvent(event);
          } catch (error) {
            console.error('Failed to process sync event:', error);
            this.metrics.failedSyncs++;

            // Re-queue with exponential backoff
            setTimeout(() => {
              this.syncQueue.unshift(event);
            }, Math.min(30000, Math.pow(2, event.version) * 1000));
          }
        }
      }

      // Wait before checking queue again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Process individual sync event
   */
  private async processSyncEvent(event: SyncEvent): Promise<void> {
    const syncKey = `${event.collection}:${event.documentId}`;

    // Prevent concurrent syncs for the same document
    if (this.activeSyncs.has(syncKey)) {
      await this.activeSyncs.get(syncKey);
      return;
    }

    const syncPromise = this.performSync(event);
    this.activeSyncs.set(syncKey, syncPromise);

    try {
      await syncPromise;
      this.metrics.successfulSyncs++;
      this.emit('syncEventProcessed', event);
    } finally {
      this.activeSyncs.delete(syncKey);
    }
  }

  /**
   * Perform the actual synchronization
   */
  private async performSync(event: SyncEvent): Promise<void> {
    const startTime = Date.now();

    // Get target backends (exclude source)
    const targetBackends = this.syncConfig.backends.filter(
      backend => backend !== event.sourceBackend
    );

    for (const targetBackend of targetBackends) {
      try {
        await this.syncToBackend(event, targetBackend);
      } catch (error) {
        console.error(`Failed to sync to ${targetBackend}:`, error);
        this.metrics.failedSyncs++;
        throw error;
      }
    }

    const syncTime = Date.now() - startTime;
    this.updateAverageSyncTime(syncTime);
    this.metrics.lastSyncTimestamp = new Date();
  }

  /**
   * Sync event to specific backend
   */
  private async syncToBackend(event: SyncEvent, targetBackend: string): Promise<void> {
    // Check if document exists in target backend
    const existingDoc = await this.checkDocumentExists(
      event.collection,
      event.documentId,
      targetBackend
    );

    if (existingDoc && this.detectConflict(event, existingDoc)) {
      await this.handleConflict(event, existingDoc, targetBackend);
      return;
    }

    // Perform the sync operation
    switch (event.operation) {
      case SyncOperation.CREATE:
        await this.syncCreate(event, targetBackend);
        break;
      case SyncOperation.UPDATE:
        await this.syncUpdate(event, targetBackend);
        break;
      case SyncOperation.DELETE:
        await this.syncDelete(event, targetBackend);
        break;
      case SyncOperation.BATCH_CREATE:
        await this.syncBatchCreate(event, targetBackend);
        break;
      case SyncOperation.BATCH_UPDATE:
        await this.syncBatchUpdate(event, targetBackend);
        break;
      case SyncOperation.BATCH_DELETE:
        await this.syncBatchDelete(event, targetBackend);
        break;
    }
  }

  private async syncCreate(event: SyncEvent, targetBackend: string): Promise<void> {
    // Create document in target backend
    await this.databaseService.create(event.collection, event.data, {
      id: event.documentId
    });
  }

  private async syncUpdate(event: SyncEvent, targetBackend: string): Promise<void> {
    // Update document in target backend
    await this.databaseService.update(event.collection, event.documentId, event.data);
  }

  private async syncDelete(event: SyncEvent, targetBackend: string): Promise<void> {
    // Delete document from target backend
    await this.databaseService.delete(event.collection, event.documentId);
  }

  private async syncBatchCreate(event: SyncEvent, targetBackend: string): Promise<void> {
    // Batch create documents in target backend
    await this.databaseService.batchCreate(event.collection, event.data.documents || []);
  }

  private async syncBatchUpdate(event: SyncEvent, targetBackend: string): Promise<void> {
    // Batch update documents in target backend
    await this.databaseService.batchUpdate(event.collection, event.data.updates || []);
  }

  private async syncBatchDelete(event: SyncEvent, targetBackend: string): Promise<void> {
    // Batch delete documents from target backend
    await this.databaseService.batchDelete(event.collection, event.data.ids || []);
  }

  /**
   * Check if document exists in target backend
   */
  private async checkDocumentExists(
    collection: string,
    documentId: string,
    targetBackend: string
  ): Promise<DatabaseDocument | null> {
    try {
      const result = await this.databaseService.read(collection, documentId);
      return result.success ? result.data : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if there's a conflict between source and target data
   */
  private detectConflict(event: SyncEvent, existingDoc: DatabaseDocument): boolean {
    if (!existingDoc) {
      return false;
    }

    // Check version numbers
    const sourceVersion = event.version;
    const targetVersion = existingDoc.metadata.version;

    if (sourceVersion !== targetVersion) {
      return true;
    }

    // Check checksums
    const targetChecksum = this.calculateChecksum(existingDoc.data);
    if (event.checksum !== targetChecksum) {
      return true;
    }

    return false;
  }

  /**
   * Handle sync conflict
   */
  private async handleConflict(
    event: SyncEvent,
    existingDoc: DatabaseDocument,
    targetBackend: string
  ): Promise<void> {
    this.metrics.conflictsDetected++;

    const conflict: SyncConflict = {
      collection: event.collection,
      documentId: event.documentId,
      sourceData: {
        id: event.documentId,
        data: event.data,
        metadata: {
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          version: event.version
        }
      },
      targetData: existingDoc,
      sourceBackend: event.sourceBackend,
      targetBackend,
      timestamp: new Date()
    };

    this.emit('conflictDetected', conflict);

    try {
      const resolvedData = await this.conflictResolver(conflict);

      // Update target backend with resolved data
      await this.databaseService.update(
        event.collection,
        event.documentId,
        resolvedData.data
      );

      this.metrics.conflictsResolved++;
      this.emit('conflictResolved', conflict, resolvedData);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }

  /**
   * Default conflict resolver (latest wins strategy)
   */
  private async defaultConflictResolver(conflict: SyncConflict): Promise<DatabaseDocument> {
    switch (this.syncConfig.conflictResolution) {
      case 'latest-wins':
        // Compare timestamps
        if (conflict.sourceData.metadata.updatedAt > conflict.targetData.metadata.updatedAt) {
          return conflict.sourceData;
        } else {
          return conflict.targetData;
        }

      case ConflictResolutionStrategy.MANUAL:
        // Store conflict for manual resolution
        await this.storeConflictForManualResolution(conflict);
        return conflict.targetData; // Keep target data for now

      default:
        return conflict.sourceData;
    }
  }

  /**
   * Perform batch synchronization for pending events
   */
  private async performBatchSync(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    const batchSize = Math.min(this.syncConfig.batchSize, this.syncQueue.length);
    const batch = this.syncQueue.splice(0, batchSize);

    console.log(`Performing batch sync of ${batch.length} events`);

    for (const event of batch) {
      try {
        await this.processSyncEvent(event);
      } catch (error) {
        console.error(`Batch sync failed for event ${event.id}:`, error);
        // Re-queue failed events
        this.syncQueue.unshift(event);
      }
    }
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflictForManualResolution(conflict: SyncConflict): Promise<void> {
    // Store in a special collection for manual resolution
    await this.databaseService.create('sync_conflicts', {
      ...conflict,
      status: 'pending',
      createdAt: new Date()
    });
  }

  // Utility methods
  private generateEventId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private isCriticalOperation(operation: SyncOperation): boolean {
    return [
      SyncOperation.DELETE,
      SyncOperation.BATCH_DELETE
    ].includes(operation);
  }

  private updateAverageSyncTime(syncTime: number): void {
    const totalTime = this.metrics.averageSyncTime * (this.metrics.successfulSyncs - 1);
    this.metrics.averageSyncTime = (totalTime + syncTime) / this.metrics.successfulSyncs;
  }

  // Public API methods
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  getQueueLength(): number {
    return this.syncQueue.length;
  }

  getActiveSyncs(): string[] {
    return Array.from(this.activeSyncs.keys());
  }

  forceSync(collection?: string): void {
    if (collection) {
      // Sync specific collection
      const collectionEvents = this.syncQueue.filter(
        event => event.collection === collection
      );
      collectionEvents.forEach(event => {
        this.processSyncEvent(event).catch(error => {
          console.error(`Forced sync failed for ${collection}:`, error);
        });
      });
    } else {
      // Sync all pending events
      this.performBatchSync().catch(error => {
        console.error('Forced batch sync failed:', error);
      });
    }
  }

  pause(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  resume(): void {
    if (!this.syncInterval && this.syncConfig.syncInterval > 0) {
      this.syncInterval = setInterval(() => {
        this.performBatchSync();
      }, this.syncConfig.syncInterval);
    }
  }

  destroy(): void {
    this.pause();
    this.syncQueue.length = 0;
    this.activeSyncs.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SYNC SERVICE FACTORY
// ============================================================================

/**
 * Create sync service with default configuration
 */
export function createBackendSyncService(
  databaseService: DatabaseService,
  syncConfig?: Partial<DatabaseSyncConfig>
): BackendSyncService {
  const defaultConfig: DatabaseSyncConfig = {
    enabled: process.env.DB_SYNC_ENABLED === 'true',
    backends: (process.env.DB_SYNC_BACKENDS || 'postgresql').split(','),
    strategy: 'master-slave',
    conflictResolution: 'latest-wins',
    syncInterval: parseInt(process.env.DB_SYNC_INTERVAL || '300000'),
    batchSize: parseInt(process.env.DB_SYNC_BATCH_SIZE || '100')
  };

  const finalConfig = { ...defaultConfig, ...syncConfig };
  return new BackendSyncService(databaseService, finalConfig);
}

// ============================================================================
// GLOBAL SYNC INSTANCE
// ============================================================================

let globalSyncService: BackendSyncService | null = null;

/**
 * Get or create global sync service instance
 */
export function getBackendSyncService(databaseService?: DatabaseService): BackendSyncService {
  if (!globalSyncService) {
    const dbService = databaseService || require('../DatabaseService').getDatabaseService();
    globalSyncService = createBackendSyncService(dbService);
  }

  return globalSyncService;
}

/**
 * Initialize global sync service
 */
export function initializeBackendSync(databaseService?: DatabaseService): BackendSyncService {
  return getBackendSyncService(databaseService);
}

/**
 * Shutdown global sync service
 */
export function shutdownBackendSync(): void {
  if (globalSyncService) {
    globalSyncService.destroy();
    globalSyncService = null;
  }
}
