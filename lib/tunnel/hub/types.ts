/**
 * Tunnel Hub — server-side fan-out contract (broker plane).
 * Client egress uses TunnelTransport; hub owns connection registries and publish.
 *
 * Implementations: InMemoryHub (today) → RedisHub / ConnectPlatformHub (gated).
 */

import { UserRolesArray } from '@/types';
import type { TunnelMessage } from '../types';

export interface PublishToUserResult {
  sseDelivered: boolean;
  wsDelivered: boolean;
  queued: boolean;
}

/** Minimal WS socket surface for hub fan-out (server-only `ws` package). */
export interface TunnelWsSocket {
  readyState: number;
  send(data: string): void;
}

export interface TunnelHub {
  /** SSE edge: register a streaming controller for a user session. */
  registerSseConnection(userId: string, controller: ReadableStreamDefaultController): void;
  unregisterSseConnection(userId: string, controller: ReadableStreamDefaultController): void;

  /** Native WS: register a socket for a user session. */
  registerWsConnection(userId: string, socket: TunnelWsSocket): void;
  unregisterWsConnection(userId: string, socket: TunnelWsSocket): void;

  isUserConnected(userId: string): boolean;
  getActiveConnectionCount(): number;

  /** Messages queued while user was offline — drain on SSE connect (max batch). */
  drainUserQueueForSse(userId: string, maxBatch?: number): TunnelMessage[];

  /**
   * Legacy combined drain (telemetry + general only). Side-effect channels
   * (`account:status`) are replayed via `drainUserSideEffectQueue` on subscribe.
   */
  drainUserQueue(userId: string, maxBatch?: number): TunnelMessage[];

  /** Telemetry-only offline replay — safe on WS `auth_ok` (capped per channel). */
  drainUserTelemetryQueue(userId: string, maxBatch?: number): TunnelMessage[];

  /** General inbox offline replay (credit balance, notifications, …). */
  drainUserGeneralQueue(userId: string, maxBatch?: number): TunnelMessage[];

  /** Side-effect channels — replay on explicit WS subscribe, stale messages dropped. */
  drainUserSideEffectQueue(userId: string, maxBatch?: number): TunnelMessage[];

  /** Dev/diagnostic: offline backlog depth by queue kind. */
  getUserOfflineQueueDepth(userId: string): {
    telemetry: number;
    sideEffect: number;
    general: number;
  };

  /** Per-user inbox (unread counts, credit balance). */
  publishToUser(userId: string, message: TunnelMessage): PublishToUserResult;

  /** Topic fan-out (conversation:*, matcher, discovery). */
  publishToChannel(channel: string, message: TunnelMessage): void;

  /** Poll transport: channel subscriptions for a poll session. */
  setPollSubscriptions(userId: string, channels: string[]): void;
  getPollSubscriptions(userId: string): ReadonlySet<string>;

  /** Poll transport: fetch pending messages (user inbox + subscribed channels). */
  collectPollMessages(
    userId: string,
    channels: string[],
    lastMessageId?: string | null,
  ): TunnelMessage[];

  clearPollDelivered(userId: string, channels: string[]): void;

  getPollLastMessageId(userId: string): string | undefined;
  setPollLastMessageId(userId: string, messageId: string): void;

  /** Subscribe API: track channel membership. */
  subscribeChannel(userId: string, channel: string): void;
  unsubscribeChannel(userId: string, channel: string): void;
  getChannelSubscriberCount(channel: string): number;
  isUserSubscribed(userId: string, channel: string): boolean;

  clearUserPollQueue(userId: string): void;

  /** Drop accumulated account:status offline backlog for a user. */
  clearUserSideEffectQueue(userId: string): void;
}
