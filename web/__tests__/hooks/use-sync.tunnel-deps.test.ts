/**
 * Regression: useSync tunnel subscription must not re-run when only the
 * inline tunnel options object identity changes between renders.
 */

import { renderHook } from '@testing-library/react'
import { useSync } from '@/hooks/use-sync'

const subscribeMock = jest.fn(() => jest.fn())

jest.mock('@/hooks/use-tunnel', () => ({
  useTunnel: () => ({
    isConnected: true,
    subscribe: subscribeMock,
  }),
}))

function useSyncWithInlineTunnel(renderTick: number) {
  return useSync<number>({
    enabled: true,
    autoRefresh: false,
    fetcher: async () => renderTick,
    tunnel: {
      channel: 'notifications:unread',
      enabled: true,
      onMessage: () => ({ shouldRefetch: false }),
    },
  })
}

describe('useSync tunnel deps', () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    subscribeMock.mockImplementation(() => jest.fn())
  })

  it('subscribes once when tunnel option object identity changes each render', () => {
    const { rerender } = renderHook(({ tick }) => useSyncWithInlineTunnel(tick), {
      initialProps: { tick: 0 },
    })

    for (let i = 1; i <= 20; i += 1) {
      rerender({ tick: i })
    }

    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(subscribeMock).toHaveBeenCalledWith(
      'notifications:unread',
      expect.any(Function)
    )
  })

  it('re-subscribes when tunnel channel changes', () => {
    const fetcher = jest.fn().mockResolvedValue(1)

    const { rerender } = renderHook(
      ({ channel }: { channel: string }) =>
        useSync<number>({
          enabled: true,
          autoRefresh: false,
          fetcher,
          tunnel: {
            channel,
            enabled: true,
            onMessage: () => ({ shouldRefetch: false }),
          },
        }),
      { initialProps: { channel: 'channel-a' } }
    )

    expect(subscribeMock).toHaveBeenCalledTimes(1)

    rerender({ channel: 'channel-b' })

    expect(subscribeMock).toHaveBeenCalledTimes(2)
  })
})
