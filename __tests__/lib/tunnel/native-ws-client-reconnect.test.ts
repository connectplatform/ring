jest.mock('@/lib/tunnel/protocol', () => ({
  MessageConverter: {
    fromNativeWs: (data: unknown) => data,
  },
}))

import { computeReconnectDelay, TUNNEL_RECONNECT_MAX_DELAY_MS } from '@/lib/tunnel/reconnect-backoff'
import { NativeWsClient } from '@/lib/tunnel/native-ws/client'
import { encodeFrame } from '@/lib/tunnel/native-ws/frames'

type Handler = ((ev?: { data?: string }) => void) | null

class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  onopen: Handler = null
  onclose: Handler = null
  onerror: Handler = null
  onmessage: Handler = null
  sent: string[] = []
  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    // Defer open so NativeWsClient can attach handlers after `new WebSocket`.
    void Promise.resolve().then(() => {
      if (this.readyState !== MockWebSocket.CONNECTING) return
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    })
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  deliver(frame: object): void {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }
}

async function flushMicrotasks(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

describe('computeReconnectDelay', () => {
  it('doubles from base and caps at max', () => {
    expect(computeReconnectDelay(1, 1000)).toBe(1000)
    expect(computeReconnectDelay(2, 1000)).toBe(2000)
    expect(computeReconnectDelay(3, 1000)).toBe(4000)
    expect(computeReconnectDelay(10, 1000)).toBe(TUNNEL_RECONNECT_MAX_DELAY_MS)
  })
})

describe('NativeWsClient auto-reconnect', () => {
  const originalWebSocket = global.WebSocket
  const originalFetch = global.fetch

  beforeEach(() => {
    MockWebSocket.instances = []
    // @ts-expect-error mock browser WebSocket
    global.WebSocket = MockWebSocket
    let tokenN = 0
    global.fetch = jest.fn(async () => {
      tokenN += 1
      return {
        ok: true,
        json: async () => ({ token: `tok-${tokenN}` }),
      } as Response
    }) as unknown as typeof fetch
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    global.WebSocket = originalWebSocket
    global.fetch = originalFetch
  })

  async function connectAuthed(client: NativeWsClient): Promise<MockWebSocket> {
    const pending = client.connect()
    await flushMicrotasks()
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    if (!ws) throw new Error('MockWebSocket was not constructed')
    // Open may already have run via microtask; ensure OPEN + auth frame.
    if (ws.readyState !== MockWebSocket.OPEN) {
      ws.readyState = MockWebSocket.OPEN
      ws.onopen?.()
      await flushMicrotasks()
    }
    ws.deliver({ op: 'auth_ok', userId: 'u1' })
    await pending
    return ws
  }

  it('schedules reconnect and resubscribes channels after unexpected close', async () => {
    const client = new NativeWsClient({
      url: 'ws://localhost/api/tunnel/ws',
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 60_000,
    })

    const reconnects: number[] = []
    client.on('reconnect', ({ attempt }: { attempt: number }) => {
      reconnects.push(attempt)
    })

    const first = await connectAuthed(client)
    client.subscribe('credit:balance')
    expect(first.sent.some((s) => s.includes('"op":"subscribe"') && s.includes('credit:balance'))).toBe(
      true,
    )

    first.close()
    expect(reconnects).toEqual([1])
    expect(client.getState().status).toBe('reconnecting')

    await jest.advanceTimersByTimeAsync(1000)
    await flushMicrotasks(16)

    const second = MockWebSocket.instances[MockWebSocket.instances.length - 1]!
    expect(second).not.toBe(first)
    expect(global.fetch).toHaveBeenCalledTimes(2)

    if (second.readyState !== MockWebSocket.OPEN) {
      second.readyState = MockWebSocket.OPEN
      second.onopen?.()
      await flushMicrotasks()
    }
    expect(second.sent.some((s) => s.includes('"op":"auth"'))).toBe(true)

    second.deliver({ op: 'auth_ok', userId: 'u1' })
    await flushMicrotasks()

    expect(client.getState().status).toBe('connected')
    expect(client.getState().reconnectAttempts).toBe(0)
    expect(
      second.sent.some((s) => s.includes('"op":"subscribe"') && s.includes('credit:balance')),
    ).toBe(true)
  })

  it('does not reconnect after intentional disconnect()', async () => {
    const client = new NativeWsClient({
      url: 'ws://localhost/api/tunnel/ws',
      reconnectDelay: 100,
      maxReconnectAttempts: 5,
    })

    const reconnects: number[] = []
    client.on('reconnect', ({ attempt }: { attempt: number }) => reconnects.push(attempt))

    await connectAuthed(client)
    client.disconnect()
    expect(client.getState().status).toBe('disconnected')

    await jest.advanceTimersByTimeAsync(5000)
    expect(reconnects).toEqual([])
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('emits disconnected after max reconnect attempts', async () => {
    const client = new NativeWsClient({
      url: 'ws://localhost/api/tunnel/ws',
      reconnectDelay: 10,
      maxReconnectAttempts: 2,
      heartbeatInterval: 60_000,
    })

    const disconnects: number[] = []
    client.on('disconnected', () => {
      disconnects.push(1)
    })
    client.on('error', () => {
      /* swallow — EventEmitter requires an error listener */
    })

    const first = await connectAuthed(client)
    first.close()

    for (let i = 0; i < 4; i++) {
      await jest.advanceTimersByTimeAsync(200)
      await flushMicrotasks(16)
      const latest = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      if (latest && latest.readyState !== MockWebSocket.CLOSED) {
        latest.close()
      }
      await flushMicrotasks()
    }

    expect(disconnects.length).toBeGreaterThanOrEqual(1)
    expect(client.getState().status).toMatch(/error|disconnected/)
  })

  it('aborts in-flight connect when disconnect() is called', async () => {
    const client = new NativeWsClient({
      url: 'ws://localhost/api/tunnel/ws',
      reconnectDelay: 100,
      maxReconnectAttempts: 5,
    })

    let connected = false
    client.on('connected', () => {
      connected = true
    })

    const pending = client.connect()
    await flushMicrotasks(4)
    client.disconnect()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await flushMicrotasks(16)
    expect(connected).toBe(false)
    expect(client.getState().status).toBe('disconnected')
    expect(client.isConnected).toBe(false)
  })

  it('encodes auth frame on open', async () => {
    const client = new NativeWsClient({ url: 'ws://localhost/api/tunnel/ws' })
    const pending = client.connect()
    await flushMicrotasks(16)
    const ws = MockWebSocket.instances[0]
    if (!ws) throw new Error('MockWebSocket was not constructed')
    if (ws.readyState !== MockWebSocket.OPEN) {
      ws.readyState = MockWebSocket.OPEN
      ws.onopen?.()
      await flushMicrotasks()
    }
    expect(ws.sent[0]).toBe(encodeFrame({ op: 'auth', token: 'tok-1' }))
    ws.deliver({ op: 'auth_ok', userId: 'u1' })
    await pending
  })
})
