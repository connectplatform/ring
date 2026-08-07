'use server'

import type { EntityReportCategory } from '@/features/entities/lib/entity-moderation-types'
import type { Locale } from '@/i18n/shared'

export interface EntityModerationActionState {
  success?: boolean
  error?: string
  globallyBlocked?: boolean
}

export async function reportEntityAction(
  _prev: EntityModerationActionState | null,
  formData: FormData,
): Promise<EntityModerationActionState> {
  try {
    const entityId = String(formData.get('entityId') ?? '')
    const category = String(formData.get('category') ?? 'other') as EntityReportCategory
    const reason = String(formData.get('reason') ?? '')

    if (!entityId) {
      return { error: 'Entity ID is required' }
    }

    const { reportEntity } = await import('@/features/entities/services/entity-moderation')
    const result = await reportEntity({ entityId, category, reason })
    return { success: true, globallyBlocked: result.globallyBlocked }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to submit report',
    }
  }
}

export async function blockEntityAction(
  _prev: EntityModerationActionState | null,
  formData: FormData,
  _locale?: Locale,
): Promise<EntityModerationActionState> {
  try {
    const entityId = String(formData.get('entityId') ?? '')
    if (!entityId) {
      return { error: 'Entity ID is required' }
    }

    const { blockEntityForUser } = await import('@/features/entities/services/entity-moderation')
    await blockEntityForUser(entityId)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to block entity',
    }
  }
}

export async function unblockEntityAction(
  _prev: EntityModerationActionState | null,
  formData: FormData,
): Promise<EntityModerationActionState> {
  try {
    const entityId = String(formData.get('entityId') ?? '')
    if (!entityId) {
      return { error: 'Entity ID is required' }
    }

    const { unblockEntityForUser } = await import('@/features/entities/services/entity-moderation')
    await unblockEntityForUser(entityId)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to unblock entity',
    }
  }
}
