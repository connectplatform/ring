/**
 * Database Backend Selector
 *
 * Intelligently routes database operations between multiple backends
 * Supports PostgreSQL and Firebase with automatic failover and load balancing
 */

import { monotime } from './timer'
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
import { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter';
import { FirebaseAdapter } from './adapters/FirebaseAdapter';

// Only log when explicitly requested via DB_DEBUG
function shouldLog(): boolean {
  return process.env.DB_DEBUG === 'true' ||
         (process.env.NODE_ENV === 'development' && process.env.DB_DEBUG !== 'false');
}

export enum BackendPriority {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  FALLBACK = 'fallback'
}

export interface BackendHealth {
  backend: string;
  healthy: boolean;
  responseTime: number;
  lastChecked: Date;
  errorCount: number;
  consecutiveFailures: number;
}

export interface BackendRoute {
  collection: string;
  backend: string;
  priority: BackendPriority;
  readOnly?: boolean;
  syncEnabled?: boolean;
}

/**
 * Backend Selector - Routes operations to appropriate database backends
 */
export class BackendSelector implements IDatabaseService {
  private backends: Map<string, IDatabaseService> = new Map();
  private healthStatus: Map<string, BackendHealth> = new Map();
  private routes: Map<string, BackendRoute> = new Map();
  private syncConfig: DatabaseSyncConfig;

  // Cache for route lookups to avoid repeated expensive operations
  private routeCache: Map<string, IDatabaseService> = new Map();
  private readonly CACHE_TTL = 1800000; // 30 minutes (increased from 5 minutes)
  private cacheTimestamps: Map<string, number> = new Map();

  // Health monitoring
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(
    backendConfigs: DatabaseBackendConfig[],
    syncConfig: DatabaseSyncConfig,
    routes: BackendRoute[] = []
  ) {
    this.syncConfig = syncConfig;

    // Initialize components
    this.initializeBackends(backendConfigs);
    this.initializeRoutes(routes);
    this.startHealthMonitoring();
  }

  private initializeBackends(configs: DatabaseBackendConfig[]): void {
    let registeredCount = 0;

    for (const config of configs) {
      try {
        let adapter: IDatabaseService;

        switch (config.type) {
          case 'postgresql':
            adapter = new PostgreSQLAdapter(config);
            break;
          case 'firebase':
            adapter = new FirebaseAdapter(config);
            break;
          default:
            throw new Error(`Unsupported backend type: ${config.type}`);
        }

        this.backends.set(config.type, adapter);
        this.healthStatus.set(config.type, {
          backend: config.type,
          healthy: true,
          responseTime: 0,
          lastChecked: new Date(),
          errorCount: 0,
          consecutiveFailures: 0
        });
        registeredCount++;

        // Only log when explicitly requested
        if (shouldLog()) {
          console.log(`BackendSelector: Backend '${config.type}' registered successfully`);
        }
      } catch (error) {
        if (shouldLog()) {
          console.error(`BackendSelector: Failed to initialize backend '${config.type}':`, error);
        }
        // Continue with other backends
      }
    }

    // Progress is now shown in constructor
  }

  private initializeRoutes(routes: BackendRoute[]): void {
    // Set default routes for common collections
    // ALL collections now use PostgreSQL as primary (users included for full migration)
    const defaultRoutes: BackendRoute[] = [
      { collection: 'users', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'entities', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'opportunities', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'messages', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'notifications', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'wallet_transactions', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'nft_listings', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'news', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'analytics_events', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'store_products', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'store_orders', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'comments', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'likes', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'reviews', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'conversations', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false },
      { collection: 'fcm_tokens', backend: 'postgresql', priority: BackendPriority.PRIMARY, syncEnabled: false }
    ];

    // Apply custom routes
    for (const route of defaultRoutes) {
      this.routes.set(route.collection, route);
    }

    // Override with custom routes
    for (const route of routes) {
      this.routes.set(route.collection, route);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [backendName, backend] of this.backends) {
      try {
        const startMs = monotime();
        const healthResult = await backend.healthCheck();
        const responseTime = monotime() - startMs;

        const healthStatus = this.healthStatus.get(backendName)!;

        if (healthResult.success && healthResult.data) {
          // Backend is healthy
          healthStatus.healthy = true;
          healthStatus.responseTime = responseTime;
          healthStatus.consecutiveFailures = 0;
        } else {
          // Backend is unhealthy
          healthStatus.healthy = false;
          healthStatus.errorCount++;
          healthStatus.consecutiveFailures++;
        }

        healthStatus.lastChecked = new Date();
      } catch (error) {
        const healthStatus = this.healthStatus.get(backendName)!;
        healthStatus.healthy = false;
        healthStatus.errorCount++;
        healthStatus.consecutiveFailures++;
        healthStatus.lastChecked = new Date();
      }
    }
  }

  private getBackendForCollection(collection: string): IDatabaseService {
    // Check cache first (monotonic clock - safe during Next.js prerendering)
    const now = monotime();
    const cachedTimestamp = this.cacheTimestamps.get(collection);
    const cachedBackend = this.routeCache.get(collection);

    if (cachedBackend && cachedTimestamp && (now - cachedTimestamp) < this.CACHE_TTL) {
      // Check if cached backend is still healthy
      const route = this.routes.get(collection);
      if (route) {
        const healthStatus = this.healthStatus.get(route.backend);
        if (healthStatus?.healthy) {
          return cachedBackend;
        }
      }
    }

    if (shouldLog()) {
      console.log(`BackendSelector: Looking up backend for collection '${collection}'`);
    }

    const route = this.routes.get(collection);
    if (!route) {
      if (shouldLog()) {
        console.log(`BackendSelector: No route found for '${collection}', using healthy backend fallback`);
      }
      const fallbackBackend = this.getHealthyBackend();
      // Cache the fallback result for a shorter time (30 seconds)
      this.routeCache.set(collection, fallbackBackend);
      this.cacheTimestamps.set(collection, now);
      return fallbackBackend;
    }

    const backend = this.backends.get(route.backend);
    if (!backend) {
      if (shouldLog()) {
        console.log(`BackendSelector: Available backends:`, Array.from(this.backends.keys()));
      }
      throw new Error(`Backend ${route.backend} not found for collection ${collection}`);
    }

    // Check if backend is healthy
    const healthStatus = this.healthStatus.get(route.backend);
    if (!healthStatus?.healthy) {
      // Fallback to healthy backend
      const fallbackBackend = this.getHealthyBackend();
      this.routeCache.set(collection, fallbackBackend);
      this.cacheTimestamps.set(collection, now);
      return fallbackBackend;
    }

    // Cache the successful result
    this.routeCache.set(collection, backend);
    this.cacheTimestamps.set(collection, now);

    if (shouldLog()) {
      console.log(`BackendSelector: Route resolved for '${collection}' -> '${route.backend}'`);
    }

    return backend;
  }

  private getHealthyBackend(): IDatabaseService {
    // Find the healthiest backend
    let bestBackend: IDatabaseService | null = null;
    let bestResponseTime = Infinity;

    for (const [backendName, backend] of this.backends) {
      const healthStatus = this.healthStatus.get(backendName);
      if (healthStatus?.healthy && healthStatus.responseTime < bestResponseTime) {
        bestBackend = backend;
        bestResponseTime = healthStatus.responseTime;
      }
    }

    if (!bestBackend) {
      throw new Error('No healthy database backends available');
    }

    return bestBackend;
  }

  // IDatabaseService implementation
  async connect(): Promise<DatabaseResult<void>> {
    if (shouldLog()) {
      console.log(`BackendSelector: Attempting to connect to ${this.backends.size} backend(s)`);
    }
    const results: DatabaseResult<void>[] = [];

    for (const [name, backend] of this.backends.entries()) {
      if (shouldLog()) {
        console.log(`BackendSelector: Connecting to backend '${name}'...`);
      }
      const startMs = monotime();
      const result = await backend.connect();
      const connectionTime = monotime() - startMs;
      if (shouldLog()) {
        console.log(`BackendSelector: Backend '${name}' connection result:`, {
          success: result.success,
          error: result.error?.message
        });
      }

      // CRITICAL: Update healthStatus after successful connection
      // Without this, getHealthyBackend() cannot find any healthy backends
      if (result.success) {
        const healthStatus = this.healthStatus.get(name);
        if (healthStatus) {
          healthStatus.healthy = true;
          healthStatus.responseTime = connectionTime;
          healthStatus.consecutiveFailures = 0;
          healthStatus.lastChecked = new Date();
        }
      }

      results.push(result);
    }

    // Return success if at least one backend connected
    const success = results.some(result => result.success);

    if (shouldLog()) {
      console.log(`BackendSelector: Overall connection result: ${success ? 'SUCCESS' : 'FAILURE'}`);
      console.log(`BackendSelector: Connection results:`, results.map((r, i) => ({
        backend: Array.from(this.backends.keys())[i],
        success: r.success,
        error: r.error?.message
      })));
    }

    return {
      success,
      error: success ? undefined : new Error('Failed to connect to any backend'),
      metadata: {
        operation: 'connect',
        duration: 0,
        backend: 'selector',
        timestamp: new Date()
      }
    };
  }

  async disconnect(): Promise<DatabaseResult<void>> {
    const results: DatabaseResult<void>[] = [];

    for (const backend of this.backends.values()) {
      const result = await backend.disconnect();
      results.push(result);
    }

    // Return success if at least one backend disconnected
    const success = results.some(result => result.success);

    return {
      success,
      error: success ? undefined : new Error('Failed to disconnect from any backend'),
      metadata: {
        operation: 'disconnect',
        duration: 0,
        backend: 'selector',
        timestamp: new Date()
      }
    };
  }

  async healthCheck(): Promise<DatabaseResult<boolean>> {
    const healthyBackends = Array.from(this.healthStatus.values())
      .filter(status => status.healthy);

    return {
      success: true,
      data: healthyBackends.length > 0,
      metadata: {
        operation: 'healthCheck',
        duration: 0,
        backend: 'selector',
        timestamp: new Date()
      }
    };
  }

  getBackendType(): string {
    return 'selector';
  }

  async create<T = any>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.create(collection, data, options);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'create', { id: result.data?.id, data });
    }

    return result;
  }

  async read<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.read<T>(collection, id);
  }

  async update<T = any>(
    collection: string,
    id: string,
    data: Partial<T>,
    options: { merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.update(collection, id, data, options);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'update', { id, data });
    }

    return result;
  }

  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.delete(collection, id);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'delete', { id });
    }

    return result;
  }

  async query<T = any>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const backend = this.getBackendForCollection(querySpec.collection);
    return await backend.query<T>(querySpec);
  }

  async count(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<number>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.count(collection, filters);
  }

  async readAll<T = any>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.readAll<T>(collection, options);
  }

  async findByField<T = any>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.findByField<T>(collection, field, value, options);
  }

  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.exists(collection, id);
  }

  async batchCreate<T = any>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.batchCreate(collection, documents);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'batchCreate', { documents });
    }

    return result;
  }

  async batchUpdate<T = any>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.batchUpdate(collection, updates);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'batchUpdate', { updates });
    }

    return result;
  }

  async batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>> {
    const backend = this.getBackendForCollection(collection);
    const result = await backend.batchDelete(collection, ids);

    // Trigger sync if enabled
    if (result.success && this.shouldSyncCollection(collection)) {
      this.triggerSync(collection, 'batchDelete', { ids });
    }

    return result;
  }

  async runTransaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    // For transactions, use the primary backend
    const primaryBackend = this.getHealthyBackend();
    return await primaryBackend.runTransaction(operation);
  }

  async subscribe<T = any>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.subscribe(collection, filters, callback);
  }

  async createCollection(
    collection: string,
    schema?: any
  ): Promise<DatabaseResult<void>> {
    const backend = this.getBackendForCollection(collection);
    return await backend.createCollection(collection, schema);
  }

  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
    const fromBackend = this.getBackendForCollection(fromCollection);
    return await fromBackend.migrateData(fromCollection, toCollection, transform);
  }

  // Additional methods for backend management
  getHealthStatus(): BackendHealth[] {
    return Array.from(this.healthStatus.values());
  }

  getRoutes(): BackendRoute[] {
    return Array.from(this.routes.values());
  }

  updateRoute(collection: string, route: Partial<BackendRoute>): void {
    const existingRoute = this.routes.get(collection);
    if (existingRoute) {
      this.routes.set(collection, { ...existingRoute, ...route });
    }
  }

  private shouldSyncCollection(collection: string): boolean {
    if (!this.syncConfig.enabled) {
      return false;
    }

    const route = this.routes.get(collection);
    return route?.syncEnabled || false;
  }

  private triggerSync(
    collection: string,
    operation: string,
    data: any
  ): void {
    if (!this.syncConfig.enabled) {
      return;
    }

    // Emit sync event for background processing
    process.nextTick(() => {
      this.performSync(collection, operation, data);
    });
  }

  private async performSync(
    collection: string,
    operation: string,
    data: any
  ): Promise<void> {
    try {
      // Get all backends that should receive sync
      const syncBackends = Array.from(this.backends.entries())
        .filter(([name]) => this.syncConfig.backends.includes(name))
        .filter(([name]) => {
          const healthStatus = this.healthStatus.get(name);
          return healthStatus?.healthy;
        });

      for (const [backendName, backend] of syncBackends) {
        try {
          // Skip if this is the source backend
          const route = this.routes.get(collection);
          if (route?.backend === backendName) {
            continue;
          }

          // Perform sync operation based on type
          switch (operation) {
            case 'create':
              await backend.create(collection, data.data, { id: data.id });
              break;
            case 'update':
              await backend.update(collection, data.id, data.data);
              break;
            case 'delete':
              await backend.delete(collection, data.id);
              break;
            // Add more sync operations as needed
          }
        } catch (error) {
          if (shouldLog()) {
            console.error(`Sync failed for backend ${backendName}:`, error);
          }
          // Continue with other backends even if one fails
        }
      }
    } catch (error) {
      if (shouldLog()) {
        console.error('Sync operation failed:', error);
      }
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Disconnect all backends
    for (const backend of this.backends.values()) {
      backend.disconnect().catch(error => {
        if (shouldLog()) {
          console.error('Error disconnecting backend:', error);
        }
      });
    }
  }
}
