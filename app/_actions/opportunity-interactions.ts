'use server'

import { revalidatePath } from 'next/cache'

export type OpportunityInteractionState = {
  success?: boolean
  error?: string
  message?: string
  active?: boolean
  isLiked?: boolean
  newCount?: number
  weight?: string
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function toggleOpportunityLike(
  _prev: OpportunityInteractionState | null,
  formData: FormData,
): Promise<OpportunityInteractionState> {
  const targetId = readString(formData, 'targetId') || readString(formData, 'opportunityId')
  if (!targetId) return { error: 'Opportunity id required' }

  const { toggleLike } = await import('@/features/interactions/services/like-service')
  const result = await toggleLike(targetId, 'opportunity')
  if (!result.success) {
    return { error: result.error || 'Failed to update like' }
  }
  revalidatePath('/[locale]/opportunities', 'page')
  return {
    success: true,
    message: result.message,
    isLiked: result.liked,
    newCount: result.likeCount,
    active: result.liked,
    weight: 'positive_medium',
  }
}

export async function toggleOpportunitySave(
  _prev: OpportunityInteractionState | null,
  formData: FormData,
): Promise<OpportunityInteractionState> {
  const targetId = readString(formData, 'opportunityId')
  if (!targetId) return { error: 'Opportunity id required' }

  const { toggleContentInteraction } = await import(
    '@/features/interactions/services/content-interaction-service'
  )
  const result = await toggleContentInteraction({
    targetType: 'opportunity',
    targetId,
    action: 'save',
  })
  if (!result.success) return { error: result.error || 'Failed to save' }
  return {
    success: true,
    active: result.active,
    weight: result.weight,
    message: result.active ? 'Saved' : 'Removed from saved',
  }
}

export async function markOpportunityNotInterested(
  _prev: OpportunityInteractionState | null,
  formData: FormData,
): Promise<OpportunityInteractionState> {
  const targetId = readString(formData, 'opportunityId')
  if (!targetId) return { error: 'Opportunity id required' }

  const { toggleContentInteraction } = await import(
    '@/features/interactions/services/content-interaction-service'
  )
  const result = await toggleContentInteraction({
    targetType: 'opportunity',
    targetId,
    action: 'not_interested',
  })
  if (!result.success) return { error: result.error || 'Failed to update preference' }
  return {
    success: true,
    active: result.active,
    weight: result.weight,
    message: result.active ? 'Marked not interested' : 'Preference cleared',
  }
}

export async function createOpportunityComment(
  _prev: OpportunityInteractionState | null,
  formData: FormData,
): Promise<OpportunityInteractionState> {
  const targetId = readString(formData, 'opportunityId')
  const content = readString(formData, 'content')
  if (!targetId || !content) return { error: 'Opportunity id and content required' }

  const { createComment } = await import('@/features/comments/services/comment-service')
  const result = await createComment({
    content,
    targetId,
    targetType: 'opportunity',
  })
  if (!result.success) return { error: result.error || 'Failed to comment' }
  revalidatePath(`/[locale]/opportunities/${targetId}`, 'page')
  return { success: true, message: 'Comment posted', weight: 'positive_medium' }
}

export async function recordOpportunityContactIntent(
  _prev: OpportunityInteractionState | null,
  formData: FormData,
): Promise<OpportunityInteractionState> {
  const targetId = readString(formData, 'opportunityId')
  if (!targetId) return { error: 'Opportunity id required' }

  const { recordContentInteraction } = await import(
    '@/features/interactions/services/content-interaction-service'
  )
  const result = await recordContentInteraction({
    targetType: 'opportunity',
    targetId,
    action: 'contact_intent',
  })
  if (!result.success) return { error: result.error || 'Failed to record contact intent' }
  return { success: true, message: 'Contact intent recorded', weight: result.weight }
}
