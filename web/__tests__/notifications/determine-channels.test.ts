import { describe, expect, it } from '@jest/globals'
import {
  NotificationChannel,
  NotificationPriority,
  type DetailedNotificationPreferences,
} from '@/features/notifications/types'
import { determineChannels } from '@/features/notifications/lib/determine-channels'
import {
  CALL_INVITE_TTL_SECONDS,
  DEFAULT_WEBPUSH_TTL_SECONDS,
  ttlSecondsForNotificationType,
  webPushUrgencyForType,
} from '@/features/notifications/lib/push-ttl'

describe('determineChannels', () => {
  it('keeps PUSH when prefs are missing and the caller requested PUSH', () => {
    const channels = determineChannels(
      [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      null,
    )
    expect(channels).toEqual(
      expect.arrayContaining([NotificationChannel.IN_APP, NotificationChannel.PUSH]),
    )
  })

  it('defaults to IN_APP only when prefs are missing and PUSH was not requested', () => {
    expect(determineChannels(undefined, null)).toEqual([NotificationChannel.IN_APP])
  })

  it('honors stored channels.push opt-out', () => {
    const channels = determineChannels(
      [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      {
        enabled: true,
        channels: { inApp: true, email: false, sms: false, push: false },
        types: {} as never,
        quietHours: { enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
        frequency: { immediate: [], daily: [], weekly: [], monthly: [] },
        language: 'en',
        updatedAt: new Date(),
      },
    )
    expect(channels).toEqual([NotificationChannel.IN_APP])
    expect(channels).not.toContain(NotificationChannel.PUSH)
  })
})

const ALL_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
]

function quietPrefs(
  quietHours?: Partial<DetailedNotificationPreferences['quietHours']>,
): DetailedNotificationPreferences {
  return {
    enabled: true,
    channels: { inApp: true, email: true, sms: true, push: true },
    types: {} as never,
    quietHours: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      ...quietHours,
    },
    frequency: { immediate: [], daily: [], weekly: [], monthly: [] },
    language: 'en',
    updatedAt: new Date(),
  }
}

describe('determineChannels quiet hours', () => {
  const at = (iso: string) => new Date(iso)

  it('drops PUSH and SMS inside the window and keeps IN_APP and EMAIL', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.NORMAL,
      at('2026-01-01T23:30:00.000Z'),
    )
    expect(channels).toEqual([NotificationChannel.IN_APP, NotificationChannel.EMAIL])
  })

  it('keeps PUSH and SMS outside the window', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.NORMAL,
      at('2026-01-01T12:00:00.000Z'),
    )
    expect(channels).toEqual(ALL_CHANNELS)
  })

  it('treats midnight as inside an overnight window', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.NORMAL,
      at('2026-01-02T00:30:00.000Z'),
    )
    expect(channels).not.toContain(NotificationChannel.PUSH)
    expect(channels).toContain(NotificationChannel.IN_APP)
  })

  it('treats the end time as outside the window', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.NORMAL,
      at('2026-01-02T08:00:00.000Z'),
    )
    expect(channels).toContain(NotificationChannel.PUSH)
  })

  it('lets urgent notifications through inside the window', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.URGENT,
      at('2026-01-01T23:30:00.000Z'),
    )
    expect(channels).toEqual(ALL_CHANNELS)
  })

  it('still mutes high priority inside the window', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs(),
      NotificationPriority.HIGH,
      at('2026-01-01T23:30:00.000Z'),
    )
    expect(channels).not.toContain(NotificationChannel.PUSH)
    expect(channels).not.toContain(NotificationChannel.SMS)
  })

  it('passes PUSH through when preferences are missing', () => {
    const channels = determineChannels(
      [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      null,
      NotificationPriority.NORMAL,
      at('2026-01-01T23:30:00.000Z'),
    )
    expect(channels).toEqual(
      expect.arrayContaining([NotificationChannel.IN_APP, NotificationChannel.PUSH]),
    )
  })

  it('falls back to UTC when the timezone is invalid', () => {
    const channels = determineChannels(
      ALL_CHANNELS,
      quietPrefs({ timezone: 'Not/AZone', startTime: '00:00', endTime: '23:59' }),
      NotificationPriority.NORMAL,
      at('2026-01-01T12:00:00.000Z'),
    )
    expect(channels).not.toContain(NotificationChannel.PUSH)
    expect(channels).toContain(NotificationChannel.IN_APP)
  })
})

describe('ttlSecondsForNotificationType', () => {
  it('uses a short TTL for missed calls', () => {
    expect(ttlSecondsForNotificationType('call_invite')).toBe(CALL_INVITE_TTL_SECONDS)
    expect(CALL_INVITE_TTL_SECONDS).toBeLessThan(DEFAULT_WEBPUSH_TTL_SECONDS)
  })
})

describe('webPushUrgencyForType', () => {
  it('uses high urgency for call and game, normal otherwise', () => {
    expect(webPushUrgencyForType('call_invite')).toBe('high')
    expect(webPushUrgencyForType('game_request')).toBe('high')
    expect(webPushUrgencyForType('news')).toBe('normal')
  })
})
