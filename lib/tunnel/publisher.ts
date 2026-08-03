/**
 * Tunnel Publisher
 *
 * - `publishToChannel`: topic channels (conversation:xyz, matcher, …)
 * - `publishToUserTunnel` / `publishToTunnel`: per-user inbox (unread counts, credit balance)
 *
 * Server: TunnelHub (InMemoryHub today → ConnectPlatformHub gated).
 * Client: TransportManager when connected.
 */

import { getTunnelTransportManager } from './transport-manager';
import { getTunnelHub, buildTunnelMessage } from './hub';
import { TunnelMessageType } from './types';

export async function publishToChannel(
  channel: string,
  event: string,
  data: unknown,
): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      const hub = getTunnelHub();
      const message = buildTunnelMessage(channel, event, data);
      hub.publishToChannel(channel, message);
      return;
    }

    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development',
    });
    await manager.publish(channel, event, data);
  } catch (error) {
    console.error('TunnelPublisher: publishToChannel failed:', error);
  }
}

export type PublishToUserTunnelResult = {
  /** True when an active SSE or WS socket received the message immediately. */
  deliveredLive: boolean
}

export async function publishToUserTunnel(
  userId: string,
  channel: string,
  data: unknown,
): Promise<PublishToUserTunnelResult> {
  try {
    const event = 'update';

    if (typeof window === 'undefined') {
      const hub = getTunnelHub();
      const message = buildTunnelMessage(channel, event, data, {
        userId,
        type: TunnelMessageType.NOTIFICATION,
      });
      const { sseDelivered, wsDelivered } = hub.publishToUser(userId, message);
      const deliveredLive = sseDelivered || wsDelivered;
      if (deliveredLive) {
        console.log(
          `TunnelPublisher: Published to user ${userId} on channel ${channel} (sse=${sseDelivered}, ws=${wsDelivered})`,
        );
      } else {
        // No live SSE/WS socket at publish time — message is queued for delivery
        // on next connect (see drainUserQueue in hub/in-memory-hub.ts). This is
        // expected during the tunnel connect boot race (HTTP ingest already
        // persisted the data), not a delivery failure — debug level only.
        console.debug(
          `TunnelPublisher: Queued for user ${userId} on channel ${channel} (no live socket yet)`,
        );
      }
      return { deliveredLive };
    }

    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development',
    });

    if (!manager.isConnected()) {
      console.log(`TunnelPublisher: Client not connected, skipping publish for ${userId}`);
      return { deliveredLive: false };
    }

    await manager.publish(channel, event, data);
    return { deliveredLive: true };
  } catch (error) {
    console.error('TunnelPublisher: Failed to publish message:', error);
    return { deliveredLive: false };
  }
}

/** @deprecated Use publishToUserTunnel */
export const publishToTunnel = publishToUserTunnel;

export async function publishToUsers(
  userIds: string[],
  channel: string,
  data: unknown,
): Promise<void> {
  await Promise.allSettled(userIds.map((userId) => publishToUserTunnel(userId, channel, data)));
}

export async function broadcastToAll(
  channel: string,
  data: unknown,
  excludeUserId?: string,
): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      const hub = getTunnelHub();
      const message = buildTunnelMessage(channel, 'broadcast', data);
      hub.publishToChannel(channel, message);
      return;
    }

    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development',
    });

    await manager.broadcast(
      channel,
      {
        id: `broadcast-${Date.now()}`,
        type: 'broadcast' as TunnelMessageType,
        channel,
        payload: data,
        metadata: {
          timestamp: Date.now(),
          excludeUserId,
        },
      },
      excludeUserId,
    );

    console.log(`TunnelPublisher: Broadcasted to all users on channel ${channel}`);
  } catch (error) {
    console.error('TunnelPublisher: Failed to broadcast message:', error);
  }
}
