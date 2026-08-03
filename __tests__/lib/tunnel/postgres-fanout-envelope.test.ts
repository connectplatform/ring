import {
  TUNNEL_FANOUT_MAX_PAYLOAD_BYTES,
  TunnelFanoutPayloadTooLargeError,
  parseTunnelFanoutEnvelope,
  serializeTunnelFanoutEnvelope,
  type TunnelFanoutEnvelope,
} from '@/lib/tunnel/hub/postgres-fanout/envelope';
import { TunnelMessageType } from '@/lib/tunnel/types';

function sampleEnvelope(overrides: Partial<TunnelFanoutEnvelope> = {}): TunnelFanoutEnvelope {
  return {
    v: 1,
    origin: 'pod-a:1',
    op: 'user',
    userId: 'user-1',
    message: {
      id: 'msg-1',
      type: TunnelMessageType.NOTIFICATION,
      channel: 'credit:balance',
      event: 'update',
      payload: { balance: 10 },
      metadata: { timestamp: 1 },
    },
    ...overrides,
  };
}

describe('tunnel fan-out envelope', () => {
  it('round-trips serialize/parse for user op', () => {
    const raw = serializeTunnelFanoutEnvelope(sampleEnvelope());
    const parsed = parseTunnelFanoutEnvelope(raw);
    expect(parsed).toEqual(sampleEnvelope());
  });

  it('round-trips channel op', () => {
    const envelope = sampleEnvelope({
      op: 'channel',
      userId: undefined,
      channel: 'conversation:abc',
    });
    const parsed = parseTunnelFanoutEnvelope(serializeTunnelFanoutEnvelope(envelope));
    expect(parsed?.op).toBe('channel');
    expect(parsed?.channel).toBe('conversation:abc');
  });

  it('rejects oversized payloads without truncating', () => {
    const huge = sampleEnvelope({
      message: {
        id: 'big',
        type: TunnelMessageType.DATA,
        payload: 'x'.repeat(TUNNEL_FANOUT_MAX_PAYLOAD_BYTES),
        metadata: { timestamp: 1 },
      },
    });
    expect(() => serializeTunnelFanoutEnvelope(huge)).toThrow(TunnelFanoutPayloadTooLargeError);
  });

  it('returns null for invalid / wrong version payloads', () => {
    expect(parseTunnelFanoutEnvelope('not-json')).toBeNull();
    expect(parseTunnelFanoutEnvelope(JSON.stringify({ v: 2, origin: 'x', op: 'user' }))).toBeNull();
    expect(
      parseTunnelFanoutEnvelope(
        JSON.stringify({ v: 1, origin: 'x', op: 'user', message: { id: '1' } }),
      ),
    ).toBeNull();
  });

  it('preserves origin for self-echo checks', () => {
    const parsed = parseTunnelFanoutEnvelope(
      serializeTunnelFanoutEnvelope(sampleEnvelope({ origin: 'pod-b:99' })),
    );
    expect(parsed?.origin).toBe('pod-b:99');
  });
});
