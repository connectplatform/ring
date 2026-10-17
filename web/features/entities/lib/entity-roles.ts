import 'server-only'

import { getSharedPgPool } from '@/lib/database/shared-pg-pool'
import type { SerializedEntity } from '@/features/entities/types'
import { EntityOwnershipError } from '@/features/entities/lib/assert-entity-owner'

export type EntityMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'

const RANK: Record<EntityMemberRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 }

export function getEntityMemberRole(
  entity: Pick<SerializedEntity, 'addedBy' | 'members' | 'memberRoles'>,
  userId: string | undefined | null,
): EntityMemberRole | null {
  if (!userId) return null
  if (entity.addedBy === userId) return 'OWNER'
  const stored = entity.memberRoles?.[userId]
  if (stored === 'OWNER' || stored === 'ADMIN' || stored === 'MEMBER') return stored
  if (Array.isArray(entity.members) && entity.members.includes(userId)) return 'MEMBER'
  return null
}

export function assertEntityRole(
  entity: Pick<SerializedEntity, 'addedBy' | 'members' | 'memberRoles' | 'name'>,
  userId: string,
  min: EntityMemberRole,
): EntityMemberRole {
  const role = getEntityMemberRole(entity, userId)
  if (!role || RANK[role] < RANK[min]) {
    throw new EntityOwnershipError(`You need ${min} access on ${entity.name || 'this entity'}`)
  }
  return role
}

export function getEntityTeamUserIds(
  entity: Pick<SerializedEntity, 'addedBy' | 'members' | 'memberRoles'>,
): string[] {
  const ids = new Set<string>()
  if (entity.addedBy) ids.add(entity.addedBy)
  for (const id of entity.members || []) ids.add(id)
  for (const id of Object.keys(entity.memberRoles || {})) ids.add(id)
  return [...ids]
}

/**
 * Entity ids this user may see entity-scoped records for:
 * entities they belong to, plus child entities of groups they belong to.
 */
export async function loadViewerEntityAccessIds(userId: string): Promise<Set<string>> {
  const pool = await getSharedPgPool()
  const { rows } = await pool.query<{ id: string }>(
    `WITH mine AS (
       SELECT id FROM entities
       WHERE data->>'addedBy' = $1
          OR (jsonb_typeof(data->'members') = 'array' AND data->'members' ? $1)
          OR (jsonb_typeof(data->'memberRoles') = 'object' AND data->'memberRoles' ? $1)
     )
     SELECT id FROM mine
     UNION
     SELECT e.id FROM entities e
     WHERE e.data->>'parentEntityId' IN (SELECT id FROM mine)`,
    [userId],
  )
  return new Set(rows.map((row) => row.id))
}
