/**
 * Postgres fan-out transport: LISTEN + NOTIFY on ring_tunnel_fanout.
 * NOTIFY uses a short-lived Client (not the app Pool / not shared-pg-pool)
 * so this module stays free of `server-only` for hub factory imports.
 */

import { Client } from 'pg';
import { getTunnelFanoutPgConfig } from './connection-config';
import {
  getTunnelNotifyChannel,
  TunnelFanoutPayloadTooLargeError,
  type TunnelFanoutEnvelope,
} from './envelope';
import { createPostgresTunnelListener, type PostgresTunnelListener } from './listener';
import { notifyTunnelFanout, type NotifyQueryFn } from './publisher';

export type PostgresFanoutTransport = {
  start(): Promise<void>;
  stop(): Promise<void>;
  notify(envelope: TunnelFanoutEnvelope): Promise<void>;
  setHandler(handler: (envelope: TunnelFanoutEnvelope) => void): void;
};

export type CreatePostgresFanoutTransportOptions = {
  channel?: string;
  /** Inject NOTIFY query (tests). Default: one-shot pg.Client. */
  notifyQuery?: NotifyQueryFn;
  /** Inject listener (tests). */
  listenerFactory?: (
    onEnvelope: (envelope: TunnelFanoutEnvelope) => void,
  ) => PostgresTunnelListener;
};

async function notifyViaEphemeralClient(
  text: string,
  values?: unknown[],
): Promise<unknown> {
  const client = new Client(getTunnelFanoutPgConfig());
  try {
    await client.connect();
    return await client.query(text, values);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function createPostgresFanoutTransport(
  options: CreatePostgresFanoutTransportOptions = {},
): PostgresFanoutTransport {
  const channel = options.channel ?? getTunnelNotifyChannel();
  let handler: ((envelope: TunnelFanoutEnvelope) => void) | null = null;
  let listener: PostgresTunnelListener | null = null;

  const onEnvelope = (envelope: TunnelFanoutEnvelope) => {
    handler?.(envelope);
  };

  return {
    setHandler(next) {
      handler = next;
    },
    async start() {
      if (listener) return;
      listener =
        options.listenerFactory?.(onEnvelope) ??
        createPostgresTunnelListener({
          channel,
          onEnvelope,
        });
      await listener.start();
    },
    async stop() {
      if (!listener) return;
      await listener.stop();
      listener = null;
    },
    async notify(envelope) {
      try {
        const query: NotifyQueryFn = options.notifyQuery ?? notifyViaEphemeralClient;
        await notifyTunnelFanout(query, envelope, channel);
      } catch (err) {
        if (err instanceof TunnelFanoutPayloadTooLargeError) {
          console.warn(`[tunnel-fanout] ${err.message}`);
          return;
        }
        console.error(
          '[tunnel-fanout] NOTIFY failed (local delivery retained):',
          err instanceof Error ? err.message : err,
        );
      }
    },
  };
}
