/**
 * Tunnel Publisher
 * PHASE 1: Server-side tunnel publishing for real-time updates
 */

import { getTunnelTransportManager } from './transport-manager';

/**
 * Publish a message to a specific user's tunnel
 */
export async function publishToTunnel(
  userId: string,
  channel: string,
  data: any
): Promise<void> {
  try {
    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development'
    });

    // Check if tunnel is available for this user
    if (!manager.isUserConnected(userId)) {
      console.log(`TunnelPublisher: User ${userId} not connected, skipping publish`);
      return;
    }

    // Publish message to user's tunnel
    await manager.publishToUser(userId, channel, {
      id: `msg-${Date.now()}`,
      type: 'notification' as any,
      channel,
      payload: data,
      metadata: {
        timestamp: Date.now(),
        userId
      }
    });

    console.log(`TunnelPublisher: Published to user ${userId} on channel ${channel}`);
  } catch (error) {
    console.error('TunnelPublisher: Failed to publish message:', error);
    // Don't throw - publishing failures shouldn't break business logic
  }
}

/**
 * Publish a message to multiple users' tunnels
 */
export async function publishToUsers(
  userIds: string[],
  channel: string,
  data: any
): Promise<void> {
  const publishPromises = userIds.map(userId =>
    publishToTunnel(userId, channel, data)
  );

  await Promise.allSettled(publishPromises);
}

/**
 * Broadcast a message to all connected users
 */
export async function broadcastToAll(
  channel: string,
  data: any,
  excludeUserId?: string
): Promise<void> {
  try {
    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development'
    });

    await manager.broadcast(channel, {
      id: `broadcast-${Date.now()}`,
      type: 'broadcast' as any,
      channel,
      payload: data,
      metadata: {
        timestamp: Date.now(),
        excludeUserId
      }
    }, excludeUserId);

    console.log(`TunnelPublisher: Broadcasted to all users on channel ${channel}`);
  } catch (error) {
    console.error('TunnelPublisher: Failed to broadcast message:', error);
  }
}
