/**
 * Tunnel Hub entry — server-side broker singleton.
 */

import { createTunnelMessage, TunnelMessageType } from '../protocol';
import type { TunnelMessage, TunnelProvider } from '../types';
import { TunnelProvider as TunnelProviderEnum } from '../types';
import { InMemoryTunnelHub } from './in-memory-hub';
import type { TunnelHub } from './types';

let hubInstance: TunnelHub | null = null;

/**
 * Returns the active hub implementation.
 * Gated backends (Redis, ConnectPlatform) plug in here — no new connectors in app code.
 */
export function getTunnelHub(): TunnelHub {
  if (!hubInstance) {
    hubInstance = new InMemoryTunnelHub();
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
