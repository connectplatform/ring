import { PostgresFanoutTunnelHub } from '@/lib/tunnel/hub/postgres-fanout-hub'
import type { PostgresFanoutTransport } from '@/lib/tunnel/hub/postgres-fanout/transport'
import type { TunnelFanoutEnvelope } from '@/lib/tunnel/hub/postgres-fanout/envelope'
import type { PublishToUserResult } from '@/lib/tunnel/hub/types'
import { TunnelMessageType, type TunnelMessage } from '@/lib/tunnel/types'

/** Structural stand-in — avoid importing InMemoryTunnelHub (pulls nanoid via protocol in Jest). */
type LocalHubLike = {
  publishToUser(userId: string, message: TunnelMessage): PublishToUserResult
  publishToChannel(channel: string, message: TunnelMessage): void
}

function createMockTransport(): PostgresFanoutTransport & {
  envelopes: TunnelFanoutEnvelope[]
  emitRemote(envelope: TunnelFanoutEnvelope): void
} {
  let handler: ((envelope: TunnelFanoutEnvelope) => void) | null = null
  const envelopes: TunnelFanoutEnvelope[] = []

  return {
    envelopes,
    setHandler(next) {
      handler = next
    },
    async start() {},
    async stop() {},
    async notify(envelope) {
      envelopes.push(envelope)
    },
    emitRemote(envelope) {
      handler?.(envelope)
    },
  }
}

/** Minimal local hub stand-in — avoids pulling nanoid via InMemoryTunnelHub in Jest. */
function createMockLocalHub() {
  const publishedUsers: Array<{ userId: string; message: TunnelMessage }> = []
  const publishedChannels: Array<{ channel: string; message: TunnelMessage }> = []

  const local: LocalHubLike & {
    publishedUsers: typeof publishedUsers
    publishedChannels: typeof publishedChannels
  } = {
    publishedUsers,
    publishedChannels,
    publishToUser(userId: string, message: TunnelMessage): PublishToUserResult {
      publishedUsers.push({ userId, message })
      return { sseDelivered: false, wsDelivered: true, queued: true }
    },
    publishToChannel(channel: string, message: TunnelMessage): void {
      publishedChannels.push({ channel, message })
    },
  }

  return local
}

function wrapHub(local: LocalHubLike, transport: PostgresFanoutTransport, instanceId: string) {
  // Constructor is typed to InMemoryTunnelHub; tests inject a structural mock.
  return new PostgresFanoutTunnelHub(local as never, transport, instanceId)
}

describe('PostgresFanoutTunnelHub', () => {
  it('delivers locally and NOTIFYs on publishToUser', async () => {
    const local = createMockLocalHub()
    const transport = createMockTransport()
    const hub = wrapHub(local, transport, 'pod-a:1')
    await hub.startFanout()

    const result = hub.publishToUser('user-1', {
      id: 'm1',
      type: TunnelMessageType.NOTIFICATION,
      channel: 'credit:balance',
      event: 'update',
      payload: { balance: 42 },
      metadata: { timestamp: Date.now() },
    })

    expect(result.wsDelivered).toBe(true)
    expect(local.publishedUsers).toHaveLength(1)
    expect(transport.envelopes).toHaveLength(1)
    expect(transport.envelopes[0]).toMatchObject({
      v: 1,
      origin: 'pod-a:1',
      op: 'user',
      userId: 'user-1',
    })
  })

  it('applies remote envelopes to local hub and skips self-echo', async () => {
    const localA = createMockLocalHub()
    const localB = createMockLocalHub()
    const transportA = createMockTransport()
    const transportB = createMockTransport()

    const hubA = wrapHub(localA, transportA, 'pod-a:1')
    const hubB = wrapHub(localB, transportB, 'pod-b:2')
    await hubA.startFanout()
    await hubB.startFanout()

    hubA.publishToUser('user-1', {
      id: 'cross',
      type: TunnelMessageType.NOTIFICATION,
      channel: 'notifications',
      event: 'update',
      payload: { text: 'hi' },
      metadata: { timestamp: Date.now() },
    })

    const envelope = transportA.envelopes[0]!
    transportA.emitRemote(envelope)
    transportB.emitRemote(envelope)

    // Self-echo on A must not call local.publish again
    expect(localA.publishedUsers).toHaveLength(1)
    expect(localB.publishedUsers).toHaveLength(1)
    expect(localB.publishedUsers[0]!.message.id).toBe('cross')
  })

  it('does not re-NOTIFY when applying a remote envelope', async () => {
    const local = createMockLocalHub()
    const transport = createMockTransport()
    const hub = wrapHub(local, transport, 'pod-b:2')
    await hub.startFanout()

    transport.emitRemote({
      v: 1,
      origin: 'pod-a:1',
      op: 'user',
      userId: 'user-9',
      message: {
        id: 'remote-1',
        type: TunnelMessageType.DATA,
        channel: 'x',
        payload: {},
        metadata: { timestamp: 1 },
      },
    })

    expect(transport.envelopes).toHaveLength(0)
    expect(local.publishedUsers).toHaveLength(1)
  })
})
