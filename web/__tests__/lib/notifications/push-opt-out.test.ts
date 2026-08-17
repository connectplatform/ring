import { describe, expect, it, beforeEach } from '@jest/globals'
import {
  isPushOptedOut,
  RING_PUSH_OPT_OUT_KEY,
  setPushOptedOut,
} from '@/lib/notifications/push-opt-out'

describe('push-opt-out', () => {
  const memory = new Map<string, string>()

  beforeEach(() => {
    memory.clear()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value)
        },
        removeItem: (key: string) => {
          memory.delete(key)
        },
        clear: () => memory.clear(),
      },
    })
  })

  it('defaults to not opted out', () => {
    expect(isPushOptedOut()).toBe(false)
  })

  it('persists disable so auto-init cannot immediately re-subscribe', () => {
    setPushOptedOut(true)
    expect(window.localStorage.getItem(RING_PUSH_OPT_OUT_KEY)).toBe('1')
    expect(isPushOptedOut()).toBe(true)
    setPushOptedOut(false)
    expect(isPushOptedOut()).toBe(false)
  })
})
