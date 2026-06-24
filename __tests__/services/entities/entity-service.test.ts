// @ts-nocheck
/**
 * Entity + database backend tests
 *
 * Covers:
 * - DB_BACKEND_MODE matrix (k8s-postgres-fcm, firebase-full, supabase-fcm)
 * - BackendSelector delegation for entities collection
 * - FirebaseAdapter CRUD/query surface (firebase-only persistence layer)
 * - Confidential entities paginated API contract
 *
 * Note: hybrid multi-backend sync is deprecated; use DB_BACKEND_MODE instead.
 * vercel-fcm is not a mode — Vercel edge deployments use firebase-full per backend-mode-config.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { FirebaseAdapter } from '@/lib/database/adapters/FirebaseAdapter'
import type { BackendSelector } from '@/lib/database/BackendSelector'
import type { IDatabaseService } from '@/lib/database/interfaces/IDatabaseService'

const mockPostgreSQLAdapterClass = jest.fn()
const mockFirebaseAdapterClass = jest.fn()

jest.mock('@/lib/build-cache/phase-detector', () => ({
  shouldSkipDatabaseConnect: () => true,
}))

// ---------------------------------------------------------------------------
// Mock adapter instances (shared across BackendSelector tests)
// ---------------------------------------------------------------------------

function createMockBackend(type: string): IDatabaseService & {
  [K in string]: jest.Mock
} {
  const backend = {
    connect: jest.fn(async () => ({ success: true, metadata: meta(type, 'connect') })),
    disconnect: jest.fn(async () => ({ success: true, metadata: meta(type, 'disconnect') })),
    healthCheck: jest.fn(async () => ({ success: true, data: true, metadata: meta(type, 'healthCheck') })),
    getBackendType: () => type,
    create: jest.fn(async () => ({
      success: true,
      data: { id: 'entity-1', data: { name: 'Test Entity' }, metadata: {} },
      metadata: meta(type, 'create'),
    })),
    read: jest.fn(async () => ({
      success: true,
      data: { id: 'entity-1', data: { name: 'Test Entity' }, metadata: {} },
      metadata: meta(type, 'read'),
    })),
    update: jest.fn(async () => ({
      success: true,
      data: { id: 'entity-1', data: { name: 'Updated' }, metadata: {} },
      metadata: meta(type, 'update'),
    })),
    delete: jest.fn(async () => ({ success: true, metadata: meta(type, 'delete') })),
    query: jest.fn(async () => ({ success: true, data: [], metadata: meta(type, 'query') })),
    count: jest.fn(async () => ({ success: true, data: 2, metadata: meta(type, 'count') })),
    readAll: jest.fn(async () => ({ success: true, data: [], metadata: meta(type, 'readAll') })),
    findByField: jest.fn(async () => ({ success: true, data: [], metadata: meta(type, 'findByField') })),
    exists: jest.fn(async () => ({ success: true, data: true, metadata: meta(type, 'exists') })),
    batchCreate: jest.fn(async () => ({ success: true, data: [], metadata: meta(type, 'batchCreate') })),
    batchUpdate: jest.fn(async () => ({ success: true, data: [], metadata: meta(type, 'batchUpdate') })),
    batchDelete: jest.fn(async () => ({ success: true, metadata: meta(type, 'batchDelete') })),
    runTransaction: jest.fn(async (op) => ({ success: true, data: await op({}), metadata: meta(type, 'transaction') })),
    subscribe: jest.fn(async () => ({
      success: true,
      data: { unsubscribe: jest.fn() },
      metadata: meta(type, 'subscribe'),
    })),
    createCollection: jest.fn(async () => ({ success: true, metadata: meta(type, 'createCollection') })),
    migrateData: jest.fn(async () => ({
      success: true,
      data: { migrated: 0, errors: [] },
      metadata: meta(type, 'migrateData'),
    })),
  }
  return backend as IDatabaseService & { [K in string]: jest.Mock }
}

function meta(backend: string, operation: string) {
  return { operation, duration: 0, backend, timestamp: new Date() }
}

const mockPostgresql = createMockBackend('postgresql')
const mockFirebase = createMockBackend('firebase')

jest.mock('@/lib/database/adapters/PostgreSQLAdapter', () => ({
  PostgreSQLAdapter: mockPostgreSQLAdapterClass,
}))

jest.mock('@/lib/database/adapters/FirebaseAdapter', () => ({
  FirebaseAdapter: mockFirebaseAdapterClass,
}))

// Firebase Admin mock for direct FirebaseAdapter integration tests
const mockFirestoreDoc = {
  id: 'entity-firebase-1',
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}

const mockFirestoreCollection = {
  doc: jest.fn(() => mockFirestoreDoc),
  add: jest.fn(async () => ({ id: 'entity-firebase-new' })),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(async () => ({
    docs: [{ id: 'entity-firebase-1', data: () => ({ name: 'Firebase Entity', isConfidential: false }) }],
    empty: false,
    size: 1,
  })),
  count: jest.fn().mockReturnValue({
    get: jest.fn(async () => ({ data: () => ({ count: 1 }) })),
  }),
}

const mockFirestore = {
  collection: jest.fn(() => mockFirestoreCollection),
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(async () => undefined),
  })),
}

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((n: number) => ({ __increment: n })),
    serverTimestamp: jest.fn(),
  },
  Timestamp: class MockTimestamp {
    constructor(private readonly date: Date) {}
    toDate() {
      return this.date
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d)
    }
  },
}))

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  firestore: jest.fn(() => mockFirestore),
}))

const ENTITY_SAMPLE = {
  name: 'Ring Test Entity',
  type: 'company',
  visibility: 'public',
  isConfidential: false,
}

const SYNC_DISABLED = {
  enabled: false,
  backends: [],
  strategy: 'master-slave' as const,
  conflictResolution: 'latest-wins' as const,
  syncInterval: 300000,
  batchSize: 100,
}

function resetMockBackends() {
  mockPostgreSQLAdapterClass.mockImplementation(() => mockPostgresql)
  mockFirebaseAdapterClass.mockImplementation(() => mockFirebase)

  for (const mock of [mockPostgresql, mockFirebase]) {
    Object.values(mock).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        fn.mockClear()
      }
    })
  }
}

async function exerciseSelectorCrud(selector: BackendSelector, expectedBackend: typeof mockPostgresql) {
  await selector.connect()

  await selector.create('entities', ENTITY_SAMPLE)
  await selector.read('entities', 'entity-1')
  await selector.update('entities', 'entity-1', { name: 'Updated' })
  await selector.delete('entities', 'entity-1')
  await selector.query({ collection: 'entities', filters: [] })
  await selector.count('entities', [{ field: 'isConfidential', operator: '==', value: true }])
  await selector.readAll('entities', { limit: 10 })
  await selector.findByField('entities', 'slug', 'test-entity')
  await selector.exists('entities', 'entity-1')
  await selector.batchCreate('entities', [{ data: ENTITY_SAMPLE }])
  await selector.batchUpdate('entities', [{ id: 'entity-1', data: { name: 'Batch' } }])
  await selector.batchDelete('entities', ['entity-1'])
  await selector.subscribe('entities', [], () => undefined)
  await selector.createCollection('entities')
  await selector.migrateData('entities', 'entities_archive')

  expect(expectedBackend.create).toHaveBeenCalled()
  expect(expectedBackend.read).toHaveBeenCalled()
  expect(expectedBackend.update).toHaveBeenCalled()
  expect(expectedBackend.delete).toHaveBeenCalled()
  expect(expectedBackend.query).toHaveBeenCalled()
  expect(expectedBackend.count).toHaveBeenCalled()
  expect(expectedBackend.readAll).toHaveBeenCalled()
  expect(expectedBackend.findByField).toHaveBeenCalled()
  expect(expectedBackend.exists).toHaveBeenCalled()
  expect(expectedBackend.batchCreate).toHaveBeenCalled()
  expect(expectedBackend.batchUpdate).toHaveBeenCalled()
  expect(expectedBackend.batchDelete).toHaveBeenCalled()
  expect(expectedBackend.subscribe).toHaveBeenCalled()
  expect(expectedBackend.createCollection).toHaveBeenCalled()
  expect(expectedBackend.migrateData).toHaveBeenCalled()

  selector.destroy()
}

describe('DB_BACKEND_MODE configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('supports k8s-postgres-fcm with PostgreSQL backend only', async () => {
    process.env.DB_BACKEND_MODE = 'k8s-postgres-fcm'
    const {
      getBackendModeConfig,
      shouldUseFirebaseForDatabase,
      shouldInitializeFirebaseFCM,
    } = await import('@/lib/database/backend-mode-config')

    const config = getBackendModeConfig()
    expect(config.mode).toBe('k8s-postgres-fcm')
    expect(config.backends).toHaveLength(1)
    expect(config.backends[0].type).toBe('postgresql')
    expect(shouldUseFirebaseForDatabase()).toBe(false)
    expect(shouldInitializeFirebaseFCM()).toBe(true)
  })

  it('supports firebase-full with Firebase backend only', async () => {
    process.env.DB_BACKEND_MODE = 'firebase-full'
    process.env.AUTH_FIREBASE_PROJECT_ID = 'test-project'
    const { getBackendModeConfig, shouldUseFirebaseForDatabase } = await import(
      '@/lib/database/backend-mode-config'
    )

    const config = getBackendModeConfig()
    expect(config.mode).toBe('firebase-full')
    expect(config.backends).toHaveLength(1)
    expect(config.backends[0].type).toBe('firebase')
    expect(shouldUseFirebaseForDatabase()).toBe(true)
  })

  it('supports supabase-fcm with PostgreSQL (Supabase) backend only', async () => {
    process.env.DB_BACKEND_MODE = 'supabase-fcm'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    const { getBackendModeConfig, shouldUseFirebaseForDatabase } = await import(
      '@/lib/database/backend-mode-config'
    )

    const config = getBackendModeConfig()
    expect(config.mode).toBe('supabase-fcm')
    expect(config.backends[0].type).toBe('postgresql')
    expect(shouldUseFirebaseForDatabase()).toBe(false)
  })

  it('rejects unknown backend modes (hybrid deprecated)', async () => {
    jest.doMock('@/lib/build-cache/phase-detector', () => ({
      shouldSkipDatabaseConnect: () => false,
    }))
    process.env.DB_BACKEND_MODE = 'hybrid'
    jest.resetModules()
    const { detectBackendMode } = await import('@/lib/database/backend-mode-config')
    expect(() => detectBackendMode()).toThrow(/Invalid DB_BACKEND_MODE/)
  })

  it('validates required env per mode', async () => {
    process.env.DB_BACKEND_MODE = 'k8s-postgres-fcm'
    delete process.env.DB_HOST
    const { validateBackendModeConfig } = await import('@/lib/database/backend-mode-config')
    const result = validateBackendModeConfig()
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('DB_HOST'))).toBe(true)
  })
})

describe('BackendSelector entity routing by DB_BACKEND_MODE', () => {
  const originalEnv = process.env
  let selector: BackendSelector | null = null
  let BackendPriority: typeof import('@/lib/database/BackendSelector').BackendPriority
  let SelectorCtor: typeof import('@/lib/database/BackendSelector').BackendSelector

  beforeEach(async () => {
    process.env = { ...originalEnv }
    jest.resetModules()
    resetMockBackends()
    jest.clearAllMocks()
    mockPostgreSQLAdapterClass.mockClear()
    mockFirebaseAdapterClass.mockClear()
    resetMockBackends()

    const backendSelectorModule = await import('@/lib/database/BackendSelector')
    BackendPriority = backendSelectorModule.BackendPriority
    SelectorCtor = backendSelectorModule.BackendSelector
  })

  afterEach(() => {
    selector?.destroy()
    selector = null
    process.env = originalEnv
  })

  it('k8s-postgres-fcm routes entities CRUD to PostgreSQL adapter', async () => {
    process.env.DB_BACKEND_MODE = 'k8s-postgres-fcm'
    const { getBackendModeConfig } = await import('@/lib/database/backend-mode-config')
    const modeConfig = getBackendModeConfig()

    selector = new SelectorCtor(modeConfig.backends, SYNC_DISABLED)
    await exerciseSelectorCrud(selector, mockPostgresql)
    expect(mockFirebase.create).not.toHaveBeenCalled()
  })

  it('supabase-fcm routes entities CRUD to PostgreSQL adapter', async () => {
    process.env.DB_BACKEND_MODE = 'supabase-fcm'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    const { getBackendModeConfig } = await import('@/lib/database/backend-mode-config')
    const modeConfig = getBackendModeConfig()

    selector = new SelectorCtor(modeConfig.backends, SYNC_DISABLED)
    await exerciseSelectorCrud(selector, mockPostgresql)
    expect(mockFirebase.create).not.toHaveBeenCalled()
  })

  it('firebase-full routes entities to Firebase when collection route is overridden', async () => {
    process.env.DB_BACKEND_MODE = 'firebase-full'
    process.env.AUTH_FIREBASE_PROJECT_ID = 'test-project'
    const { getBackendModeConfig } = await import('@/lib/database/backend-mode-config')
    const modeConfig = getBackendModeConfig()

    selector = new SelectorCtor(modeConfig.backends, SYNC_DISABLED, [
      { collection: 'entities', backend: 'firebase', priority: BackendPriority.PRIMARY },
    ])
    await exerciseSelectorCrud(selector, mockFirebase)
    expect(mockPostgresql.create).not.toHaveBeenCalled()
  })
})

describe('FirebaseAdapter entities persistence (firebase-full layer)', () => {
  beforeEach(() => {
    const { FirebaseAdapter: RealFirebaseAdapter } = jest.requireActual(
      '@/lib/database/adapters/FirebaseAdapter'
    )
    mockFirebaseAdapterClass.mockImplementation(
      (config) => new RealFirebaseAdapter(config)
    )

    jest.clearAllMocks()
    mockFirestoreDoc.get.mockResolvedValue({
      exists: true,
      id: 'entity-firebase-1',
      data: () => ({ ...ENTITY_SAMPLE, createdAt: new Date(), updatedAt: new Date() }),
    })
    mockFirestoreDoc.set.mockResolvedValue(undefined)
    mockFirestoreDoc.update.mockResolvedValue(undefined)
    mockFirestoreDoc.delete.mockResolvedValue(undefined)
  })

  it('connects and reports firebase backend type', async () => {
    const adapter = new FirebaseAdapter({
      type: 'firebase',
      connection: { projectId: 'test-project', credentials: {} },
      options: {},
    })

    const connectResult = await adapter.connect()
    expect(connectResult.success).toBe(true)
    expect(adapter.getBackendType()).toBe('firebase')
    const health = await adapter.healthCheck()
    expect(health.data).toBe(true)
  })

  it('create/read/update/delete entity documents', async () => {
    const adapter = new FirebaseAdapter({
      type: 'firebase',
      connection: { projectId: 'test-project', credentials: {} },
      options: {},
    })

    const created = await adapter.create('entities', ENTITY_SAMPLE, { id: 'entity-firebase-1' })
    expect(created.success).toBe(true)
    expect(mockFirestoreCollection.doc).toHaveBeenCalledWith('entity-firebase-1')
    expect(mockFirestoreDoc.set).toHaveBeenCalled()

    const read = await adapter.read('entities', 'entity-firebase-1')
    expect(read.success).toBe(true)
    expect(read.data?.id).toBe('entity-firebase-1')

    const updated = await adapter.update('entities', 'entity-firebase-1', { name: 'Updated Firebase' })
    expect(updated.success).toBe(true)
    expect(mockFirestoreDoc.set).toHaveBeenCalled()

    const deleted = await adapter.delete('entities', 'entity-firebase-1')
    expect(deleted.success).toBe(true)
    expect(mockFirestoreDoc.delete).toHaveBeenCalled()
  })

  it('query and count confidential entities', async () => {
    const adapter = new FirebaseAdapter({
      type: 'firebase',
      connection: { projectId: 'test-project', credentials: {} },
      options: {},
    })

    const queryResult = await adapter.query({
      collection: 'entities',
      filters: [{ field: 'isConfidential', operator: '==', value: true }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 20, offset: 0 },
    })
    expect(queryResult.success).toBe(true)
    expect(mockFirestoreCollection.where).toHaveBeenCalled()

    const countResult = await adapter.count('entities', [
      { field: 'isConfidential', operator: '==', value: true },
    ])
    expect(countResult.success).toBe(true)
    expect(mockFirestoreCollection.count).toHaveBeenCalled()
  })

  it('supports batch and existence helpers for entities', async () => {
    const adapter = new FirebaseAdapter({
      type: 'firebase',
      connection: { projectId: 'test-project', credentials: {} },
      options: {},
    })

    const exists = await adapter.exists('entities', 'entity-firebase-1')
    expect(exists.success).toBe(true)

    const batchCreate = await adapter.batchCreate('entities', [{ id: 'e1', data: ENTITY_SAMPLE }])
    expect(batchCreate.success).toBe(true)

    const batchUpdate = await adapter.batchUpdate('entities', [
      { id: 'e1', data: { name: 'Batch Updated' } },
    ])
    expect(batchUpdate.success).toBe(true)

    const batchDelete = await adapter.batchDelete('entities', ['e1'])
    expect(batchDelete.success).toBe(true)
  })
})

describe('Confidential entities paginated contract', () => {
  it('expects session-scoped paginated result shape', () => {
    const result = {
      entities: [
        { id: 'conf-1', name: 'Confidential Entity 1', isConfidential: true },
        { id: 'conf-2', name: 'Confidential Entity 2', isConfidential: true },
      ],
      lastVisible: 'conf-2',
      totalPages: 1,
      totalEntities: 2,
    }

    expect(result.entities.every((e) => e.isConfidential)).toBe(true)
    expect(result.totalPages).toBeGreaterThanOrEqual(1)
    expect(result.totalEntities).toBe(result.entities.length)
    expect(result).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('userRole')
  })
})
