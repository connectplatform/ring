/**
 * Long-Polling Transport Implementation
 * HTTP long-polling with smart backoff for universal fallback
 * Works in all environments including restrictive firewalls
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

export class PollingTransport implements TunnelTransport {
  private connectionState: TunnelConnectionState = TunnelConnectionState.DISCONNECTED;
  private subscriptions = new Map<string, TunnelSubscription>();
  private eventHandlers = new Map<string, Set<TunnelEventHandler>>();
  private options: TunnelConnectionOptions;
  private pollTimer?: NodeJS.Timeout;
  private pollInterval = 2000; // Start with 2 seconds
  private maxPollInterval = 30000; // Max 30 seconds
  private minPollInterval = 1000; // Min 1 second
  private consecutiveErrors = 0;
  private messagesSent = 0;
  private messagesReceived = 0;
  private errors = 0;
  private lastError?: string;
  private lastActivity = Date.now();
  private startTime = Date.now();
  private latencyHistory: number[] = [];
  private authToken?: string;
  private isPolling = false;
  private lastMessageId?: string;
  private subscribedChannels = new Set<string>();

  constructor(options?: TunnelConnectionOptions) {
    this.options = {
      url: options?.url || '/api/tunnel/poll',
      reconnect: options?.reconnect !== false,
      reconnectDelay: options?.reconnectDelay || 2000,
      maxReconnectAttempts: options?.maxReconnectAttempts || Infinity,
      heartbeatInterval: options?.heartbeatInterval || 60000,
      timeout: options?.timeout || 30000,
      ...options,
    };

    this.pollInterval = this.options.reconnectDelay || 2000;
  }

  async connect(options?: TunnelConnectionOptions): Promise<void> {
    if (this.connectionState === TunnelConnectionState.CONNECTED) {
      return;
    }

    this.connectionState = TunnelConnectionState.CONNECTING;
    
    try {
      // Get auth token if needed
      if (this.options.auth?.token) {
        this.authToken = this.options.auth.token;
      } else {
        this.authToken = await this.fetchAuthToken();
      }

      // Start polling
      this.startPolling();
      
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.consecutiveErrors = 0;
      this.emit('connect', undefined);
    } catch (error) {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  private async fetchAuthToken(): Promise<string> {
    try {
      const response = await fetch('/api/websocket/auth', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Failed to fetch polling auth token:', error);
      throw error;
    }
  }

  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.isPolling) {
      return;
    }
    
    // Check if we should stop polling
    if (this.connectionState === TunnelConnectionState.DISCONNECTED) {
      this.isPolling = false;
      return;
    }

    const startTime = Date.now();
    
    try {
      const url = new URL(this.options.url!, window.location.origin);
      
      // Add query parameters
      if (this.lastMessageId) {
        url.searchParams.set('lastMessageId', this.lastMessageId);
      }
      
      // Add subscribed channels
      if (this.subscribedChannels.size > 0) {
        url.searchParams.set('channels', Array.from(this.subscribedChannels).join(','));
      }

      // Long-poll request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout!);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
        // Keep connection alive for long-polling
        keepalive: true,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Calculate latency
      const latency = Date.now() - startTime;
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }

      // Process messages
      if (data.messages && Array.isArray(data.messages)) {
        for (const messageData of data.messages) {
          this.handleMessage(messageData);
        }
      }

      // Update last message ID for deduplication
      if (data.lastMessageId) {
        this.lastMessageId = data.lastMessageId;
      }

      // Successful poll - decrease interval (speed up)
      this.consecutiveErrors = 0;
      this.pollInterval = Math.max(
        this.minPollInterval,
        this.pollInterval * 0.9
      );

      // If connected, continue polling immediately
      if (this.connectionState === TunnelConnectionState.CONNECTED) {
        // Small delay to prevent tight loop
        setTimeout(() => this.poll(), 100);
      }

    } catch (error) {
      this.errors++;
      this.consecutiveErrors++;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Timeout - this is normal for long-polling
          this.lastError = 'Poll timeout';
        } else {
          this.lastError = error.message;
          console.error('Polling error:', error);
        }
      }

      // Exponential backoff on errors
      this.pollInterval = Math.min(
        this.maxPollInterval,
        this.pollInterval * Math.pow(1.5, Math.min(this.consecutiveErrors, 5))
      );

      // Schedule next poll with backoff
      if (this.isPolling) {
        this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
      }
    }
  }

  private handleMessage(data: any): void {
    this.messagesReceived++;
    this.lastActivity = Date.now();

    try {
      // Convert to tunnel message format
      const message = data.id && data.type 
        ? data as TunnelMessage
        : createTunnelMessage(
            TunnelMessageType.DATA,
            data,
            { provider: TunnelProvider.LONG_POLLING }
          );

      // Emit specific event types
      if (message.type === TunnelMessageType.NOTIFICATION) {
        this.emit('notification', message);
      } else if (message.type === TunnelMessageType.PRESENCE) {
        this.emit('presence', message);
      } else if (message.type === TunnelMessageType.HEARTBEAT) {
        this.emit('latency', { value: Date.now() - (message.payload?.timestamp || Date.now()) });
      }

      // Always emit generic message event
      this.emit('message', message);

    } catch (error) {
      console.error('Failed to handle polling message:', error);
    }
  }

  async disconnect(): Promise<void> {
    this.isPolling = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    // Send disconnect notification
    if (this.authToken) {
      try {
        await fetch('/api/tunnel/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`,
          },
        });
      } catch (error) {
        // Ignore disconnect errors
      }
    }

    this.connectionState = TunnelConnectionState.DISCONNECTED;
    this.subscribedChannels.clear();
    this.emit('disconnect', { reason: 'Manual disconnect' });
  }

  isConnected(): boolean {
    return this.connectionState === TunnelConnectionState.CONNECTED && this.isPolling;
  }

  getConnectionState(): TunnelConnectionState {
    return this.connectionState;
  }

  async publish(channel: string, event: string, data: any): Promise<void> {
    const message = createTunnelMessage(
      TunnelMessageType.DATA,
      data,
      { channel, event, provider: TunnelProvider.LONG_POLLING }
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
    const subscriptionId = `poll-${options.channel}-${Date.now()}`;

    // Add channel to subscribed set
    this.subscribedChannels.add(options.channel);

    // Send subscription request
    try {
      const response = await fetch('/api/tunnel/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          channel: options.channel,
          events: options.events,
          presence: options.presence,
          history: options.history,
        }),
      });

      if (!response.ok) {
        throw new Error(`Subscribe failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      this.subscribedChannels.delete(options.channel);
      throw error;
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

    // Remove channel from subscribed set
    this.subscribedChannels.delete(subscription.channel);

    try {
      await fetch('/api/tunnel/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          channel: subscription.channel,
        }),
      });
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
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
      provider: TunnelProvider.LONG_POLLING,
      providerSpecific: {
        pollInterval: this.pollInterval,
        consecutiveErrors: this.consecutiveErrors,
        subscribedChannels: this.subscribedChannels.size,
        isPolling: this.isPolling,
      },
    };
  }

  async getLatency(): Promise<number> {
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
    return TunnelProvider.LONG_POLLING;
  }

  getProviderClient(): null {
    return null; // No underlying client for polling
  }

  setDebug(enabled: boolean): void {
    if (enabled) {
      console.log('[PollingTransport] Debug mode enabled');
      console.log('[PollingTransport] State:', this.getHealth());
    }
  }
}

/**
 * Factory function for creating polling transport
 */
export function createPollingTransport(
  options?: TunnelConnectionOptions
): TunnelTransport {
  return new PollingTransport(options);
}
