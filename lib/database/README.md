# Database Abstraction Layer

## Overview

The Ring Platform Database Abstraction Layer provides a unified interface for database operations across multiple backends including PostgreSQL and Firebase. This abstraction enables seamless switching between databases, automatic failover, and cross-database synchronization.

> **Domain code standard (v1.6.4):** Use `db()` from `@/lib/database/DatabaseService` — `findDocById`, `queryDocs`, `createDoc`, `updateDoc`, `deleteDoc`, and `transaction()` for atomic writes. Methods auto-initialize and throw on failure. Legacy `initializeDatabase()` + `getDatabaseService()` remain for bootstrap and advanced `execute()` batches only.

## Key Features

- **🔄 Multi-Backend Support**: PostgreSQL and Firebase Firestore
- **⚡ Automatic Failover**: Health monitoring and backend switching
- **🔄 Real-time Sync**: Cross-database synchronization with conflict resolution
- **📊 Performance Monitoring**: Built-in metrics and tracing
- **🔒 Type Safety**: Full TypeScript support with interfaces
- **🚀 Easy Migration**: Zero-breaking changes to existing code

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Application   │────│  DatabaseService  │
└─────────────────┘    └──────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Backend      │ │ Backend      │ │ Backend      │
        │ Selector     │ │ Sync         │ │ Health       │
        │              │ │ Service      │ │ Monitor      │
        └──────────────┘ └──────────────┘ └──────────────┘
                │               │               │
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ PostgreSQL   │ │ Firebase     │ │ MongoDB      │
        │ Adapter      │ │ Adapter      │ │ Adapter      │
        └──────────────┘ └──────────────┘ └──────────────┘
```

## Quick Start

### Basic Setup (domain code — v1.6.4)

```typescript
import { db } from '@/lib/database/DatabaseService';

// Auto-initializes on first call; throws on error
const user = await db().findDocById('users', userId);
await db().createDoc('users', {
  email: 'user@example.com',
  name: 'John Doe',
});
```

### Legacy bootstrap (scripts, advanced batches)

```typescript
import { createDatabaseService, initializeDatabase } from '@/lib/database';

// Create service
const dbService = createDatabaseService();

// Initialize
await initializeDatabase();

// Use it
const user = await dbService.create('users', {
  email: 'user@example.com',
  name: 'John Doe'
});
```

### Hybrid Setup (PostgreSQL + Firebase)

```typescript
import { createHybridDatabaseService } from '@/lib/database';

// Create hybrid service
const dbService = createHybridDatabaseService();

// Initialize both backends
await dbService.initialize();

// Enable synchronization
import { createBackendSyncService } from '@/lib/database/sync/BackendSyncService';
const syncService = createBackendSyncService(dbService);
```

### Environment Configuration

```bash
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ring_platform
DB_USER=ring_user
DB_PASSWORD=ring_password_2024
DB_POOL_SIZE=20

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Sync Configuration
DB_SYNC_ENABLED=true
DB_SYNC_BACKENDS=postgresql,firebase
DB_SYNC_INTERVAL=300000
DB_SYNC_BATCH_SIZE=100
```

## API Reference

### Core Operations

```typescript
// Create document
const result = await dbService.create('collection', data, { id: 'custom-id' });

// Read document
const result = await dbService.read('collection', 'document-id');

// Update document
const result = await dbService.update('collection', 'id', updateData);

// Delete document
const result = await dbService.delete('collection', 'id');

// Query documents
const result = await dbService.query({
  collection: 'users',
  filters: [{ field: 'role', operator: '==', value: 'admin' }],
  orderBy: [{ field: 'createdAt', direction: 'desc' }],
  pagination: { limit: 10 }
});
```

### Batch Operations

```typescript
// Batch create
await dbService.batchCreate('users', [
  { data: { name: 'User 1', email: 'user1@example.com' } },
  { data: { name: 'User 2', email: 'user2@example.com' } }
]);

// Batch update
await dbService.batchUpdate('users', [
  { id: 'user1', data: { status: 'active' } },
  { id: 'user2', data: { status: 'inactive' } }
]);
```

### Transactions

```typescript
await dbService.transaction(async (transaction) => {
  // Create user
  const user = await transaction.create('users', userData);

  // Create profile
  await transaction.create('profiles', {
    userId: user.id,
    ...profileData
  });
});
```

### Real-time Subscriptions

```typescript
const { unsubscribe } = await dbService.subscribe(
  'messages',
  [{ field: 'conversationId', operator: '==', value: conversationId }],
  (documents) => {
    console.log('New messages:', documents);
  }
);

