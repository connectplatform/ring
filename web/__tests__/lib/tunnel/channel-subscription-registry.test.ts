import { createChannelSubscriptionRegistry } from '@/lib/tunnel/channel-subscription-registry'
import type { TunnelMessage } from '@/lib/tunnel/types'

describe('createChannelSubscriptionRegistry', () => {
  it('creates one transport subscription for concurrent handlers on the same channel', async () => {
    const transportSubscribe = jest.fn(async ({ channel }: { channel: string }) => ({
      channel,
      unsubscribe: jest.fn(),
    }))

    const registry = createChannelSubscriptionRegistry({
      subscribeTransport: transportSubscribe,
    })

    const handlerA = jest.fn()
    const handlerB = jest.fn()

    registry.subscribe('opportunities', handlerA)
    registry.subscribe('opportunities', handlerB)

    expect(transportSubscribe).toHaveBeenCalledTimes(1)
    expect(transportSubscribe).toHaveBeenCalledWith({ channel: 'opportunities' })

    await Promise.resolve()

    const message = {
      channel: 'opportunities',
      event: 'update',
      payload: { type: 'new', opportunityId: '1' },
    } as TunnelMessage

    registry.dispatch('opportunities', message)

    expect(handlerA).toHaveBeenCalledWith(message)
    expect(handlerB).toHaveBeenCalledWith(message)
  })

  it('unsubscribes transport when the last handler is removed', async () => {
    const unsubscribe = jest.fn()
    const transportSubscribe = jest.fn(async () => ({ unsubscribe }))

    const registry = createChannelSubscriptionRegistry({
      subscribeTransport: transportSubscribe,
    })

    const unsubA = registry.subscribe('presence', jest.fn())
    const unsubB = registry.subscribe('presence', jest.fn())

    await Promise.resolve()

    unsubA()
    expect(unsubscribe).not.toHaveBeenCalled()

    unsubB()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
