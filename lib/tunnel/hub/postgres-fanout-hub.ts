/**
 * Decorator hub: local InMemoryTunnelHub + Postgres LISTEN/NOTIFY cross-pod fan-out.
 * Overrides publishToUser / publishToChannel only; registries stay in-process.
 *
 * Delivery policy (multi-pod safe):
 * - Always assign a stable message.id before local + NOTIFY (same id on all pods).
 * - Use live-only local delivery (no offline/poll ghost queues on the publishing pod).
 * - Remote envelopes also live-only — never offline-queue on a pod that merely heard NOTIFY.
 * - Brief disconnect / truly offline users rely on DB history + FCM; Tunnel replay across
 *   pods would need distributed presence (out of scope for NOTIFY MVP).
 */

import type { TunnelMessage } from '../../types';
import type { InMemoryTunnelHub } from '../in-memory-hub';
import type { PublishToUserResult, TunnelHub, TunnelWsSocket } from '../types';
import type { TunnelFanoutEnvelope } from './postgres-fanout/envelope';
import { getTunnelInstanceId } from './postgres-fanout/instance-id';
import type { PostgresFanoutTransport } from './postgres-fanout/transport';

/** Optional lifecycle for hubs that own background listeners. */
export interface TunnelHubLifecycle {
  startFanout(): Promise<void>;
  stopFanout(): Promise<void>;
}

export function isTunnelHubLifecycle(hub: TunnelHub): hub is TunnelHub & TunnelHubLifecycle {
  return (
    typeof (hub as TunnelHub & Partial<TunnelHubLifecycle>).startFanout === 'function' &&
    typeof (hub as TunnelHub & Partial<TunnelHubLifecycle>).stopFanout === 'function'
  );
}

function ensureFanoutMessageId(message: TunnelMessage): TunnelMessage {
  if (message.id) return message;
  return {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

export class PostgresFanoutTunnelHub implements TunnelHub, TunnelHubLifecycle {
  private readonly instanceId: string;
  private started = false;

  constructor(
    private readonly local: InMemoryTunnelHub,
    private readonly fanout: PostgresFanoutTransport,
    instanceId: string = getTunnelInstanceId(),
  ) {
    this.instanceId = instanceId;
    this.fanout.setHandler((envelope) => this.handleRemoteEnvelope(envelope));
  }

  async startFanout(): Promise<void> {
    if (this.started) return;
    await this.fanout.start();
    this.started = true;
  }

  async stopFanout(): Promise<void> {
    if (!this.started) return;
    await this.fanout.stop();
    this.started = false;
  }

  private handleRemoteEnvelope(envelope: TunnelFanoutEnvelope): void {
    if (envelope.origin === this.instanceId) return;

    if (envelope.op === 'user' && envelope.userId) {
      this.local.publishToUserLive(envelope.userId, envelope.message);
      return;
    }
    if (envelope.op === 'channel' && envelope.channel) {
      this.local.publishToChannelLive(envelope.channel, envelope.message);
    }
  }

  private enqueueFanout(envelope: TunnelFanoutEnvelope): void {
    void this.fanout.notify(envelope);
  }

  // —— publish overrides ——

  publishToUser(userId: string, message: TunnelMessage): PublishToUserResult {
    const msg = ensureFanoutMessageId(message);
    const result = this.local.publishToUserLive(userId, msg);
    this.enqueueFanout({
      v: 1,
      origin: this.instanceId,
      op: 'user',
      userId,
      message: msg,
    });
    return result;
  }

  publishToChannel(channel: string, message: TunnelMessage): void {
    const msg = ensureFanoutMessageId(message);
    this.local.publishToChannelLive(channel, msg);
    this.enqueueFanout({
      v: 1,
      origin: this.instanceId,
      op: 'channel',
      channel,
      message: msg,
    });
  }

  // —— delegated registries / drains ——

  registerSseConnection(userId: string, controller: ReadableStreamDefaultController): void {
    this.local.registerSseConnection(userId, controller);
  }

  unregisterSseConnection(userId: string, controller: ReadableStreamDefaultController): void {
    this.local.unregisterSseConnection(userId, controller);
  }

  registerWsConnection(userId: string, socket: TunnelWsSocket): void {
    this.local.registerWsConnection(userId, socket);
  }

  unregisterWsConnection(userId: string, socket: TunnelWsSocket): void {
    this.local.unregisterWsConnection(userId, socket);
  }

  isUserConnected(userId: string): boolean {
    return this.local.isUserConnected(userId);
  }

  getActiveConnectionCount(): number {
    return this.local.getActiveConnectionCount();
  }

  drainUserQueueForSse(userId: string, maxBatch?: number): TunnelMessage[] {
    return this.local.drainUserQueueForSse(userId, maxBatch);
  }

  drainUserQueue(userId: string, maxBatch?: number): TunnelMessage[] {
    return this.local.drainUserQueue(userId, maxBatch);
  }

  drainUserTelemetryQueue(userId: string, maxBatch?: number): TunnelMessage[] {
    return this.local.drainUserTelemetryQueue(userId, maxBatch);
  }

  drainUserGeneralQueue(userId: string, maxBatch?: number): TunnelMessage[] {
    return this.local.drainUserGeneralQueue(userId, maxBatch);
  }

  drainUserSideEffectQueue(userId: string, maxBatch?: number): TunnelMessage[] {
    return this.local.drainUserSideEffectQueue(userId, maxBatch);
  }

  getUserOfflineQueueDepth(userId: string) {
    return this.local.getUserOfflineQueueDepth(userId);
  }

  setPollSubscriptions(userId: string, channels: string[]): void {
    this.local.setPollSubscriptions(userId, channels);
  }

  getPollSubscriptions(userId: string): ReadonlySet<string> {
    return this.local.getPollSubscriptions(userId);
  }

  collectPollMessages(
    userId: string,
    channels: string[],
    lastMessageId?: string | null,
  ): TunnelMessage[] {
    return this.local.collectPollMessages(userId, channels, lastMessageId);
  }

  clearPollDelivered(userId: string, channels: string[]): void {
    this.local.clearPollDelivered(userId, channels);
  }

  getPollLastMessageId(userId: string): string | undefined {
    return this.local.getPollLastMessageId(userId);
  }

  setPollLastMessageId(userId: string, messageId: string): void {
    this.local.setPollLastMessageId(userId, messageId);
  }

  subscribeChannel(userId: string, channel: string): void {
    this.local.subscribeChannel(userId, channel);
  }

  unsubscribeChannel(userId: string, channel: string): void {
    this.local.unsubscribeChannel(userId, channel);
  }

  getChannelSubscriberCount(channel: string): number {
    return this.local.getChannelSubscriberCount(channel);
  }

  isUserSubscribed(userId: string, channel: string): boolean {
    return this.local.isUserSubscribed(userId, channel);
  }

  clearUserPollQueue(userId: string): void {
    this.local.clearUserPollQueue(userId);
  }

  clearUserSideEffectQueue(userId: string): void {
    this.local.clearUserSideEffectQueue(userId);
  }
}
