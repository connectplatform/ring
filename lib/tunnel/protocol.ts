/**
 * Unified Message Protocol for Tunnel Transport
 * Provides consistent message format across all transport providers
 */

import { nanoid } from 'nanoid';
import {
  TunnelMessage,
  TunnelMessageType,
  TunnelProvider,
} from './types';

// Re-export for convenience
export { TunnelMessageType } from './types';

/**
 * Protocol version for compatibility checking
 */
export const TUNNEL_PROTOCOL_VERSION = '1.0.0';

/**
 * Create a new tunnel message
 */
export function createTunnelMessage(
  type: TunnelMessageType,
  payload?: any,
  options?: {
    channel?: string;
    event?: string;
    userId?: string;
    sessionId?: string;
    provider?: TunnelProvider;
    metadata?: Record<string, any>;
  }
): TunnelMessage {
  return {
    id: nanoid(),
    type,
    channel: options?.channel,
    event: options?.event,
    payload,
    metadata: {
      timestamp: Date.now(),
      userId: options?.userId,
      sessionId: options?.sessionId,
      provider: options?.provider,
      version: TUNNEL_PROTOCOL_VERSION,
      ...options?.metadata,
    },
  };
}

/**
 * Convert provider-specific message to tunnel message
 */
export class MessageConverter {
  /**
   * Convert WebSocket message to tunnel message
   */
  static fromWebSocket(data: any): TunnelMessage {
    // If already in tunnel format
    if (data.id && data.type) {
      return data as TunnelMessage;
    }

    // Legacy WebSocket format
    if (data.event) {
      return createTunnelMessage(
        TunnelMessageType.DATA,
        data.data || data.payload,
        {
          event: data.event,
          channel: data.channel || data.room,
          metadata: data.metadata,
        }
      );
    }

    // Raw data
    return createTunnelMessage(TunnelMessageType.DATA, data);
  }

  /**
   * Convert SSE message to tunnel message
   */
  static fromSSE(event: MessageEvent): TunnelMessage {
    try {
      const data = JSON.parse(event.data);
      
      // If already in tunnel format
      if (data.id && data.type) {
        return data as TunnelMessage;
      }

      // SSE event type mapping
      const type = event.type === 'message' 
        ? TunnelMessageType.DATA
        : event.type === 'notification'
        ? TunnelMessageType.NOTIFICATION
        : TunnelMessageType.DATA;

      return createTunnelMessage(type, data, {
        event: event.type,
      });
    } catch (error) {
      // Plain text message
      return createTunnelMessage(
        TunnelMessageType.DATA,
        event.data,
        { event: event.type }
      );
    }
  }

  /**
   * Convert Supabase realtime message to tunnel message
   */
  static fromSupabase(payload: any): TunnelMessage {
    // Database change event
    if (payload.eventType) {
      const type = payload.eventType === 'INSERT'
        ? TunnelMessageType.DB_INSERT
        : payload.eventType === 'UPDATE'
        ? TunnelMessageType.DB_UPDATE
        : payload.eventType === 'DELETE'
        ? TunnelMessageType.DB_DELETE
        : TunnelMessageType.DB_CHANGE;

      return createTunnelMessage(type, payload.new || payload.old, {
        channel: payload.table,
        event: payload.eventType,
        metadata: {
          schema: payload.schema,
          table: payload.table,
          commit_timestamp: payload.commit_timestamp,
        },
      });
    }

    // Broadcast event
    if (payload.event === 'broadcast') {
      return createTunnelMessage(
        TunnelMessageType.MESSAGE,
        payload.payload,
        {
          channel: payload.topic,
          event: payload.event,
        }
      );
    }

    // Presence event
    if (payload.event === 'presence') {
      return createTunnelMessage(
        TunnelMessageType.PRESENCE,
        payload.payload,
        {
          channel: payload.topic,
          event: payload.event,
        }
      );
    }

    // Default
    return createTunnelMessage(TunnelMessageType.DATA, payload);
  }

