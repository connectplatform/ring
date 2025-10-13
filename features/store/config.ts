import { MockStoreAdapter } from './mock-adapter'
import type { StoreAdapter } from './types'

type StoreAdapterName = 'mock' | 'firebase' | 'connect' | 'postgresql'

export function getStoreAdapterName(): StoreAdapterName {
  if (typeof window !== 'undefined') {
    return 'mock'
  }
  const v = process.env.RING_STORE_ADAPTER as StoreAdapterName | undefined
  if (v === 'firebase' || v === 'connect' || v === 'postgresql' || v === 'mock') return v
  // Default to postgresql when DB_HYBRID_MODE is false (Firebase disabled)
  const dbHybridMode = process.env.DB_HYBRID_MODE !== 'false'
  return dbHybridMode ? 'firebase' : 'postgresql'
}

export async function getStoreAdapter(): Promise<StoreAdapter> {
  // Client-side must never import server-only adapters
  if (typeof window !== 'undefined') {
    return new MockStoreAdapter()
  }

  const name = getStoreAdapterName()
  if (name === 'firebase') {
    const { FirebaseStoreAdapter } = await import('@/lib/services/firebase-service-manager')
    return new FirebaseStoreAdapter()
  }
  if (name === 'postgresql') {
    const { PostgreSQLStoreAdapter } = await import('./postgresql-adapter')
    return new PostgreSQLStoreAdapter()
  }
  // ConnectPlatform adapter is not wired yet; fallback to mock
  return new MockStoreAdapter()
}

export async function getStoreService() {
  const { RingStoreService } = await import('./service')
  const adapter = await getStoreAdapter()
  return new RingStoreService(adapter)
}


