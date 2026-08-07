import 'server-only'

import { z } from 'zod'
import { db } from '@/lib/database'
import { assertEntityOwnerOrAdmin } from '@/features/entities/lib/assert-entity-owner'
import { syncEntityDiscovery } from '@/features/entities/lib/entity-mutation-sync'
import { createNotification } from '@/features/notifications/services/notification-service'
import {
  NotificationPriority,
  NotificationType,
} from '@/features/notifications/types'
import { ROUTES } from '@/constants/routes'

export class EntityInviteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityInviteError'
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
})

export async function inviteEntityMember(
  entityId: string,
  input: z.infer<typeof inviteSchema>,
): Promise<{ success: true; userId: string; memberCount: number }> {
  const { email, role = 'MEMBER' } = inviteSchema.parse(input)
  const { entity, userId: inviterId } = await assertEntityOwnerOrAdmin(entityId)

  const userResult = await db().queryDocs<{ id: string; email?: string; name?: string }>({
    collection: 'users',
    filters: [{ field: 'email', operator: '=', value: email.trim().toLowerCase() }],
    pagination: { limit: 1 },
  })

  if (!userResult.success || !userResult.data?.length) {
    throw new EntityInviteError('No user found with that email address')
  }

  const invitee = userResult.data[0]

  if (invitee.id === entity.addedBy) {
    throw new EntityInviteError('Entity owner is already a member')
  }

  const currentMembers = Array.isArray(entity.members) ? entity.members : []

  if (currentMembers.includes(invitee.id)) {
    throw new EntityInviteError('User is already a member of this entity')
  }

  const nextMembers = [...currentMembers, invitee.id]

  const updateResult = await db().updateDoc(
    'entities',
    entityId,
    { members: nextMembers },
    { merge: true },
  )

  if (!updateResult.success) {
    throw new EntityInviteError(updateResult.error?.message || 'Failed to add member')
  }

  await syncEntityDiscovery({ entityId, event: 'updated' })

  try {
    await createNotification({
      userId: invitee.id,
      type: NotificationType.ENTITY_UPDATED,
      priority: NotificationPriority.NORMAL,
      title: `Invitation to join ${entity.name}`,
      body: `You have been invited as ${role} on ${entity.name}.`,
      actionText: 'View entity',
      actionUrl: ROUTES.ENTITY(entityId),
      data: {
        entityId,
        entityName: entity.name,
        userId: inviterId,
        metadata: { inviteRole: role, event: 'entity_member_invited' },
      },
    })
  } catch (error) {
    console.warn('inviteEntityMember: notification failed (member still added)', error)
  }

  return { success: true, userId: invitee.id, memberCount: nextMembers.length }
}
