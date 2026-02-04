/**
 * Vendor Entity Service
 * 
 * Efficient service for vendor-specific entity operations with database-level filtering
 * and caching to minimize data transfer and processing overhead.
 */

import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { Entity, SerializedEntity } from '@/features/entities/types'
import { serializeEntity } from '@/lib/converters/entity-serializer'

/**
 * Get vendor entity for a user with database-level filtering
 * Uses React 19 cache() for request deduplication within the same request cycle
 */
export const getVendorEntity = cache(async (userId: string): Promise<SerializedEntity | null> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    // Query for vendor entities
    const result = await db.query({
      collection: 'entities',
      filters: [
        { field: 'addedBy', operator: '=', value: userId },
        { field: 'storeActivated', operator: '=', value: true }
      ],
      orderBy: [{ field: 'lastUpdated', direction: 'desc' }],
      pagination: { limit: 1 }
    })

    if (!result.success || !result.data) {
      return null
    }

    const entities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    if (entities.length === 0) {
      return null
    }

    return serializeEntity(entities[0])
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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const countResult = await db.count('entities', [
      { field: 'addedBy', operator: '=', value: userId },
      { field: 'storeActivated', operator: '=', value: true }
    ])

    return countResult.success && (countResult.data || 0) > 0
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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'entities',
      filters: [
        { field: 'addedBy', operator: '=', value: userId },
        { field: 'storeActivated', operator: '=', value: true }
      ],
      orderBy: [{ field: 'lastUpdated', direction: 'desc' }]
    })

    if (!result.success || !result.data) {
      return []
    }

    const entities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    return entities.map(serializeEntity)
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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.findById('entities', entityId)

    if (!result.success || !result.data) {
      return null
    }

    const entity = (result.data as any).data || result.data
    
    // Verify it's a vendor store
    if (!entity.storeActivated) {
      return null
    }

    return serializeEntity(entity)
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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'entities',
      filters: [
        { field: 'storeActivated', operator: '=', value: true },
        { field: 'storeStatus', operator: '=', value: storeStatus }
      ],
      orderBy: [{ field: 'lastUpdated', direction: 'desc' }],
      pagination: { limit }
    })

    if (!result.success || !result.data) {
      return []
    }

    const entities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    return entities.map(serializeEntity)
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
    await initializeDatabase()
    const db = getDatabaseService()

    // Run parallel count queries for different statuses
    const [total, active, pending, suspended] = await Promise.all([
      db.count('entities', [
        { field: 'storeActivated', operator: '=', value: true }
      ]),
      db.count('entities', [
        { field: 'storeActivated', operator: '=', value: true },
        { field: 'storeStatus', operator: '=', value: 'open' }
      ]),
      db.count('entities', [
        { field: 'storeActivated', operator: '=', value: true },
        { field: 'storeStatus', operator: '=', value: 'pending' }
      ]),
      db.count('entities', [
        { field: 'storeActivated', operator: '=', value: true },
        { field: 'storeStatus', operator: '=', value: 'suspended' }
      ])
    ])

    return {
      totalVendors: (total.success ? total.data : 0) || 0,
      activeVendors: (active.success ? active.data : 0) || 0,
      pendingVendors: (pending.success ? pending.data : 0) || 0,
      suspendedVendors: (suspended.success ? suspended.data : 0) || 0
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
