import { NotificationType } from '@/features/notifications/types'

/** Missed-call banners must not surface hours later. */
export const CALL_INVITE_TTL_SECONDS = 90
export const GAME_REQUEST_TTL_SECONDS = 60 * 10
export const DEFAULT_WEBPUSH_TTL_SECONDS = 60 * 60 * 12

export function ttlSecondsForNotificationType(type: string | undefined): number {
  if (type === NotificationType.CALL_INVITE || type === 'call_invite') {
    return CALL_INVITE_TTL_SECONDS
  }
  if (type === NotificationType.GAME_REQUEST || type === 'game_request') {
    return GAME_REQUEST_TTL_SECONDS
  }
  return DEFAULT_WEBPUSH_TTL_SECONDS
}

export function isInteractivePushNotificationType(type: string | undefined): boolean {
  return (
    type === NotificationType.CALL_INVITE ||
    type === 'call_invite' ||
    type === NotificationType.GAME_REQUEST ||
    type === 'game_request'
  )
}

export function webPushUrgencyForType(
  type: string | undefined,
): 'very-low' | 'low' | 'normal' | 'high' {
  if (isInteractivePushNotificationType(type)) {
    return 'high'
  }
  return 'normal'
}
