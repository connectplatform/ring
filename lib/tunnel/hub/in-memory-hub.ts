/**
 * In-memory TunnelHub — single registry for SSE + WS + poll + subscriptions.
 * One process / one pod. Replace with RedisHub or ConnectPlatformHub at the seam.
 */

import { deliverMessageToWs } from '../native-ws/frames';
import { MessageConverter } from '../protocol';
import type { TunnelMessage } from '../types';
import type { PublishToUserResult, TunnelHub, TunnelWsSocket } from './types';
import {
  classifyUserQueueChannel,
  isSideEffectMessageFresh,
  type UserQueueKind,
} from './queue-routing';

const MAX_QUEUE = 100;
const MAX_DELIVERED_IDS = 200;
const encoder = new TextEncoder();

function ensureMessageId(message: TunnelMessage): TunnelMessage {
  if (message.id) return message;
  return {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

function pushQueue(map: Map<string, TunnelMessage[]>, key: string, message: TunnelMessage): void {
  const msg = ensureMessageId(message);
  if (!map.has(key)) map.set(key, []);
  const queue = map.get(key)!;
  queue.push(msg);
  if (queue.length > MAX_QUEUE) queue.shift();
}

function payloadAt(message: TunnelMessage): string | undefined {
  const payload = message.payload as { at?: string } | undefined;
  return payload?.at;
}

export class InMemoryTunnelHub implements TunnelHub {
  private sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();
  private wsConnections = new Map<string, Set<TunnelWsSocket>>();
  /** General per-user inbox (credit balance, notifications, …) */
  private userGeneralQueues = new Map<string, TunnelMessage[]>();
  /** Telemetry fan-out — safe to replay on WS auth_ok (capped per channel) */
  private userTelemetryQueues = new Map<string, TunnelMessage[]>();
  /** UI/session side effects — replay only on explicit channel subscribe */
  private userSideEffectQueues = new Map<string, TunnelMessage[]>();
  /** Poll long-poll user inbox */
  private userPollQueues = new Map<string, TunnelMessage[]>();
  /** Topic queues for poll subscribers (`channel:${name}`) */
  private channelMessages = new Map<string, TunnelMessage[]>();
  private pollSubscriptions = new Map<string, Set<string>>();
  private userChannelSubscriptions = new Map<string, Set<string>>();
  private channelSubscribers = new Map<string, Set<string>>();
  private pollLastMessageIds = new Map<string, string>();
  /** Cross-transport dedupe — prevents SSE + WS double delivery */
  private deliveredMessageIds = new Map<string, Set<string>>();

  registerSseConnection(userId: string, controller: ReadableStreamDefaultController): void {
    if (!this.sseConnections.has(userId)) {
      this.sseConnections.set(userId, new Set());
    }
    this.sseConnections.get(userId)!.add(controller);
  }

  unregisterSseConnection(userId: string, controller: ReadableStreamDefaultController): void {
    const connections = this.sseConnections.get(userId);
    if (!connections) return;
    connections.delete(controller);
    if (connections.size === 0) {
      this.sseConnections.delete(userId);
    }
  }

  registerWsConnection(userId: string, socket: TunnelWsSocket): void {
    if (!this.wsConnections.has(userId)) {
      this.wsConnections.set(userId, new Set());
    }
    this.wsConnections.get(userId)!.add(socket);
  }

  unregisterWsConnection(userId: string, socket: TunnelWsSocket): void {
    const connections = this.wsConnections.get(userId);
    if (!connections) return;
    connections.delete(socket);
    if (connections.size === 0) {
      this.wsConnections.delete(userId);
    }
  }

  isUserConnected(userId: string): boolean {
    const sse = this.sseConnections.get(userId);
    const ws = this.wsConnections.get(userId);
    return Boolean((sse && sse.size > 0) || (ws && ws.size > 0));
  }

  getActiveConnectionCount(): number {
    const users = new Set<string>([
      ...this.sseConnections.keys(),
      ...this.wsConnections.keys(),
    ]);
    return users.size;
  }

  getUserOfflineQueueDepth(userId: string): { telemetry: number; sideEffect: number; general: number } {
    return {
      telemetry: this.userTelemetryQueues.get(userId)?.length ?? 0,
      sideEffect: this.userSideEffectQueues.get(userId)?.length ?? 0,
      general: this.userGeneralQueues.get(userId)?.length ?? 0,
    };
  }

  private queueForKind(kind: UserQueueKind): Map<string, TunnelMessage[]> {
    switch (kind) {
      case 'telemetry':
        return this.userTelemetryQueues;
      case 'sideEffect':
        return this.userSideEffectQueues;
      default:
        return this.userGeneralQueues;
    }
  }

  private markDelivered(userId: string, messageId: string | undefined): boolean {
    if (!messageId) return true;
    if (!this.deliveredMessageIds.has(userId)) {
      this.deliveredMessageIds.set(userId, new Set());
    }
    const set = this.deliveredMessageIds.get(userId)!;
    if (set.has(messageId)) return false;
    set.add(messageId);
    if (set.size > MAX_DELIVERED_IDS) {
      const oldest = set.values().next().value;
      if (oldest) set.delete(oldest);
    }
    return true;
  }

  private spliceQueue(
    map: Map<string, TunnelMessage[]>,
    userId: string,
    maxBatch: number,
    filter?: (message: TunnelMessage) => boolean,
    /** When true, stale/filtered messages are dropped instead of re-queued forever. */
    dropFiltered = false,
  ): TunnelMessage[] {
    const queue = map.get(userId);
    if (!queue || queue.length === 0) return [];

    const batch: TunnelMessage[] = [];
    const remaining: TunnelMessage[] = [];

    for (const message of queue) {
      if (batch.length >= maxBatch) {
        remaining.push(message);
        continue;
      }
      if (filter && !filter(message)) {
        if (!dropFiltered) {
          remaining.push(message);
        }
        continue;
      }
      if (!this.markDelivered(userId, message.id)) {
        continue;
      }
      batch.push(message);
    }

    if (remaining.length === 0) {
      map.delete(userId);
    } else {
      map.set(userId, remaining);
    }

    return batch;
  }

  /** Keep only the newest account-reactivate notification in a drain batch. */
  private collapseReactivateSideEffects(messages: TunnelMessage[]): TunnelMessage[] {
    let latestReactivate: TunnelMessage | null = null;
    let latestAt = 0;
    const rest: TunnelMessage[] = [];

    for (const message of messages) {
      const payload = message.payload as { type?: string; at?: string } | undefined;
      if (payload?.type === 'account-reactivate-notification') {
        const ts = Date.parse(payload.at ?? '') || 0;
        if (!latestReactivate || ts >= latestAt) {
          latestReactivate = message;
          latestAt = ts;
        }
        continue;
      }
      rest.push(message);
    }

    if (latestReactivate) {
      rest.push(latestReactivate);
    }
    return rest;
  }

  drainUserQueueForSse(userId: string, maxBatch = 10): TunnelMessage[] {
    const telemetry = this.drainUserTelemetryQueue(userId, maxBatch);
    const general = this.drainUserGeneralQueue(userId, Math.max(0, maxBatch - telemetry.length));
    return [...telemetry, ...general];
  }

  /** @deprecated Prefer drainUserTelemetryQueue + drainUserGeneralQueue; kept for callers expecting combined drain without side effects. */
  drainUserQueue(userId: string, maxBatch = 10): TunnelMessage[] {
    return this.drainUserQueueForSse(userId, maxBatch);
  }

  drainUserTelemetryQueue(userId: string, maxBatch = 10): TunnelMessage[] {
    const batch = this.spliceQueue(this.userTelemetryQueues, userId, maxBatch);
    // Cap replay to the latest message per telemetry channel
    const byChannel = new Map<string, TunnelMessage>();
    for (const message of batch) {
      const channel = message.channel ?? 'telemetry:unknown';
      byChannel.set(channel, message);
    }
    return Array.from(byChannel.values());
  }

  drainUserGeneralQueue(userId: string, maxBatch = 10): TunnelMessage[] {
    return this.spliceQueue(this.userGeneralQueues, userId, maxBatch);
  }

  drainUserSideEffectQueue(userId: string, maxBatch = 3): TunnelMessage[] {
    const batch = this.spliceQueue(
      this.userSideEffectQueues,
      userId,
      maxBatch,
      (message) => isSideEffectMessageFresh(payloadAt(message)),
      true,
    );
    return this.collapseReactivateSideEffects(batch);
  }

  /** Dev-only: purge all offline side-effect messages (e.g. after auth migration). */
  clearUserSideEffectQueue(userId: string): void {
    this.userSideEffectQueues.delete(userId);
  }

  private deliverSseToUser(userId: string, message: TunnelMessage): boolean {
    const connections = this.sseConnections.get(userId);
    if (!connections || connections.size === 0) return false;

    const data = encoder.encode(MessageConverter.toSSE(message));
    let delivered = false;
    connections.forEach((controller) => {
      try {
        controller.enqueue(data);
        delivered = true;
      } catch {
        // connection closed — cleaned up on abort
      }
    });
    return delivered;
  }

  private deliverWsToUser(userId: string, message: TunnelMessage): boolean {
    const connections = this.wsConnections.get(userId);
    if (!connections || connections.size === 0) return false;

    let delivered = false;
    connections.forEach((socket) => {
      if (deliverMessageToWs(socket, message)) {
        delivered = true;
      }
    });
    return delivered;
  }

  private deliverToChannelSubscribers(channel: string, message: TunnelMessage): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) return;

    subscribers.forEach((userId) => {
      const wsDelivered = this.deliverWsToUser(userId, message);
      if (!wsDelivered) {
        const sseDelivered = this.deliverSseToUser(userId, message);
        if (!sseDelivered) {
          this.enqueueOffline(userId, message);
        }
      }
    });
  }

  private enqueueOffline(userId: string, message: TunnelMessage): void {
    const kind = classifyUserQueueChannel(message.channel);
    pushQueue(this.queueForKind(kind), userId, message);
  }

  publishToUser(userId: string, message: TunnelMessage): PublishToUserResult {
    const msg = ensureMessageId(message);
    const sseDelivered = this.deliverSseToUser(userId, msg);
    const wsDelivered = this.deliverWsToUser(userId, msg);

    if (!sseDelivered && !wsDelivered) {
      this.enqueueOffline(userId, msg);
    }

    pushQueue(this.userPollQueues, userId, msg);

    return { sseDelivered, wsDelivered, queued: true };
  }

  publishToChannel(channel: string, message: TunnelMessage): void {
    const msg = ensureMessageId(message);

    this.sseConnections.forEach((_connections, userId) => {
      const delivered = this.deliverSseToUser(userId, msg);
      if (!delivered) {
        this.enqueueOffline(userId, msg);
      }
    });

    this.deliverToChannelSubscribers(channel, msg);

    pushQueue(this.channelMessages, `channel:${channel}`, msg);
  }

  setPollSubscriptions(userId: string, channels: string[]): void {
    this.pollSubscriptions.set(userId, new Set(channels));
  }

  getPollSubscriptions(userId: string): ReadonlySet<string> {
    return this.pollSubscriptions.get(userId) ?? new Set();
  }

  collectPollMessages(
    userId: string,
    channels: string[],
    lastMessageId?: string | null,
  ): TunnelMessage[] {
    const userQueue = this.userPollQueues.get(userId) ?? [];
    const channelMsgs = channels.flatMap((ch) => this.channelMessages.get(`channel:${ch}`) ?? []);
    const all = [...userQueue, ...channelMsgs];

    if (!lastMessageId) return all;
    return all.filter((msg) => msg.id > lastMessageId);
  }

  clearPollDelivered(userId: string, channels: string[]): void {
    this.userPollQueues.set(userId, []);
    channels.forEach((ch) => {
      this.channelMessages.delete(`channel:${ch}`);
    });
  }

  getPollLastMessageId(userId: string): string | undefined {
    return this.pollLastMessageIds.get(userId);
  }

  setPollLastMessageId(userId: string, messageId: string): void {
    this.pollLastMessageIds.set(userId, messageId);
  }

  subscribeChannel(userId: string, channel: string): void {
    if (!this.userChannelSubscriptions.has(userId)) {
      this.userChannelSubscriptions.set(userId, new Set());
    }
    this.userChannelSubscriptions.get(userId)!.add(channel);

    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)!.add(userId);
  }

  unsubscribeChannel(userId: string, channel: string): void {
    this.userChannelSubscriptions.get(userId)?.delete(channel);
    this.channelSubscribers.get(channel)?.delete(userId);
  }

  getChannelSubscriberCount(channel: string): number {
    return this.channelSubscribers.get(channel)?.size ?? 0;
  }

  isUserSubscribed(userId: string, channel: string): boolean {
    return this.userChannelSubscriptions.get(userId)?.has(channel) ?? false;
  }

  clearUserPollQueue(userId: string): void {
    this.userPollQueues.delete(userId);
  }
}