  /**
   * Convert Firebase message to tunnel message
   */
  static fromFirebase(snapshot: any, type?: 'added' | 'modified' | 'removed'): TunnelMessage {
    const messageType = type === 'added'
      ? TunnelMessageType.DB_INSERT
      : type === 'modified'
      ? TunnelMessageType.DB_UPDATE
      : type === 'removed'
      ? TunnelMessageType.DB_DELETE
      : TunnelMessageType.DB_CHANGE;

    const data = typeof snapshot.data === 'function' 
      ? snapshot.data() 
      : snapshot.val?.() || snapshot;

    return createTunnelMessage(messageType, data, {
      channel: snapshot.ref?.path || snapshot.ref?.id,
      metadata: {
        id: snapshot.id,
        exists: snapshot.exists?.(),
      },
    });
  }

  /**
   * Convert Pusher message to tunnel message
   */
  static fromPusher(event: string, data: any, channel?: string): TunnelMessage {
    // Pusher presence events
    if (event.startsWith('pusher:')) {
      const type = event.includes('member') 
        ? TunnelMessageType.PRESENCE
        : TunnelMessageType.DATA;

      return createTunnelMessage(type, data, {
        channel,
        event,
        metadata: { pusherEvent: event },
      });
    }

    // Client events
    if (event.startsWith('client-')) {
      return createTunnelMessage(TunnelMessageType.MESSAGE, data, {
        channel,
        event,
        metadata: { clientEvent: true },
      });
    }

    // Regular events
    return createTunnelMessage(TunnelMessageType.DATA, data, {
      channel,
      event,
    });
  }

  /**
   * Convert Ably message to tunnel message
   */
  static fromAbly(message: any): TunnelMessage {
    // Presence message
    if (message.action !== undefined) {
      return createTunnelMessage(
        TunnelMessageType.PRESENCE,
        message.data,
        {
          channel: message.channel,
          metadata: {
            action: message.action,
            clientId: message.clientId,
            connectionId: message.connectionId,
            timestamp: message.timestamp,
          },
        }
      );
    }

    // Regular message
    return createTunnelMessage(
      TunnelMessageType.MESSAGE,
      message.data,
      {
        channel: message.channel,
        event: message.name,
        metadata: {
          id: message.id,
          clientId: message.clientId,
          connectionId: message.connectionId,
          timestamp: message.timestamp,
        },
      }
    );
  }

  /**
   * Convert tunnel message to provider-specific format
   */
  static toWebSocket(message: TunnelMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Convert tunnel message to SSE format
   */
  static toSSE(message: TunnelMessage): string {
    const event = message.event || message.type;
    const data = JSON.stringify(message);
    return `event: ${event}\ndata: ${data}\n\n`;
  }

  /**
   * Convert tunnel message to Supabase format
   */
  static toSupabase(message: TunnelMessage): any {
    return {
      type: 'broadcast',
      event: message.event || message.type,
      payload: message.payload,
    };
  }

  /**
   * Convert tunnel message to Firebase format
   */
  static toFirebase(message: TunnelMessage): any {
    return {
      ...message.payload,
      _metadata: {
        id: message.id,
        type: message.type,
        timestamp: message.metadata?.timestamp,
        userId: message.metadata?.userId,
      },
    };
  }

  /**
   * Convert tunnel message to Pusher format
   */
  static toPusher(message: TunnelMessage): { event: string; data: any } {
    return {
      event: message.event || message.type,
      data: message.payload,
    };
  }

  /**
   * Convert tunnel message to Ably format
   */
  static toAbly(message: TunnelMessage): any {
    return {
      name: message.event || message.type,
      data: message.payload,
    };
  }
}

/**
 * Message validation
 */
export function validateTunnelMessage(message: any): message is TunnelMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof message.id === 'string' &&
    typeof message.type === 'string' &&
    Object.values(TunnelMessageType).includes(message.type) &&
    (message.metadata === undefined || typeof message.metadata === 'object')
  );
}

