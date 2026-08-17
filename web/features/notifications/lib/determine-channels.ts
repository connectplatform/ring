import {
  NotificationChannel,
  type DetailedNotificationPreferences,
} from '@/features/notifications/types'

/**
 * Resolve delivery channels from explicit request + stored prefs.
 * Missing prefs row: IN_APP always; PUSH when the caller asked for it (default-on).
 * Stored prefs: honor channels.push / inApp opt-out.
 */
export function determineChannels(
  requestedChannels: NotificationChannel[] | undefined,
  preferences: DetailedNotificationPreferences | null,
): NotificationChannel[] {
  if (!preferences) {
    const channels = new Set<NotificationChannel>([NotificationChannel.IN_APP])
    if (requestedChannels?.includes(NotificationChannel.PUSH)) {
      channels.add(NotificationChannel.PUSH)
    }
    return [...channels]
  }

  const availableChannels: NotificationChannel[] = []

  if (preferences.channels.inApp) {
    availableChannels.push(NotificationChannel.IN_APP)
  }
  if (preferences.channels.email) {
    availableChannels.push(NotificationChannel.EMAIL)
  }
  if (preferences.channels.sms) {
    availableChannels.push(NotificationChannel.SMS)
  }
  if (preferences.channels.push) {
    availableChannels.push(NotificationChannel.PUSH)
  }

  if (requestedChannels) {
    return requestedChannels.filter((channel) => availableChannels.includes(channel))
  }

  return availableChannels
}
