/**
 * Tunnel Hub entry — server-side broker singleton.
 */

import { createTunnelMessage, TunnelMessageType } from '../protocol';
import type { TunnelMessage, TunnelProvider } from '../types';
import { TunnelProvider as TunnelProviderEnum } from '../types';
import { InMemoryTunnelHub } from './in-memory-hub';
import {
  detectTunnelHubMode,
  isPostgresFanoutEnabled,
  usesInMemoryTunnelHub,
} from './hub-mode-config';
import {
  isTunnelHubLifecycle,
  PostgresFanoutTunnelHub,
} from './postgres-fanout-hub';
import { createPostgresFanoutTransport } from './postgres-fanout';
import type { TunnelHub } from './types';

let hubInstance: TunnelHub | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __RING_TUNNEL_HUB__: TunnelHub | undefined
}

function createTunnelHub(): TunnelHub {
  const mode = detectTunnelHubMode();

  if (usesInMemoryTunnelHub(mode)) {
    if (mode === 'k8s-postgres' && isPostgresFanoutEnabled()) {
      const local = new InMemoryTunnelHub();
      return new PostgresFanoutTunnelHub(local, createPostgresFanoutTransport());
    }
    return new InMemoryTunnelHub();
  }

  if (mode === 'redis') {
    throw new Error(
      'TUNNEL_HUB_MODE=redis is not implemented. Use memory or k8s-postgres for single-replica, or deploy Redis hub per native_wss_prod_wiring plan.',
    );
  }

  if (mode === 'connect') {
    throw new Error(
      'TUNNEL_HUB_MODE=connect is not implemented. Use memory or k8s-postgres for single-replica.',
    );
  }

  throw new Error(`Unsupported TUNNEL_HUB_MODE: ${mode as string}`);
}

/**
 * Returns the active hub implementation.
 * Gated backends (Redis, ConnectPlatform, Postgres fan-out) plug in here — no new connectors in app code.
 *
 * globalThis singleton (firebase-admin.server.ts pattern): the standalone
 * custom server (node --import tsx server.ts → attachTunnelWss) and Next's
 * compiled route-handler chunks hold SEPARATE module instances — a bare
 * module-level `hubInstance` produced TWO hubs: WS connections registered in
 * the server's hub, publishes from Server Actions/API routes went to the
 * chunks' hub → "no live socket" on every publish, dead queue replay, offline
 * presence (2026-11-15 greenfood live-chat outage). globalThis unifies both.
 */
export function getTunnelHub(): TunnelHub {
  if (!globalThis.__RING_TUNNEL_HUB__) {
    globalThis.__RING_TUNNEL_HUB__ = createTunnelHub();
    hubInstance = globalThis.__RING_TUNNEL_HUB__;
  }
  return globalThis.__RING_TUNNEL_HUB__;
}

/** Test-only reset */
export function resetTunnelHubForTests(): void {
  hubInstance = null;
  globalThis.__RING_TUNNEL_HUB__ = undefined;
}

/** Test-only: clear fan-out singleton after toggling TUNNEL_POSTGRES_FANOUT. */
export function resetPostgresFanoutForTests(): void {
  hubInstance = null;
  globalThis.__RING_TUNNEL_HUB__ = undefined;
}

export function buildTunnelMessage(
  channel: string,
  event: string,
  payload: unknown,
  options?: { userId?: string; type?: TunnelMessageType; provider?: TunnelProvider },
): TunnelMessage {
  return createTunnelMessage(options?.type ?? TunnelMessageType.DATA, payload, {
    channel,
    event,
    userId: options?.userId,
    provider: options?.provider ?? TunnelProviderEnum.SSE,
  });
}

export type { TunnelHub, PublishToUserResult } from './types';
export { InMemoryTunnelHub } from './in-memory-hub';
export {
  detectTunnelHubMode,
  getTunnelHubModeDescription,
  isPostgresFanoutEnabled,
  usesInMemoryTunnelHub,
  type TunnelHubMode,
} from './hub-mode-config';
export {
  isTunnelHubLifecycle,
  PostgresFanoutTunnelHub,
  type TunnelHubLifecycle,
} from './postgres-fanout-hub';
