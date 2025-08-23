/**
 * WebSocket Transport Implementation
 * Wraps existing WebSocketManager to implement TunnelTransport interface
 */

import { WebSocketManager, WebSocketState } from '@/lib/websocket/websocket-manager';
import {
  TunnelTransport,
  TunnelProvider,
  TunnelConnectionState,
  TunnelConnectionOptions,
  TunnelHealth,
  TunnelMessage,
  TunnelSubscription,
  TunnelSubscriptionOptions,
  TunnelEventHandler,
} from '../types';
import { MessageConverter, createTunnelMessage, TunnelMessageType } from '../protocol';

export class WebSocketTransport implements TunnelTransport {
  private manager: WebSocketManager;
  private subscriptions = new Map<string, TunnelSubscription>();
  private eventHandlers = new Map<string, Set<TunnelEventHandler>>();
  private connectionState: TunnelConnectionState = TunnelConnectionState.DISCONNECTED;
  private latencyHistory: number[] = [];
  private messagesSent = 0;
  private messagesReceived = 0;
  private errors = 0;
  private lastError?: string;
  private lastActivity = Date.now();
  private startTime = Date.now();

  constructor(options?: TunnelConnectionOptions) {
    this.manager = new WebSocketManager({
      url: options?.url,
      reconnectDelay: options?.reconnectDelay,
      maxReconnectAttempts: options?.maxReconnectAttempts,
      heartbeatInterval: options?.heartbeatInterval,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Map WebSocket events to tunnel events
    this.manager.on('connected', () => {
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.emit('connect', undefined);
    });

    this.manager.on('disconnected', () => {
      this.connectionState = TunnelConnectionState.DISCONNECTED;
      this.emit('disconnect', { reason: 'Connection closed' });
    });

    this.manager.on('reconnecting', (attempt: number) => {
      this.connectionState = TunnelConnectionState.RECONNECTING;
      this.emit('reconnect', { attempt });
    });

    this.manager.on('error', (error: Error) => {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error.message;
      this.emit('error', { error });
    });

    // Handle incoming messages
    this.manager.on('notification', (data: any) => {
      this.messagesReceived++;
      this.lastActivity = Date.now();
      
      const message = MessageConverter.fromWebSocket({
        event: 'notification',
        data,
      });
      
      this.emit('notification', message);
      this.emit('message', message);
    });

    this.manager.on('message', (data: any) => {
      this.messagesReceived++;
      this.lastActivity = Date.now();
      
      const message = MessageConverter.fromWebSocket(data);
      this.emit('message', message);
    });

    // Track latency from heartbeats
    this.manager.on('pong', (latency: number) => {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }
      this.emit('latency', { value: latency });
    });
  }

  async connect(options?: TunnelConnectionOptions): Promise<void> {
    this.connectionState = TunnelConnectionState.CONNECTING;
    
    try {
      await this.manager.connect();
      this.connectionState = TunnelConnectionState.CONNECTED;
    } catch (error) {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.manager.disconnect();
    this.connectionState = TunnelConnectionState.DISCONNECTED;
  }

  isConnected(): boolean {
    return this.manager.isConnected;
  }

  getConnectionState(): TunnelConnectionState {
    const wsState = this.manager.getState();
    
    switch (wsState.status) {
      case 'connected':
        return TunnelConnectionState.CONNECTED;
      case 'connecting':
        return TunnelConnectionState.CONNECTING;
      case 'reconnecting':
        return TunnelConnectionState.RECONNECTING;
      case 'error':
        return TunnelConnectionState.ERROR;
      default:
        return TunnelConnectionState.DISCONNECTED;
    }
  }

  async publish(channel: string, event: string, data: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    const message = createTunnelMessage(
      TunnelMessageType.DATA,
      data,
      { channel, event, provider: TunnelProvider.WEBSOCKET }
    );

    this.manager.emit(event, {
      channel,
      data,
      message,
    });

    this.messagesSent++;
    this.lastActivity = Date.now();
  }

  async subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription> {
    const subscriptionId = `ws-${options.channel}-${Date.now()}`;
    
    // Subscribe to channel on WebSocket
    this.manager.subscribe(options.channel);

    // Handle channel-specific messages
    const handler = (data: any) => {
      if (data.channel === options.channel) {
        const message = MessageConverter.fromWebSocket(data);
        
        // Filter by event if specified
        if (options.events && !options.events.includes(message.event || '')) {
          return;
        }

        this.emit('message', message);
      }
    };

    this.manager.on('message', handler);

    const subscription: TunnelSubscription = {
      id: subscriptionId,
      channel: options.channel,
      unsubscribe: () => {
        this.manager.off('message', handler);
        this.manager.unsubscribe(options.channel);
        this.subscriptions.delete(subscriptionId);
      },
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
    }
  }

  on(event: string, handler: TunnelEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler?: TunnelEventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    }
  }

  once(event: string, handler: TunnelEventHandler): void {
    const onceHandler: TunnelEventHandler = (message) => {
      handler(message);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  getHealth(): TunnelHealth {
    const wsState = this.manager.getState();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    const avgLatency = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length)
      : 0;

    return {
      state: this.getConnectionState(),
      latency: avgLatency,
      uptime,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      errors: this.errors,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      provider: TunnelProvider.WEBSOCKET,
      providerSpecific: {
        isAuthenticated: wsState.isAuthenticated,
        reconnectAttempts: wsState.reconnectAttempts,
        totalConnections: wsState.totalConnections || 0,
        totalDisconnections: wsState.totalDisconnections || 0,
      },
    };
  }

  async getLatency(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      
      // Use WebSocket ping/pong for latency measurement
      this.manager.once('pong', () => {
        const latency = Date.now() - start;
        resolve(latency);
      });
      
      // Use emit to trigger ping
      this.manager.emit('ping', {});
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(-1), 5000);
    });
  }

  getProvider(): TunnelProvider {
    return TunnelProvider.WEBSOCKET;
  }

  getProviderClient(): WebSocketManager {
    return this.manager;
  }

  setDebug(enabled: boolean): void {
    // WebSocketManager doesn't have a debug mode, but we can add logging
    if (enabled) {
      console.log('[WebSocketTransport] Debug mode enabled');
    }
  }
}

/**
 * Factory function for creating WebSocket transport
 */
export function createWebSocketTransport(
  options?: TunnelConnectionOptions
): TunnelTransport {
  return new WebSocketTransport(options);
}
