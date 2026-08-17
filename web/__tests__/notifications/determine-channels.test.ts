import { describe, expect, it } from '@jest/globals'
import { NotificationChannel } from '@/features/notifications/types'
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
