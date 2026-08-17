import { describe, expect, it } from '@jest/globals'
import {
  dualPushDeliveryStatus,
  EMPTY_PUSH_STACK,
  settleToPushStack,
  summarizeDualPush,
} from '@/lib/notifications/push-dual-dispatch'

describe('summarizeDualPush', () => {
  it('treats empty FCM + empty RFC as a no-op, not a second Chrome delivery', () => {
    const outcome = summarizeDualPush(EMPTY_PUSH_STACK, EMPTY_PUSH_STACK)
    expect(outcome.noDevices).toBe(true)
    expect(outcome.delivered).toBe(false)
    expect(outcome.sendFailed).toBe(false)
    expect(dualPushDeliveryStatus(outcome)).toBe('noop')
  })

  it('Chrome FCM-only: RFC attempted=0 is fan-out skip, status delivered', () => {
    const outcome = summarizeDualPush(
      { attempted: 1, sent: 1, failed: 0 },
      EMPTY_PUSH_STACK,
    )
    expect(outcome.rfc.attempted).toBe(0)
    expect(outcome.delivered).toBe(true)
    expect(dualPushDeliveryStatus(outcome)).toBe('delivered')
  })

  it('Safari RFC-only: FCM attempted=0, RFC sent counts as delivered', () => {
    const outcome = summarizeDualPush(EMPTY_PUSH_STACK, {
      attempted: 1,
      sent: 1,
      failed: 0,
    })
    expect(outcome.fcm.attempted).toBe(0)
    expect(dualPushDeliveryStatus(outcome)).toBe('delivered')
  })

  it('same user two devices: both stacks send', () => {
    const outcome = summarizeDualPush(
      { attempted: 1, sent: 1, failed: 0 },
      { attempted: 1, sent: 1, failed: 0 },
    )
    expect(outcome.sent).toBe(2)
    expect(dualPushDeliveryStatus(outcome)).toBe('delivered')
  })

  it('marks failed when endpoints existed but every send failed', () => {
    const outcome = summarizeDualPush(
      { attempted: 2, sent: 0, failed: 2 },
      EMPTY_PUSH_STACK,
    )
    expect(dualPushDeliveryStatus(outcome)).toBe('failed')
  })

  it('maps rejected Promise.allSettled to a failed stack', () => {
    const settled = settleToPushStack({
      status: 'rejected',
      reason: new Error('admin down'),
    })
    expect(settled).toEqual({ attempted: 0, sent: 0, failed: 1 })
  })
})
