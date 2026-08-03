/**
 * Postgres NOTIFY envelope for cross-pod tunnel fan-out.
 * Channel: ring_tunnel_fanout (logical name — no table required).
 *
 * PostgreSQL NOTIFY payload max is 8000 bytes — refuse oversized payloads
 * (do not truncate).
 */

import type { TunnelMessage } from '../../types';

export const TUNNEL_FANOUT_NOTIFY_CHANNEL_DEFAULT = 'ring_tunnel_fanout';

/** Stay under PG 8000-byte NOTIFY limit with headroom for encoding. */
export const TUNNEL_FANOUT_MAX_PAYLOAD_BYTES = 7900;

export type TunnelFanoutOp = 'user' | 'channel';

export type TunnelFanoutEnvelope = {
  v: 1;
  origin: string;
  op: TunnelFanoutOp;
  userId?: string;
  channel?: string;
  message: TunnelMessage;
};

export class TunnelFanoutPayloadTooLargeError extends Error {
  readonly byteLength: number;

  constructor(byteLength: number, maxBytes: number = TUNNEL_FANOUT_MAX_PAYLOAD_BYTES) {
    super(
      `Tunnel fan-out NOTIFY payload ${byteLength} bytes exceeds max ${maxBytes} (local delivery only)`,
    );
    this.name = 'TunnelFanoutPayloadTooLargeError';
    this.byteLength = byteLength;
  }
}

export function getTunnelNotifyChannel(): string {
  const raw = process.env.TUNNEL_NOTIFY_CHANNEL?.trim();
  return raw && raw.length > 0 ? raw : TUNNEL_FANOUT_NOTIFY_CHANNEL_DEFAULT;
}

export function serializeTunnelFanoutEnvelope(
  envelope: TunnelFanoutEnvelope,
  maxBytes: number = TUNNEL_FANOUT_MAX_PAYLOAD_BYTES,
): string {
  if (envelope.v !== 1) {
    throw new Error(`Unsupported tunnel fan-out envelope version: ${String(envelope.v)}`);
  }
  if (envelope.op === 'user' && !envelope.userId) {
    throw new Error('Tunnel fan-out user op requires userId');
  }
  if (envelope.op === 'channel' && !envelope.channel) {
    throw new Error('Tunnel fan-out channel op requires channel');
  }

  const payload = JSON.stringify(envelope);
  const byteLength = Buffer.byteLength(payload, 'utf8');
  if (byteLength > maxBytes) {
    throw new TunnelFanoutPayloadTooLargeError(byteLength, maxBytes);
  }
  return payload;
}

export function parseTunnelFanoutEnvelope(raw: string): TunnelFanoutEnvelope | null {
  if (!raw || typeof raw !== 'string') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.v !== 1) return null;
  if (typeof obj.origin !== 'string' || obj.origin.length === 0) return null;
  if (obj.op !== 'user' && obj.op !== 'channel') return null;
  if (!obj.message || typeof obj.message !== 'object') return null;

  const message = obj.message as TunnelMessage;
  if (typeof message.id !== 'string' || typeof message.type !== 'string') return null;

  if (obj.op === 'user') {
    if (typeof obj.userId !== 'string' || obj.userId.length === 0) return null;
    return {
      v: 1,
      origin: obj.origin,
      op: 'user',
      userId: obj.userId,
      message,
    };
  }

  if (typeof obj.channel !== 'string' || obj.channel.length === 0) return null;
  return {
    v: 1,
    origin: obj.origin,
    op: 'channel',
    channel: obj.channel,
    message,
  };
}
