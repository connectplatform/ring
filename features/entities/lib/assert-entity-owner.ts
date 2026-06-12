import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getSerializedEntityById } from '@/features/entities/services/get-entity-by-id'
import type { SerializedEntity } from '@/features/entities/types'

export class EntityOwnershipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityOwnershipError'
  }
}

/**
 * Load entity and verify the current user may manage it (owner or admin).
 */
export async function assertEntityOwnerOrAdmin(entityId: string): Promise<{
  entity: SerializedEntity
  userId: string
}> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityOwnershipError('Authentication required')
  }

  const entity = await getSerializedEntityById(entityId)
  if (!entity) {
    throw new EntityOwnershipError('Entity not found')
  }

  const role = session.user.role as UserRole
  const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN
  const isOwner = entity.addedBy === session.user.id

  if (!isAdmin && !isOwner) {
    throw new EntityOwnershipError('You do not have permission to manage this entity')
  }

  return { entity, userId: session.user.id }
}
