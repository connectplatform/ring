/**
 * Server-Sent Events (SSE) Transport Implementation
 * Edge Runtime compatible real-time transport for Vercel and similar platforms
 */

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

export class SSETransport implements TunnelTransport {
  private eventSource: EventSource | null = null;
  private connectionState: TunnelConnectionState = TunnelConnectionState.DISCONNECTED;
  private subscriptions = new Map<string, TunnelSubscription>();
  private eventHandlers = new Map<string, Set<TunnelEventHandler>>();
  private options: TunnelConnectionOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private messagesSent = 0;
  private messagesReceived = 0;
  private errors = 0;
  private lastError?: string;
  private lastActivity = Date.now();
  private startTime = Date.now();
  private latencyHistory: number[] = [];
  private authToken?: string;

  constructor(options?: TunnelConnectionOptions) {
    this.options = {
      url: options?.url || '/api/tunnel/sse',
      reconnect: options?.reconnect !== false,
      reconnectDelay: options?.reconnectDelay || 1000,
      maxReconnectAttempts: options?.maxReconnectAttempts || 10,
      heartbeatInterval: options?.heartbeatInterval || 30000,
      timeout: options?.timeout || 15000,
      ...options,
    };

    this.maxReconnectAttempts = this.options.maxReconnectAttempts!;
    this.reconnectDelay = this.options.reconnectDelay!;
  }

