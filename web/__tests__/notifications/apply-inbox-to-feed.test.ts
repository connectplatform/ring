import { describe, expect, it } from '@jest/globals'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
  type Notification,
} from '@/features/notifications/types'
import { applyInboxToFeed } from '@/features/notifications/lib/apply-inbox-to-feed'

function row(id: string, title = `Title ${id}`): Notification {
  return {
    id,
    userId: 'user-1',
    title,
    body: 'body',
    type: NotificationType.SYSTEM_UPDATE,
    priority: NotificationPriority.NORMAL,
    status: NotificationStatus.SENT,
    trigger: NotificationTrigger.SYSTEM_EVENT,
    channels: [NotificationChannel.IN_APP],
    deliveries: [],
    data: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

describe('applyInboxToFeed', () => {
  it('prepends an arrival and dedupes by id', () => {
    const next = applyInboxToFeed(
      [row('old')],
      {
        action: 'notification',
        notification: {
          id: 'new',
          title: 'Hello',
          body: 'there',
          type: NotificationType.SYSTEM_UPDATE,
        },
      },
      'all',
    )
    expect(next.map((item) => item.id)).toEqual(['new', 'old'])
    expect(next[0]?.title).toBe('Hello')
  })

  it('ignores an arrival that does not match the type filter', () => {
    const items = [row('old')]
    const next = applyInboxToFeed(
      items,
      {
        action: 'notification',
        notification: { id: 'new', title: 'Hello', type: NotificationType.OPPORTUNITY_CREATED },
      },
      NotificationType.SYSTEM_UPDATE,
    )
    expect(next).toBe(items)
  })

  it('drops a read row from the unread filter and deletes by id', () => {
    const unread = applyInboxToFeed(
      [row('a'), row('b')],
      { action: 'read', notificationId: 'a' },
      'unread',
    )
    expect(unread.map((item) => item.id)).toEqual(['b'])

    const deleted = applyInboxToFeed(unread, { action: 'delete', notificationId: 'b' }, 'all')
    expect(deleted).toEqual([])
  })

  it('clears the unread filter on read_all and ignores a payload with no title', () => {
    const cleared = applyInboxToFeed([row('a')], { action: 'read_all' }, 'unread')
    expect(cleared).toEqual([])

    const kept = [row('a')]
    expect(applyInboxToFeed(kept, { action: 'notification', notification: { id: 'x' } }, 'all')).toBe(kept)
  })

  it('does not surface an already-read arrival inside the unread filter', () => {
    const items = [row('old')]
    const next = applyInboxToFeed(
      items,
      {
        action: 'notification',
        notification: { id: 'seen', title: 'Seen', readAt: '2026-01-02T00:00:00.000Z' },
      },
      'unread',
    )
    expect(next).toBe(items)
  })
})
