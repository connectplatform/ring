/**
 * In-memory TunnelHub — single registry for SSE + WS + poll + subscriptions.
 * One process / one pod. Replace with RedisHub or ConnectPlatformHub at the seam.
 */

import { deliverMessageToWs } from '../native-ws/frames';
import { MessageConverter } from '../protocol';
import type { TunnelMessage } from '../types';
import type { PublishToUserResult, TunnelHub, TunnelWsSocket } from './types';

const MAX_QUEUE = 100;
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

export class InMemoryTunnelHub implements TunnelHub {
  private sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();
  private wsConnections = new Map<string, Set<TunnelWsSocket>>();
  /** SSE offline drain on reconnect */
  private userSseQueues = new Map<string, TunnelMessage[]>();
  /** Poll long-poll user inbox */
  private userPollQueues = new Map<string, TunnelMessage[]>();
  /** Topic queues for poll subscribers (`channel:${name}`) */
  private channelMessages = new Map<string, TunnelMessage[]>();
  private pollSubscriptions = new Map<string, Set<string>>();
  private userChannelSubscriptions = new Map<string, Set<string>>();
  private channelSubscribers = new Map<string, Set<string>>();
  private pollLastMessageIds = new Map<string, string>();

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

  drainUserQueueForSse(userId: string, maxBatch = 10): TunnelMessage[] {
    const queue = this.userSseQueues.get(userId);
    if (!queue || queue.length === 0) return [];

    const batch = queue.splice(0, maxBatch);
    if (queue.length === 0) {
      this.userSseQueues.delete(userId);
    }
    return batch;
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
          pushQueue(this.userSseQueues, userId, message);
        }
      }
    });
  }

  publishToUser(userId: string, message: TunnelMessage): PublishToUserResult {
    const msg = ensureMessageId(message);
    const sseDelivered = this.deliverSseToUser(userId, msg);
    const wsDelivered = this.deliverWsToUser(userId, msg);

    if (!sseDelivered && !wsDelivered) {
      pushQueue(this.userSseQueues, userId, msg);
    }

    pushQueue(this.userPollQueues, userId, msg);

    return { sseDelivered, wsDelivered, queued: true };
  }

  publishToChannel(channel: string, message: TunnelMessage): void {
    const msg = ensureMessageId(message);

    this.sseConnections.forEach((_connections, userId) => {
      const delivered = this.deliverSseToUser(userId, msg);
      if (!delivered) {
        pushQueue(this.userSseQueues, userId, msg);
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
