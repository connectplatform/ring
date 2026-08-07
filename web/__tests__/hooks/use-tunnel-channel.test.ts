/**
 * Regression: useTunnelChannel must not re-subscribe when subscribe identity
 * or inline callback identity changes between renders.
 */

import { renderHook } from '@testing-library/react'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'

const subscribeMock = jest.fn(() => jest.fn())

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { id: 'user-1' } },
  }),
}))

jest.mock('@/hooks/use-tunnel', () => ({
  useTunnel: () => ({
    isConnected: true,
    connectionState: 'connected',
    subscribe: subscribeMock,
    error: null,
  }),
}))

function useChannelWithInlineCallbacks(renderTick: number) {
  return useTunnelChannel<{ value: number }>({
    channel: 'notifications:inbox',
    enabled: true,
    onMessage: () => {
      void renderTick
    },
    onTunnelMessage: () => {
      void renderTick
    },
  })
}

describe('useTunnelChannel subscribe stability', () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    subscribeMock.mockImplementation(() => jest.fn())
  })

  it('subscribes once when callback identities change each render', () => {
    const { rerender } = renderHook(({ tick }) => useChannelWithInlineCallbacks(tick), {
      initialProps: { tick: 0 },
    })

    for (let i = 1; i <= 20; i += 1) {
      rerender({ tick: i })
    }

    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(subscribeMock).toHaveBeenCalledWith('notifications:inbox', expect.any(Function))
  })

  it('re-subscribes when resolved channel changes', () => {
    const { rerender } = renderHook(
      ({ channel }: { channel: string }) =>
        useTunnelChannel({
          channel,
          enabled: true,
          onMessage: () => undefined,
        }),
      { initialProps: { channel: 'channel-a' } },
    )

    expect(subscribeMock).toHaveBeenCalledTimes(1)

    rerender({ channel: 'channel-b' })

    expect(subscribeMock).toHaveBeenCalledTimes(2)
  })
})
