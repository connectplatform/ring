/**
 * Supabase Transport Implementation
 * Primary Edge-compatible real-time transport for Vercel deployment
 * Features: 4x faster reads, Row Level Security, real-time database changes
 */

// Type definitions for Supabase (when not installed)
type SupabaseClient = any;
type RealtimeChannel = any;
type RealtimePostgresChangesPayload<T = any> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
};

// Dynamic import for optional dependency
let createClient: any;

try {
  const supabaseModule = require('@supabase/supabase-js');
  createClient = supabaseModule.createClient;
} catch (error) {
  // Supabase not installed - will throw error if transport is used
  console.warn('Supabase transport requires @supabase/supabase-js to be installed');
}
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

export class SupabaseTransport implements TunnelTransport {
  private client: SupabaseClient | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private subscriptions = new Map<string, TunnelSubscription>();
  private eventHandlers = new Map<string, Set<TunnelEventHandler>>();
  private connectionState: TunnelConnectionState = TunnelConnectionState.DISCONNECTED;
  private options: TunnelConnectionOptions;
  private messagesSent = 0;
  private messagesReceived = 0;
  private errors = 0;
  private lastError?: string;
  private lastActivity = Date.now();
  private startTime = Date.now();
  private latencyHistory: number[] = [];
  private reconnectAttempts = 0;

  constructor(options?: TunnelConnectionOptions) {
    // Check if Supabase is available
    if (!createClient) {
      throw new Error('Supabase transport requires @supabase/supabase-js to be installed. Run: npm install @supabase/supabase-js');
    }

    this.options = {
      ...options,
      supabase: {
        url: options?.supabase?.url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: options?.supabase?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        realtimeUrl: options?.supabase?.realtimeUrl,
      },
    };

    if (!this.options.supabase?.url || !this.options.supabase?.anonKey) {
      throw new Error('Supabase URL and anon key are required');
    }
  }