  async connect(options?: TunnelConnectionOptions): Promise<void> {
    if (this.connectionState === TunnelConnectionState.CONNECTED) {
      return;
    }

    this.connectionState = TunnelConnectionState.CONNECTING;
    
    try {
      // Get auth token if available (optional for public connections)
      if (this.options.auth?.token) {
        this.authToken = this.options.auth.token;
      } else {
        // Try to get auth token, but don't fail if unavailable
        try {
          this.authToken = await this.fetchAuthToken();
        } catch (error) {
          console.log('[SSETransport] No auth token available, connecting as anonymous');
          this.authToken = undefined;
        }
      }

      // Create EventSource with optional auth
      const url = new URL(this.options.url!, window.location.origin);
      if (this.authToken) {
        url.searchParams.set('token', this.authToken);
      }

      this.eventSource = new EventSource(url.toString());
      this.setupEventListeners();
      
      // Wait for connection
      await this.waitForConnection();
      
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      
      this.emit('connect', undefined);
    } catch (error) {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
      
      if (this.options.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
      
      throw error;
    }
  }

  private async fetchAuthToken(): Promise<string | undefined> {
    try {
      const response = await fetch('/api/tunnel/token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Don't throw for 401, just return undefined for anonymous users
        if (response.status === 401) {
          return undefined;
        }
        throw new Error(`Auth failed: ${response.status}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      // For anonymous users, auth failure is expected
      console.log('[SSETransport] Auth token not available, continuing as anonymous');
      return undefined;
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.timeout!);

      const onOpen = () => {
        clearTimeout(timeout);
        resolve();
      };

      const onError = (error: Event) => {
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
      };

      this.eventSource!.addEventListener('open', onOpen, { once: true });
      this.eventSource!.addEventListener('error', onError, { once: true });
    });
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    // Connection opened
    this.eventSource.addEventListener('open', () => {
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.lastActivity = Date.now();
    });

    // Connection error
    this.eventSource.addEventListener('error', (event) => {
      this.errors++;
      this.lastError = 'SSE connection error';
      
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.connectionState = TunnelConnectionState.DISCONNECTED;
        this.emit('disconnect', { reason: 'Connection closed' });
        
        if (this.options.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      } else {
        this.connectionState = TunnelConnectionState.ERROR;
        this.emit('error', { error: new Error('SSE error') });
      }
    });

    // Default message event
    this.eventSource.addEventListener('message', (event) => {
      this.handleMessage(event);
    });

    // Specific event types
    this.eventSource.addEventListener('notification', (event) => {
      this.handleMessage(event, TunnelMessageType.NOTIFICATION);
    });

    this.eventSource.addEventListener('presence', (event) => {
      this.handleMessage(event, TunnelMessageType.PRESENCE);
    });

    this.eventSource.addEventListener('heartbeat', (event) => {
      this.handleHeartbeat(event);
    });

    this.eventSource.addEventListener('ack', (event) => {
      this.handleAck(event);
    });
  }

  private handleMessage(event: MessageEvent, type?: TunnelMessageType): void {
    this.messagesReceived++;
    this.lastActivity = Date.now();

    try {
      const message = MessageConverter.fromSSE(event);
      
      if (type) {
        message.type = type;
      }

      // Emit specific event type
      if (message.type === TunnelMessageType.NOTIFICATION) {
        this.emit('notification', message);
      } else if (message.type === TunnelMessageType.PRESENCE) {
        this.emit('presence', message);
      }

      // Always emit generic message event
      this.emit('message', message);

      // Handle channel-specific subscriptions
      if (message.channel) {
        this.subscriptions.forEach(subscription => {
          if (subscription.channel === message.channel) {
            // Subscription handlers are managed externally
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  }

  private handleHeartbeat(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const latency = Date.now() - data.timestamp;
      
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }
      
      this.emit('latency', { value: latency });
      
      // Send heartbeat response
      this.sendHeartbeatResponse();
    } catch (error) {
      console.error('Failed to handle heartbeat:', error);
    }
  }

  private handleAck(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      // Handle message acknowledgment
      this.emit('ack', data);
    } catch (error) {
      console.error('Failed to handle ack:', error);
    }
  }

  private async sendHeartbeatResponse(): Promise<void> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Only add auth header if we have a token
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      await fetch('/api/tunnel/heartbeat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          timestamp: Date.now(),
          provider: TunnelProvider.SSE,
        }),
      });
    } catch (error) {
      // Don't log errors for anonymous users
      if (this.authToken) {
        console.error('Failed to send heartbeat response:', error);
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeatResponse();
      }
    }, this.options.heartbeatInterval!);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.connectionState = TunnelConnectionState.RECONNECTING;
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.emit('reconnect', { attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.stopHeartbeat();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectionState = TunnelConnectionState.DISCONNECTED;
    this.emit('disconnect', { reason: 'Manual disconnect' });
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  getConnectionState(): TunnelConnectionState {
    return this.connectionState;
  }

  async publish(channel: string, event: string, data: any): Promise<void> {
    // SSE is unidirectional - use HTTP POST for publishing
    // Anonymous users can't publish
    if (!this.authToken) {
      console.log('[SSETransport] Anonymous users cannot publish messages');
      return;
    }

    const message = createTunnelMessage(
      TunnelMessageType.DATA,
      data,
      { channel, event, provider: TunnelProvider.SSE }
    );

    try {
      const response = await fetch('/api/tunnel/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          channel,
          event,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Publish failed: ${response.status}`);
      }

      this.messagesSent++;
      this.lastActivity = Date.now();
    } catch (error) {
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Publish failed';
      throw error;
    }
  }

  async subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription> {
    const subscriptionId = `sse-${options.channel}-${Date.now()}`;

    // Send subscription request to server
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Only add auth header if we have a token
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch('/api/tunnel/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: options.channel,
          events: options.events,
          presence: options.presence,
          history: options.history,
        }),
      });

      if (!response.ok) {
        // Don't throw for anonymous users, just log
        if (!this.authToken && response.status === 401) {
          console.log('[SSETransport] Anonymous subscription to', options.channel);
        } else {
          throw new Error(`Subscribe failed: ${response.status}`);
        }
      }
    } catch (error) {
      // Don't retry subscription errors for anonymous users
      if (!this.authToken) {
        console.log('[SSETransport] Anonymous subscription skipped:', error);
      } else {
        console.error('Failed to subscribe:', error);
        throw error;
      }
    }

    const subscription: TunnelSubscription = {
      id: subscriptionId,
      channel: options.channel,
      unsubscribe: async () => {
        await this.unsubscribe(subscriptionId);
      },
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Only add auth header if we have a token
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      await fetch('/api/tunnel/unsubscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: subscription.channel,
        }),
      });
    } catch (error) {
      // Don't log errors for anonymous users
      if (this.authToken) {
        console.error('Failed to unsubscribe:', error);
      }
    }

    this.subscriptions.delete(subscriptionId);
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
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    const avgLatency = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length)
      : 0;

    return {
      state: this.connectionState,
      latency: avgLatency,
      uptime,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      errors: this.errors,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      provider: TunnelProvider.SSE,
      providerSpecific: {
        readyState: this.eventSource?.readyState,
        reconnectAttempts: this.reconnectAttempts,
        subscriptions: this.subscriptions.size,
      },
    };
  }

  async getLatency(): Promise<number> {
    // Send a ping and measure response time
    const start = Date.now();
    
    try {
      const response = await fetch('/api/tunnel/ping', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        return -1;
      }

      return Date.now() - start;
    } catch (error) {
      return -1;
    }
  }

  getProvider(): TunnelProvider {
    return TunnelProvider.SSE;
  }

  getProviderClient(): EventSource | null {
    return this.eventSource;
  }

  setDebug(enabled: boolean): void {
    if (enabled) {
      console.log('[SSETransport] Debug mode enabled');
      console.log('[SSETransport] State:', this.getHealth());
    }
  }
}

/**
 * Factory function for creating SSE transport
 */
export function createSSETransport(
  options?: TunnelConnectionOptions
): TunnelTransport {
  return new SSETransport(options);
}
