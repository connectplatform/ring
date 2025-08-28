/**
 * Vendor Entity Service
 * 
 * Efficient service for vendor-specific entity operations with database-level filtering
 * and caching to minimize data transfer and processing overhead.
 */

import { cache } from 'react'
import { getCachedCollectionTyped } from '@/lib/services/firebase-service-manager'
import { Entity, SerializedEntity } from '@/features/entities/types'
import { serializeEntity } from '@/lib/converters/entity-serializer'

/**
 * Get vendor entity for a user with database-level filtering
 * Uses React 19 cache() for request deduplication within the same request cycle
 */
export const getVendorEntity = cache(async (userId: string): Promise<SerializedEntity | null> => {
  try {
    // Query directly for entities with storeActivated: true and addedBy: userId
    const result = await getCachedCollectionTyped<Entity>(
      'entities',
      {
        filters: [
          { field: 'addedBy', operator: '==', value: userId },
          { field: 'storeActivated', operator: '==', value: true }
        ],
        limit: 1, // We only need the first match
        orderBy: { field: 'lastUpdated', direction: 'desc' } // Get most recently updated
      }
    )

    if (result.items.length === 0) {
      return null
    }

    // Return the first (and should be only) vendor entity, serialized for client use
    return serializeEntity(result.items[0])
  } catch (error) {
    console.error('Error fetching vendor entity:', error)
    return null
  }
})

/**
 * Check if user has any vendor entities (lightweight check)
 * Uses database count query for minimal data transfer
 */
export const hasVendorEntity = cache(async (userId: string): Promise<boolean> => {
  try {
    const result = await getCachedCollectionTyped<Entity>(
      'entities',
      {
        filters: [
          { field: 'addedBy', operator: '==', value: userId },
          { field: 'storeActivated', operator: '==', value: true }
        ],
        limit: 1 // Only need to know if at least one exists
      }
    )

    return result.items.length > 0
  } catch (error) {
    console.error('Error checking vendor entity existence:', error)
    return false
  }
})

/**
 * Get all vendor entities for a user (for users with multiple stores)
 * Returns serialized entities ready for client consumption
 */
export const getVendorEntities = cache(async (userId: string): Promise<SerializedEntity[]> => {
  try {
    const result = await getCachedCollectionTyped<Entity>(
      'entities',
      {
        filters: [
          { field: 'addedBy', operator: '==', value: userId },
          { field: 'storeActivated', operator: '==', value: true }
        ],
        orderBy: { field: 'lastUpdated', direction: 'desc' }
      }
    )

    // Serialize all entities for client use
    return result.items.map(serializeEntity)
  } catch (error) {
    console.error('Error fetching vendor entities:', error)
    return []
  }
})

/**
 * Get vendor entity by entity ID (for direct entity access)
 * Verifies the entity is actually a vendor store
 */
export const getVendorEntityById = cache(async (entityId: string): Promise<SerializedEntity | null> => {
  try {
    const result = await getCachedCollectionTyped<Entity>(
      'entities',
      {
        filters: [
          { field: 'id', operator: '==', value: entityId },
          { field: 'storeActivated', operator: '==', value: true }
        ],
        limit: 1
      }
    )

    if (result.items.length === 0) {
      return null
    }

    return serializeEntity(result.items[0])
  } catch (error) {
    console.error('Error fetching vendor entity by ID:', error)
    return null
  }
})

/**
 * Get vendor entities by store status for admin/management purposes
 * Useful for vendor management dashboards
 */
export const getVendorEntitiesByStatus = cache(async (
  storeStatus: 'pending' | 'test' | 'open' | 'closed' | 'suspended',
  limit: number = 50
): Promise<SerializedEntity[]> => {
  try {
    const result = await getCachedCollectionTyped<Entity>(
      'entities',
      {
        filters: [
          { field: 'storeActivated', operator: '==', value: true },
          { field: 'storeStatus', operator: '==', value: storeStatus }
        ],
        orderBy: { field: 'lastUpdated', direction: 'desc' },
        limit
      }
    )

    return result.items.map(serializeEntity)
  } catch (error) {
    console.error('Error fetching vendor entities by status:', error)
    return []
  }
})

/**
 * Performance optimized vendor entity statistics
 * Returns counts without fetching full entity data
 */
export interface VendorEntityStats {
  totalVendors: number
  activeVendors: number
  pendingVendors: number
  suspendedVendors: number
}

export const getVendorEntityStats = cache(async (): Promise<VendorEntityStats> => {
  try {
    // Run parallel queries for different statuses
    const [total, active, pending, suspended] = await Promise.all([
      getCachedCollectionTyped<Entity>('entities', {
        filters: [{ field: 'storeActivated', operator: '==', value: true }],
        limit: 1000 // Reasonable limit for counting
      }),
      getCachedCollectionTyped<Entity>('entities', {
        filters: [
          { field: 'storeActivated', operator: '==', value: true },
          { field: 'storeStatus', operator: '==', value: 'open' }
        ],
        limit: 1000
      }),
      getCachedCollectionTyped<Entity>('entities', {
        filters: [
          { field: 'storeActivated', operator: '==', value: true },
          { field: 'storeStatus', operator: '==', value: 'pending' }
        ],
        limit: 1000
      }),
      getCachedCollectionTyped<Entity>('entities', {
        filters: [
          { field: 'storeActivated', operator: '==', value: true },
          { field: 'storeStatus', operator: '==', value: 'suspended' }
        ],
        limit: 1000
      })
    ])

    return {
      totalVendors: total.items.length,
      activeVendors: active.items.length,
      pendingVendors: pending.items.length,
      suspendedVendors: suspended.items.length
    }
  } catch (error) {
    console.error('Error fetching vendor entity stats:', error)
    return {
      totalVendors: 0,
      activeVendors: 0,
      pendingVendors: 0,
      suspendedVendors: 0
    }
  }
})
