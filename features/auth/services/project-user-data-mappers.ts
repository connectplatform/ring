/**
 * Snake_case JSONB row mappers for project user data collections.
 * Queries filter on data->>'global_user_id', etc. — writes must use snake_case keys.
 */

import type {
  UserCartHistory,
  UserContentEngagement,
  UserFavorite,
  UserProductInteraction,
  UserProjectAchievement,
  UserProjectFeedback,
  UserProjectNotification,
  UserProjectSession,
  UserSearchHistory,
} from '@/features/auth/types'

function iso(value: Date | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value instanceof Date ? value.toISOString() : value
}

export function toSessionDbRow(
  session: UserProjectSession,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: session.id,
    global_user_id: session.globalUserId,
    project_slug: projectSlug,
    session_start: iso(session.sessionStart),
    session_end: iso(session.sessionEnd),
    session_duration: session.sessionDuration,
    pages_visited: session.pagesVisited,
    actions_taken: session.actionsTaken,
    device_info: session.deviceInfo,
    ip_address: session.ipAddress,
    created_at: iso(session.createdAt),
  }
}

export function toInteractionDbRow(
  interaction: UserProductInteraction,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: interaction.id,
    global_user_id: interaction.globalUserId,
    project_slug: projectSlug,
    product_id: interaction.productId,
    interaction_type: interaction.interactionType,
    interaction_value: interaction.interactionValue,
    metadata: interaction.metadata,
    created_at: iso(interaction.createdAt),
  }
}

export function toFavoriteDbRow(
  favorite: UserFavorite,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: favorite.id,
    global_user_id: favorite.globalUserId,
    project_slug: projectSlug,
    favorite_type: favorite.favoriteType,
    favorite_id: favorite.favoriteId,
    tags: favorite.tags,
    notes: favorite.notes,
    created_at: iso(favorite.createdAt),
  }
}

export function toCartHistoryDbRow(
  cart: UserCartHistory,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: cart.id,
    global_user_id: cart.globalUserId,
    project_slug: projectSlug,
    session_id: cart.sessionId,
    product_id: cart.productId,
    quantity: cart.quantity,
    unit_price: cart.unitPrice,
    currency: cart.currency,
    added_at: iso(cart.addedAt),
    removed_at: iso(cart.removedAt),
    cart_status: cart.cartStatus,
  }
}

export function toSearchHistoryDbRow(
  search: UserSearchHistory,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: search.id,
    global_user_id: search.globalUserId,
    project_slug: projectSlug,
    search_query: search.searchQuery,
    search_filters: search.searchFilters,
    search_results_count: search.searchResultsCount,
    clicked_results: search.clickedResults,
    search_category: search.searchCategory,
    created_at: iso(search.createdAt),
  }
}

export function toEngagementDbRow(
  engagement: UserContentEngagement,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: engagement.id,
    global_user_id: engagement.globalUserId,
    project_slug: projectSlug,
    content_type: engagement.contentType,
    content_id: engagement.contentId,
    engagement_type: engagement.engagementType,
    engagement_value: engagement.engagementValue,
    engagement_duration: engagement.engagementDuration,
    metadata: engagement.metadata,
    created_at: iso(engagement.createdAt),
  }
}

export function toNotificationDbRow(
  settings: UserProjectNotification,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: settings.id,
    global_user_id: settings.globalUserId,
    project_slug: projectSlug,
    notification_type: settings.notificationType,
    is_enabled: settings.isEnabled,
    frequency: settings.frequency,
    channels: settings.channels,
    last_sent_at: iso(settings.lastSentAt),
    created_at: iso(settings.createdAt),
    updated_at: iso(settings.updatedAt),
  }
}

export function toAchievementDbRow(
  achievement: UserProjectAchievement,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: achievement.id,
    global_user_id: achievement.globalUserId,
    project_slug: projectSlug,
    achievement_id: achievement.achievementId,
    achievement_name: achievement.achievementName,
    achievement_description: achievement.achievementDescription,
    progress_percentage: achievement.progressPercentage,
    is_completed: achievement.isCompleted,
    completed_at: iso(achievement.completedAt),
    reward_earned: achievement.rewardEarned,
    created_at: iso(achievement.createdAt),
    updated_at: iso(achievement.updatedAt),
  }
}

export function toFeedbackDbRow(
  feedback: UserProjectFeedback,
  projectSlug: string,
): Record<string, unknown> {
  return {
    id: feedback.id,
    global_user_id: feedback.globalUserId,
    project_slug: projectSlug,
    feedback_type: feedback.feedbackType,
    feedback_title: feedback.feedbackTitle,
    feedback_content: feedback.feedbackContent,
    rating: feedback.rating,
    metadata: feedback.metadata,
    is_anonymous: feedback.isAnonymous,
    response_status: feedback.responseStatus,
    admin_response: feedback.adminResponse,
    responded_at: iso(feedback.respondedAt),
    created_at: iso(feedback.createdAt),
  }
}
