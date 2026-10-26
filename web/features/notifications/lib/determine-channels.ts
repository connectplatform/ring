import {
  NotificationChannel,
  NotificationPriority,
  type DetailedNotificationPreferences,
} from '@/features/notifications/types'

const HH_MM = /^\d{2}:\d{2}$/

/**
 * Local HH:mm in the given IANA zone. Invalid zones throw RangeError.
 * hourCycle h23 keeps midnight at 00:00 (hour12:false can emit 24:00).
 */
function localHHmm(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  let hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  if (hour === '24') hour = '00'
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

/**
 * True when `now` falls inside the user's quiet-hours window.
 * Fail open: missing prefs, disabled window, bad HH:mm, or an unreadable zone.
 */
export function isWithinQuietHours(
  preferences: DetailedNotificationPreferences | null | undefined,
  now: Date,
): boolean {
  const quiet = preferences?.quietHours
  if (!quiet?.enabled) return false
  const { startTime: start, endTime: end } = quiet
  if (!HH_MM.test(start) || !HH_MM.test(end) || start === end) return false

  let local: string
  try {
    local = localHHmm(now, quiet.timezone || 'UTC')
  } catch {
    try {
      local = localHHmm(now, 'UTC')
    } catch {
      return false
    }
  }

  // End is exclusive. start > end is an overnight window (22:00–08:00).
  return start > end ? local >= start || local < end : local >= start && local < end
}

/**
 * Drop interruptive channels during quiet hours. Urgent still sends.
 * IN_APP and EMAIL stay. Missing or disabled quiet hours return the list unchanged.
 */
export function suppressQuietChannels(
  channels: NotificationChannel[],
  preferences: DetailedNotificationPreferences | null,
  priority: NotificationPriority | undefined,
  now: Date,
): NotificationChannel[] {
  if (priority === NotificationPriority.URGENT) return channels
  if (!isWithinQuietHours(preferences, now)) return channels
  return channels.filter(
    (channel) => channel !== NotificationChannel.PUSH && channel !== NotificationChannel.SMS,
  )
}

/**
 * Resolve delivery channels from explicit request + stored prefs.
 * Missing prefs row: IN_APP always; PUSH when the caller asked for it (default-on).
 * Stored prefs: honor channels.push / inApp opt-out, then quiet hours.
 */
export function determineChannels(
  requestedChannels: NotificationChannel[] | undefined,
  preferences: DetailedNotificationPreferences | null,
  priority?: NotificationPriority,
  now: Date = new Date(),
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

  const resolved = requestedChannels
    ? requestedChannels.filter((channel) => availableChannels.includes(channel))
    : availableChannels

  return suppressQuietChannels(resolved, preferences, priority, now)
}
