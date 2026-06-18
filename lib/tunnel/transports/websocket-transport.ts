/**
 * Native WebSocket Transport — wraps browser NativeWsClient for TunnelTransport.
 */

import { NativeWsClient } from '../native-ws/client';
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
import { createTunnelMessage, TunnelMessageType } from '../protocol';

export class WebSocketTransport implements TunnelTransport {
  private client: NativeWsClient;
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
  private messageHandler?: (message: TunnelMessage) => void;

  constructor(options?: TunnelConnectionOptions) {
    const url = options?.url ?? this.resolveDefaultUrl();
    this.client = new NativeWsClient({
      url,
      reconnectDelay: options?.reconnectDelay,
      maxReconnectAttempts: options?.maxReconnectAttempts,
      heartbeatInterval: options?.heartbeatInterval,
    });
    this.setupEventListeners();
  }

  private resolveDefaultUrl(): string {
    if (typeof window === 'undefined') {
      return process.env.NEXT_PUBLIC_TUNNEL_WS_URL ?? 'ws://localhost:3000/api/tunnel/ws';
    }
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return (
      process.env.NEXT_PUBLIC_TUNNEL_WS_URL ??
      `${wsProto}//${window.location.host}/api/tunnel/ws`
    );
  }

  private setupEventListeners(): void {
    this.client.on('connected', () => {
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.emit('connect', undefined);
    });

    this.client.on('disconnected', () => {
      this.connectionState = TunnelConnectionState.DISCONNECTED;
      this.emit('disconnect', { reason: 'Connection closed' });
    });

    this.client.on('connecting', () => {
      this.connectionState = TunnelConnectionState.CONNECTING;
    });

    this.client.on('error', (error: Error) => {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error.message;
      this.emit('error', { error });
    });

    this.client.on('message', (message: TunnelMessage) => {
      this.messagesReceived++;
      this.lastActivity = Date.now();
      this.emit('message', message);
    });

    this.client.on('notification', (message: TunnelMessage) => {
      this.messagesReceived++;
      this.lastActivity = Date.now();
      this.emit('notification', message);
      this.emit('message', message);
    });

    this.client.on('latency', (latency: number) => {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }
      this.emit('latency', { value: latency });
    });
  }

  async connect(_options?: TunnelConnectionOptions): Promise<void> {
    this.connectionState = TunnelConnectionState.CONNECTING;
    try {
      await this.client.connect();
      this.connectionState = TunnelConnectionState.CONNECTED;
    } catch (error) {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
    this.connectionState = TunnelConnectionState.DISCONNECTED;
  }

  isConnected(): boolean {
    return this.client.isConnected;
  }

  getConnectionState(): TunnelConnectionState {
    const state = this.client.getState();
    switch (state.status) {
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

  async publish(channel: string, event: string, data: unknown): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }
    this.client.publish(channel, event, data);
    this.messagesSent++;
    this.lastActivity = Date.now();
  }

  async subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription> {
    const subscriptionId = `ws-${options.channel}-${Date.now()}`;
    this.client.subscribe(options.channel);

    const subscription: TunnelSubscription = {
      id: subscriptionId,
      channel: options.channel,
      unsubscribe: () => {
        this.client.unsubscribe(options.channel);
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

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  getHealth(): TunnelHealth {
    const state = this.client.getState();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const avgLatency =
      this.latencyHistory.length > 0
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
        isAuthenticated: state.isAuthenticated,
        reconnectAttempts: state.reconnectAttempts,
      },
    };
  }

  async getLatency(): Promise<number> {
    return this.latencyHistory[this.latencyHistory.length - 1] ?? -1;
  }

  getProvider(): TunnelProvider {
    return TunnelProvider.WEBSOCKET;
  }

  getProviderClient(): NativeWsClient {
    return this.client;
  }

  setDebug(enabled: boolean): void {
    if (enabled) {
      console.log('[WebSocketTransport] Debug mode enabled');
    }
  }
}

export function createWebSocketTransport(
  options?: TunnelConnectionOptions,
): TunnelTransport {
  return new WebSocketTransport(options);
}