/**
 * Message filtering
 */
export function filterMessages(
  messages: TunnelMessage[],
  criteria: {
    type?: TunnelMessageType | TunnelMessageType[];
    channel?: string | string[];
    event?: string | string[];
    userId?: string;
    after?: number; // timestamp
    before?: number; // timestamp
  }
): TunnelMessage[] {
  return messages.filter(message => {
    // Filter by type
    if (criteria.type) {
      const types = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
      if (!types.includes(message.type)) return false;
    }

    // Filter by channel
    if (criteria.channel) {
      const channels = Array.isArray(criteria.channel) 
        ? criteria.channel 
        : [criteria.channel];
      if (!message.channel || !channels.includes(message.channel)) return false;
    }

    // Filter by event
    if (criteria.event) {
      const events = Array.isArray(criteria.event) ? criteria.event : [criteria.event];
      if (!message.event || !events.includes(message.event)) return false;
    }

    // Filter by user
    if (criteria.userId && message.metadata?.userId !== criteria.userId) {
      return false;
    }

    // Filter by timestamp
    const timestamp = message.metadata?.timestamp;
    if (timestamp) {
      if (criteria.after && timestamp < criteria.after) return false;
      if (criteria.before && timestamp > criteria.before) return false;
    }

    return true;
  });
}

/**
 * Message batching for optimization
 */
export class MessageBatcher {
  private messages: TunnelMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize: number;
  private readonly maxDelay: number;
  private readonly onFlush: (messages: TunnelMessage[]) => void;

  constructor(
    onFlush: (messages: TunnelMessage[]) => void,
    maxBatchSize = 10,
    maxDelay = 100
  ) {
    this.onFlush = onFlush;
    this.maxBatchSize = maxBatchSize;
    this.maxDelay = maxDelay;
  }

  add(message: TunnelMessage): void {
    this.messages.push(message);

    if (this.messages.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxDelay);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.messages.length > 0) {
      const batch = [...this.messages];
      this.messages = [];
      this.onFlush(batch);
    }
  }

  destroy(): void {
    this.flush();
  }
}

/**
 * Message deduplication
 */
export class MessageDeduplicator {
  private seen = new Map<string, number>();
  private readonly windowMs: number;
  private cleanupTimer: NodeJS.Timeout;

  constructor(windowMs = 5000) {
    this.windowMs = windowMs;
    
    // Periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), windowMs);
  }

  isDuplicate(message: TunnelMessage): boolean {
    const key = this.getKey(message);
    const now = Date.now();
    const lastSeen = this.seen.get(key);

    if (lastSeen && now - lastSeen < this.windowMs) {
      return true;
    }

    this.seen.set(key, now);
    return false;
  }

  private getKey(message: TunnelMessage): string {
    // Use message ID if available
    if (message.id) return message.id;
    
    // Otherwise create a key from message properties
    return `${message.type}-${message.channel}-${message.event}-${JSON.stringify(message.payload)}`;
  }

  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.seen.forEach((timestamp, key) => {
      if (now - timestamp > this.windowMs) {
        expired.push(key);
      }
    });

    expired.forEach(key => this.seen.delete(key));
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.seen.clear();
  }
}

/**
 * Protocol negotiation for version compatibility
 */
export function negotiateProtocolVersion(
  clientVersion: string,
  serverVersion: string
): boolean {
  // Simple version check - can be enhanced for more complex scenarios
  const [clientMajor] = clientVersion.split('.');
  const [serverMajor] = serverVersion.split('.');
  
  // Major version must match
  return clientMajor === serverMajor;
}

/**
 * Export protocol constants
 */
export const TUNNEL_PROTOCOL = {
  VERSION: TUNNEL_PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_ATTEMPTS: 10,
  MESSAGE_TIMEOUT: 30000,
  BATCH_SIZE: 10,
  BATCH_DELAY: 100,
  DEDUP_WINDOW: 5000,
} as const;
