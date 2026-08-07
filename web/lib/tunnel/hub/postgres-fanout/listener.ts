/**
 * Dedicated pg.Client LISTEN loop for ring_tunnel_fanout.
 * Reconnects with exponential backoff; never shares the app Pool.
 */

import { Client } from 'pg';
import { getTunnelFanoutPgConfig } from './connection-config';
import {
  getTunnelNotifyChannel,
  parseTunnelFanoutEnvelope,
  type TunnelFanoutEnvelope,
} from './envelope';

export type TunnelFanoutEnvelopeHandler = (envelope: TunnelFanoutEnvelope) => void;

export type PostgresTunnelListenerOptions = {
  channel?: string;
  /** Initial reconnect delay ms (doubles up to maxDelayMs). */
  initialDelayMs?: number;
  maxDelayMs?: number;
  onEnvelope: TunnelFanoutEnvelopeHandler;
  onError?: (error: unknown) => void;
  /** Test seam — inject a Client factory. */
  createClient?: () => Client;
};

export type PostgresTunnelListener = {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly isRunning: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPostgresTunnelListener(
  options: PostgresTunnelListenerOptions,
): PostgresTunnelListener {
  const channel = options.channel ?? getTunnelNotifyChannel();
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const createClient = options.createClient ?? (() => new Client(getTunnelFanoutPgConfig()));

  let client: Client | null = null;
  let running = false;
  let stopped = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const handleNotification = (msg: { channel: string; payload?: string }) => {
    if (msg.channel !== channel) return;
    const envelope = parseTunnelFanoutEnvelope(msg.payload ?? '');
    if (!envelope) {
      console.warn('[tunnel-fanout] Ignoring invalid NOTIFY payload');
      return;
    }
    options.onEnvelope(envelope);
  };

  const cleanupClient = async () => {
    if (!client) return;
    const c = client;
    client = null;
    c.removeAllListeners('notification');
    c.removeAllListeners('error');
    c.removeAllListeners('end');
    try {
      await c.end();
    } catch {
      // ignore close errors
    }
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const delay = Math.min(maxDelayMs, initialDelayMs * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    console.warn(`[tunnel-fanout] LISTEN reconnect in ${delay}ms (attempt ${reconnectAttempt})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;
    await cleanupClient();

    const next = createClient();
    client = next;

    next.on('notification', handleNotification);
    next.on('error', (err) => {
      options.onError?.(err);
      console.error('[tunnel-fanout] LISTEN client error:', err instanceof Error ? err.message : err);
      running = false;
      if (!stopped) scheduleReconnect();
    });
    next.on('end', () => {
      running = false;
      if (!stopped) scheduleReconnect();
    });

    try {
      await next.connect();
      await next.query(`LISTEN ${quoteIdent(channel)}`);
      running = true;
      reconnectAttempt = 0;
      console.log(`[tunnel-fanout] LISTEN ${channel} ready`);
    } catch (err) {
      options.onError?.(err);
      console.error(
        '[tunnel-fanout] LISTEN connect failed:',
        err instanceof Error ? err.message : err,
      );
      running = false;
      await cleanupClient();
      if (!stopped) scheduleReconnect();
    }
  };

  return {
    get isRunning() {
      return running;
    },
    async start() {
      if (running || (!stopped && client)) return;
      stopped = false;
      await connect();
    },
    async stop() {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      // Brief yield so in-flight connect can settle before end
      await sleep(0);
      await cleanupClient();
      running = false;
    },
  };
}

/** Safe identifier quoting for LISTEN channel names (alphanumeric + underscore). */
function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid TUNNEL_NOTIFY_CHANNEL: ${name}`);
  }
  return `"${name}"`;
}