  async connect(options?: TunnelConnectionOptions): Promise<void> {
    if (this.connectionState === TunnelConnectionState.CONNECTED) {
      return;
    }

    this.connectionState = TunnelConnectionState.CONNECTING;

    try {
      // Create Supabase client
      this.client = createClient(
        this.options.supabase!.url,
        this.options.supabase!.anonKey,
        {
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        }
      );

      // Get auth session if available
      if (this.options.auth?.token) {
        await this.client.auth.setSession({
          access_token: this.options.auth.token,
          refresh_token: '', // Will be handled by Supabase
        });
      }

      // Create system channel for connection management
      const systemChannel = this.client.channel('system');
      
      // Track connection state
      systemChannel
        .on('system', { event: '*' }, (payload) => {
          this.handleSystemEvent(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.connectionState = TunnelConnectionState.CONNECTED;
            this.reconnectAttempts = 0;
            this.emit('connect', undefined);
          } else if (status === 'CHANNEL_ERROR') {
            this.connectionState = TunnelConnectionState.ERROR;
            this.errors++;
            this.emit('error', { error: new Error('Channel error') });
          } else if (status === 'TIMED_OUT') {
            this.connectionState = TunnelConnectionState.DISCONNECTED;
            this.emit('disconnect', { reason: 'Timeout' });
          } else if (status === 'CLOSED') {
            this.connectionState = TunnelConnectionState.DISCONNECTED;
            this.emit('disconnect', { reason: 'Closed' });
          }
        });

      this.channels.set('system', systemChannel);
      
      // Wait for connection
      await this.waitForConnection();
      
      this.connectionState = TunnelConnectionState.CONNECTED;
      this.startLatencyMonitoring();
      
    } catch (error) {
      this.connectionState = TunnelConnectionState.ERROR;
      this.errors++;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.timeout || 15000);

      const checkConnection = () => {
        if (this.connectionState === TunnelConnectionState.CONNECTED) {
          clearTimeout(timeout);
          resolve();
        } else if (this.connectionState === TunnelConnectionState.ERROR) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  private handleSystemEvent(payload: any): void {
    this.messagesReceived++;
    this.lastActivity = Date.now();

    // Handle different system events
    switch (payload.type) {
      case 'heartbeat':
        this.handleHeartbeat(payload);
        break;
      case 'error':
        this.errors++;
        this.lastError = payload.message;
        this.emit('error', { error: new Error(payload.message) });
        break;
      case 'reconnect':
        this.reconnectAttempts++;
        this.connectionState = TunnelConnectionState.RECONNECTING;
        this.emit('reconnect', { attempt: this.reconnectAttempts });
        break;
    }
  }

  private handleHeartbeat(payload: any): void {
    const latency = Date.now() - (payload.timestamp || Date.now());
    this.latencyHistory.push(latency);
    
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }
    
    this.emit('latency', { value: latency });
  }

  private startLatencyMonitoring(): void {
    // Periodic latency check using Supabase ping
    setInterval(async () => {
      if (this.isConnected()) {
        const start = Date.now();
        
        try {
          // Use a simple query as a ping
          await this.client?.from('_ping').select('*').limit(0);
          
          const latency = Date.now() - start;
          this.latencyHistory.push(latency);
          
          if (this.latencyHistory.length > 10) {
            this.latencyHistory.shift();
          }
        } catch (error) {
          // Ignore ping errors
        }
      }
    }, 30000); // Every 30 seconds
  }

  async disconnect(): Promise<void> {
    // Unsubscribe from all channels
    for (const [channelName, channel] of this.channels) {
      await channel.unsubscribe();
    }
    
    this.channels.clear();
    this.subscriptions.clear();
    
    // Remove all subscriptions
    if (this.client) {
      await this.client.removeAllChannels();
    }
    
    this.connectionState = TunnelConnectionState.DISCONNECTED;
    this.emit('disconnect', { reason: 'Manual disconnect' });
  }

  isConnected(): boolean {
    return this.connectionState === TunnelConnectionState.CONNECTED;
  }

  getConnectionState(): TunnelConnectionState {
    return this.connectionState;
  }

  async publish(channel: string, event: string, data: any): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected');
    }

    const message = createTunnelMessage(
      TunnelMessageType.DATA,
      data,
      { channel, event, provider: TunnelProvider.SUPABASE }
    );

    // Get or create channel
    let realtimeChannel = this.channels.get(channel);
    
