import 'server-only'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { revalidatePath } from 'next/cache'

export type ContentInteractionAction = 'save' | 'not_interested' | 'contact_intent'

export type MatcherSignalWeight =
  | 'positive_low'
  | 'positive_medium'
  | 'positive_high'
  | 'negative_high'
  | 'conversion'

const ACTION_WEIGHT: Record<ContentInteractionAction, MatcherSignalWeight> = {
  save: 'positive_high',
  not_interested: 'negative_high',
  contact_intent: 'positive_high',
}

function interactionId(userId: string, targetType: string, targetId: string, action: string) {
  return `uci_${userId}_${targetType}_${targetId}_${action}`.slice(0, 255)
}

export async function toggleContentInteraction(input: {
  targetType: 'opportunity'
  targetId: string
  action: ContentInteractionAction
}): Promise<{
  success: boolean
  active?: boolean
  weight?: MatcherSignalWeight
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }

  const userId = session.user.id
  const id = interactionId(userId, input.targetType, input.targetId, input.action)
  const existing = await db().readDoc('user_content_interactions', id)

  if (existing.success && existing.data) {
    const deleted = await db().deleteDoc('user_content_interactions', id)
    if (!deleted.success) {
      return { success: false, error: deleted.error?.message || 'Failed to clear interaction' }
    }
    revalidatePath('/[locale]/opportunities', 'page')
    return { success: true, active: false, weight: ACTION_WEIGHT[input.action] }
  }

  const now = new Date().toISOString()
  const created = await db().createDoc(
    'user_content_interactions',
    {
      id,
      userId,
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      weight: ACTION_WEIGHT[input.action],
      source: 'opportunity_feed',
      createdAt: now,
      updatedAt: now,
    },
    { id },
  )
  if (!created.success) {
    return { success: false, error: created.error?.message || 'Failed to record interaction' }
  }

  revalidatePath('/[locale]/opportunities', 'page')
  return { success: true, active: true, weight: ACTION_WEIGHT[input.action] }
}

export async function recordContentInteraction(input: {
  targetType: 'opportunity'
  targetId: string
  action: ContentInteractionAction
}): Promise<{ success: boolean; weight?: MatcherSignalWeight; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }

  const userId = session.user.id
  const id = interactionId(userId, input.targetType, input.targetId, input.action)
  const now = new Date().toISOString()
  const existing = await db().readDoc('user_content_interactions', id)
  if (existing.success && existing.data) {
    await db().updateDoc('user_content_interactions', id, { updatedAt: now })
    return { success: true, weight: ACTION_WEIGHT[input.action] }
  }

  const created = await db().createDoc(
    'user_content_interactions',
    {
      id,
      userId,
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      weight: ACTION_WEIGHT[input.action],
      source: 'opportunity_feed',
      createdAt: now,
      updatedAt: now,
    },
    { id },
  )
  if (!created.success) {
    return { success: false, error: created.error?.message || 'Failed to record interaction' }
  }
  revalidatePath('/[locale]/opportunities', 'page')
  return { success: true, weight: ACTION_WEIGHT[input.action] }
}
