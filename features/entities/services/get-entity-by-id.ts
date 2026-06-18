import type { Entity } from '@/features/entities/types'
import { cache } from 'react'
import { db } from '@/lib/database'
import { mapDbRowToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'
import {
  canViewEntity,
  isEntityGloballyBlocked,
} from '@/features/entities/lib/entity-visibility-filter'
import { auth } from '@/auth'
import { assertKnownUserRole, isPlatformAdmin } from '@/features/auth/user-role'

export class EntityNotFoundError extends Error {
  constructor(id: string) {
    super(`Entity not found`)
    this.name = 'EntityNotFoundError'
  }
}

export class EntityAccessDeniedError extends Error {
  constructor(reason: string) {
    super(`Access denied: ${reason}`)
    this.name = 'EntityAccessDeniedError'
  }
}

export const getEntityById = cache(async (id: string): Promise<Entity | null> => {
  try {
    const session = await auth()

    if (!session || !session.user) {
      throw new EntityAccessDeniedError('Authentication required')
    }

    const userRole = assertKnownUserRole(session.user.role)

    const result = await db().findDocById<Entity & { id: string }>('entities', id)

    if (!result.success || !result.data) {
      return null
    }

    const entity = result.data as Entity

    if (!canViewEntity(entity, { userRole })) {
      throw new EntityAccessDeniedError('Insufficient permissions to view this entity')
    }

    const serialized = mapDbRowToSerializedEntity(id, entity as unknown as Record<string, unknown>)
    const isAdmin = isPlatformAdmin(userRole)
    const isOwner = entity.addedBy === session.user.id

    if (isEntityGloballyBlocked(serialized) && !isAdmin && !isOwner) {
      throw new EntityAccessDeniedError('This entity is not available')
    }

    return entity
  } catch (error) {
    if (error instanceof EntityNotFoundError || error instanceof EntityAccessDeniedError) {
      throw error
    }
    throw new Error('Entity retrieval failed')
  }
})

export const getSerializedEntityById = cache(async (id: string): Promise<import('@/features/entities/types').SerializedEntity | null> => {
  try {
    const entity = await getEntityById(id)

    if (!entity) {
      return null
    }

    return mapDbRowToSerializedEntity(
      id,
      entity as unknown as Record<string, unknown>,
    )
  } catch (error) {
    if (error instanceof EntityNotFoundError || error instanceof EntityAccessDeniedError) {
      throw error
    }
    throw new Error('Entity serialization failed')
  }
})

export const getEntity = cache(async (entityId: string): Promise<Entity | null> => {
  try {
    const result = await db().findDocById<Entity & { id: string }>('entities', entityId)

    if (result.success && result.data) {
      const entity = result.data as Entity
      if (
        entity.isConfidential ||
        entity.visibility === 'confidential' ||
        (entity.visibility && entity.visibility !== 'public')
      ) {
        return null
      }
      return entity
    }

    return null
  } catch {
    return null
  }
})

/** @deprecated Prefer `getUserCreatedEntities` from `get-user-entities.ts` */
export const getUserEntities = cache(async (userId: string) => {
  try {
    const session = await auth()
    if (!session?.user) {
      return []
    }

    const userRole = assertKnownUserRole(session.user.role)
    const canViewAll = isPlatformAdmin(userRole)
    const isOwnEntities = session.user.id === userId

    if (!canViewAll && !isOwnEntities) {
      throw new EntityAccessDeniedError('Can only view own entities')
    }

    const { getUserCreatedEntities } = await import('@/features/entities/services/get-user-entities')
    const result = await getUserCreatedEntities(userId)
    return result.entities
  } catch {
    return []
  }
})