// Later: unsubscribe();
```

## Backend Synchronization

### Configuration

```typescript
const syncConfig = {
  enabled: true,
  backends: ['postgresql', 'firebase'],
  strategy: 'master-slave',
  conflictResolution: 'latest-wins',
  syncInterval: 300000, // 5 minutes
  batchSize: 100
};
```

### Conflict Resolution Strategies

- **latest-wins**: Last modified document takes precedence
- **manual**: Store conflicts for manual resolution
- **merge**: Attempt to merge conflicting changes
- **custom**: Use custom resolver function

### Custom Conflict Resolver

```typescript
const conflictResolver = async (conflict: SyncConflict) => {
  // Custom logic to resolve conflicts
  if (conflict.sourceData.metadata.updatedAt > conflict.targetData.metadata.updatedAt) {
    return conflict.sourceData;
  }
  return conflict.targetData;
};

const syncService = new BackendSyncService(dbService, syncConfig, conflictResolver);
```

## Migration Guide

### From Direct Firebase Usage

```typescript
// Before
import { doc, getDoc } from 'firebase/firestore';
const docRef = doc(db, 'users', userId);
const docSnap = await getDoc(docRef);

// After
import { getDatabaseService } from '@/lib/database';
const dbService = getDatabaseService();
const result = await dbService.read('users', userId);
```

### From Direct PostgreSQL Usage

```typescript
// Before
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// After
const dbService = getDatabaseService();
const result = await dbService.read('users', userId);
```

## Performance Optimization

### Connection Pooling

The abstraction layer automatically manages connection pools:

- PostgreSQL: Uses `pg.Pool` with configurable pool size
- Firebase: Connection pooling is handled by Firebase Admin SDK

### Query Optimization

```typescript
// Use specific field selection for performance
const result = await dbService.query({
  collection: 'users',
  filters: [{ field: 'status', operator: '==', value: 'active' }],
  select: ['id', 'name', 'email'] // Only fetch needed fields
});
```

### Indexing Strategy

The PostgreSQL schema includes optimized indexes:

- B-tree indexes for equality and range queries
- GIN indexes for array and full-text search
- Composite indexes for multi-field queries

## Monitoring and Observability

### Health Monitoring

```typescript
const health = await dbService.healthCheck();
console.log('Backend health:', health.data);

const backendHealth = dbService.getBackendHealth();
console.log('Detailed health:', backendHealth);
```

### Metrics Collection

```typescript
const stats = dbService.getStats();
console.log('Database statistics:', stats);
```

### Sync Monitoring

```typescript
const syncMetrics = syncService.getMetrics();
console.log('Sync performance:', syncMetrics);
```

## Error Handling

```typescript
try {
  const result = await dbService.create('users', userData);
  if (!result.success) {
    console.error('Operation failed:', result.error);
    // Handle error appropriately
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Best Practices

### 1. Use Transactions for Related Operations

```typescript
await dbService.transaction(async (tx) => {
  const order = await tx.create('orders', orderData);
  await tx.update('inventory', productId, { stock: stock - quantity });
});
```

### 2. Implement Proper Error Handling

```typescript
const result = await dbService.read('users', userId);
if (!result.success) {
  if (result.error?.message?.includes('not found')) {
    // Handle not found case
  } else {
    // Handle other errors
  }
}
```

### 3. Use Pagination for Large Datasets

```typescript
const result = await dbService.query({
  collection: 'users',
  pagination: { limit: 50, offset: 0 }
});
```

### 4. Monitor Performance

```typescript
const startTime = Date.now();
const result = await dbService.query(query);
const duration = Date.now() - startTime;

if (duration > 1000) { // Log slow queries
  console.warn('Slow query detected:', duration, 'ms');
}
```

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check environment variables
   - Verify database server is running
   - Check network connectivity

2. **Sync Conflicts**
   - Review conflict resolution strategy
   - Check sync service logs
   - Verify backend configurations

3. **Performance Issues**
   - Monitor query execution times
   - Check database indexes
   - Review connection pool settings

### Debugging

```typescript
// Enable detailed logging
process.env.DEBUG = 'database:*';

// Check backend routes
console.log('Routes:', dbService.getRoutes());

// Monitor sync queue
console.log('Sync queue length:', syncService.getQueueLength());
```

## Contributing

When adding new features:

1. Update the `IDatabaseService` interface
2. Implement in both adapters
3. Add tests for new functionality
4. Update documentation
5. Consider backward compatibility

## License

This database abstraction layer is part of the Ring Platform and follows the same licensing terms.