    if (!realtimeChannel) {
      realtimeChannel = this.client.channel(channel);
      await new Promise<void>((resolve, reject) => {
        realtimeChannel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Failed to subscribe to channel: ${status}`));
          }
        });
      });
      
      this.channels.set(channel, realtimeChannel);
    }

    // Send broadcast message
    await realtimeChannel.send({
      type: 'broadcast',
      event,
      payload: message,
    });

    this.messagesSent++;
    this.lastActivity = Date.now();
  }

  async subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const subscriptionId = `supabase-${options.channel}-${Date.now()}`;
    
    // Get or create channel
    let realtimeChannel = this.channels.get(options.channel);
    
    if (!realtimeChannel) {
      realtimeChannel = this.client.channel(options.channel);
      
      // Set up broadcast listener
      realtimeChannel.on('broadcast', { event: '*' }, (payload) => {
        this.handleBroadcast(options.channel, payload);
      });

      // Set up presence if requested
      if (options.presence) {
        realtimeChannel.on('presence', { event: 'sync' }, () => {
          const state = realtimeChannel!.presenceState();
          this.handlePresence(options.channel, state);
        });
        
        realtimeChannel.on('presence', { event: 'join' }, (payload) => {
          this.handlePresenceJoin(options.channel, payload);
        });
        
        realtimeChannel.on('presence', { event: 'leave' }, (payload) => {
          this.handlePresenceLeave(options.channel, payload);
        });
      }

      // Set up database changes listener if channel matches a table name
      if (options.channel.startsWith('table:')) {
        const tableName = options.channel.replace('table:', '');
        
        realtimeChannel
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: tableName 
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              this.handleDatabaseChange(payload);
            }
          );
      }

      // Subscribe to channel
      await new Promise<void>((resolve, reject) => {
        realtimeChannel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Failed to subscribe: ${status}`));
          }
        });
      });

      this.channels.set(options.channel, realtimeChannel);
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

    // Check if any other subscriptions use this channel
    let othersUsingChannel = false;
    for (const [id, sub] of this.subscriptions) {
      if (id !== subscriptionId && sub.channel === subscription.channel) {
        othersUsingChannel = true;
        break;
      }
    }

    // If no other subscriptions, unsubscribe from channel
    if (!othersUsingChannel) {
      const channel = this.channels.get(subscription.channel);
      if (channel) {
        await channel.unsubscribe();
        this.channels.delete(subscription.channel);
      }
    }

    this.subscriptions.delete(subscriptionId);
  }

  private handleBroadcast(channel: string, payload: any): void {
    this.messagesReceived++;
    this.lastActivity = Date.now();

    const message = MessageConverter.fromSupabase({
      ...payload,
      topic: channel,
    });

    this.emit('message', message);
  }

  private handlePresence(channel: string, state: any): void {
    const message = createTunnelMessage(
      TunnelMessageType.PRESENCE,
      state,
      { channel, event: 'sync', provider: TunnelProvider.SUPABASE }
    );

    this.emit('presence', message);
  }

  private handlePresenceJoin(channel: string, payload: any): void {
    const message = createTunnelMessage(
      TunnelMessageType.PRESENCE,
      payload,
      { channel, event: 'join', provider: TunnelProvider.SUPABASE }
    );

    this.emit('presence', message);
  }

  private handlePresenceLeave(channel: string, payload: any): void {
    const message = createTunnelMessage(
      TunnelMessageType.PRESENCE,
      payload,
      { channel, event: 'leave', provider: TunnelProvider.SUPABASE }
    );

    this.emit('presence', message);
  }

  private handleDatabaseChange(payload: RealtimePostgresChangesPayload<any>): void {
    this.messagesReceived++;
    this.lastActivity = Date.now();

    const message = MessageConverter.fromSupabase(payload);
    
    // Emit specific database event
    switch (payload.eventType) {
      case 'INSERT':
        this.emit('db_insert', message);
        break;
      case 'UPDATE':
        this.emit('db_update', message);
        break;
      case 'DELETE':
        this.emit('db_delete', message);
        break;
    }

    // Always emit generic message event
    this.emit('message', message);
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
      provider: TunnelProvider.SUPABASE,
      providerSpecific: {
        channels: this.channels.size,
        subscriptions: this.subscriptions.size,
        reconnectAttempts: this.reconnectAttempts,
      },
    };
  }

  async getLatency(): Promise<number> {
    if (!this.client) return -1;

    const start = Date.now();
    
    try {
      // Use a simple query as a ping
      await this.client.from('_ping').select('*').limit(0);
      return Date.now() - start;
    } catch (error) {
      return -1;
    }
  }

  getProvider(): TunnelProvider {
    return TunnelProvider.SUPABASE;
  }

  getProviderClient(): SupabaseClient | null {
    return this.client;
  }

  setDebug(enabled: boolean): void {
    if (enabled) {
      console.log('[SupabaseTransport] Debug mode enabled');
      console.log('[SupabaseTransport] Channels:', Array.from(this.channels.keys()));
      console.log('[SupabaseTransport] Health:', this.getHealth());
    }
  }
}

/**
 * Factory function for creating Supabase transport
 */
export function createSupabaseTransport(
  options?: TunnelConnectionOptions
): TunnelTransport {
  return new SupabaseTransport(options);
}
