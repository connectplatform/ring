/**
 * Tunnel Hub entry — server-side broker singleton.
 */

import { createTunnelMessage, TunnelMessageType } from '../protocol';
import type { TunnelMessage, TunnelProvider } from '../types';
import { TunnelProvider as TunnelProviderEnum } from '../types';
import { InMemoryTunnelHub } from './in-memory-hub';
import { detectTunnelHubMode, usesInMemoryTunnelHub } from './hub-mode-config';
import type { TunnelHub } from './types';

let hubInstance: TunnelHub | null = null;

function createTunnelHub(): TunnelHub {
  const mode = detectTunnelHubMode();

  if (usesInMemoryTunnelHub(mode)) {
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
 * Gated backends (Redis, ConnectPlatform) plug in here — no new connectors in app code.
 */
export function getTunnelHub(): TunnelHub {
  if (!hubInstance) {
    hubInstance = createTunnelHub();
  }
  return hubInstance;
}

/** Test-only reset */
export function resetTunnelHubForTests(): void {
  hubInstance = null;
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
  usesInMemoryTunnelHub,
  type TunnelHubMode,
} from './hub-mode-config';
